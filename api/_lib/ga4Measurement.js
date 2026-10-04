import { isHostedPreview } from './previewIsolation.js';

const TABLE = 'booking_ga4_measurement_outbox';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^[0-9]{1,20}\.[0-9]{1,20}$/;
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,30}$/;
const CONSENT_VERSION = '2026-07-14';
const DAY = 86400000;

class Ga4Error extends Error {
  constructor(code) { super(code); this.name = 'Ga4MeasurementError'; }
}

function config() {
  const mode = process.env.GA4_BOOKING_MEASUREMENT_MODE;
  const id = process.env.GA4_MEASUREMENT_ID;
  const secret = process.env.GA4_API_SECRET;
  if (!['validate', 'live'].includes(mode) || !MEASUREMENT_ID.test(id || '') ||
      !secret || (mode === 'live' && isHostedPreview())) return null;
  return { mode, id, secret };
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return NaN;
  return Date.parse(value);
}

function validContext(context, now) {
  if (!context || context.analytics !== true || context.consent_version !== CONSENT_VERSION ||
      typeof context.client_id !== 'string' || !CLIENT_ID.test(context.client_id) ||
      typeof context.measurement_id !== 'string' || !MEASUREMENT_ID.test(context.measurement_id)) return false;
  const recorded = instant(context.consent_recorded_at);
  const captured = instant(context.captured_at);
  return Number.isFinite(recorded) && Number.isFinite(captured) &&
    recorded <= now + 300000 && captured <= now + 300000 &&
    recorded <= captured + 300000 && captured >= now - 90 * DAY;
}

/** Allowlisted server payload only. A saved payment, never a return URL, owns purchase. */
export function ga4MeasurementPayload(row, { now = new Date() } = {}) {
  const time = new Date(typeof now === 'function' ? now() : now).getTime();
  if (!UUID.test(row.booking_id || '') || !['begin_checkout', 'purchase'].includes(row.event_name) ||
      row.event_key !== `booking:${row.booking_id}:${row.event_name}` || row.is_test ||
      !['validate', 'live'].includes(row.mode)) throw new Ga4Error('ga4_event_ineligible');
  const occurred = instant(row.occurred_at);
  if (!Number.isFinite(occurred) || occurred > time + 300000) throw new Ga4Error('ga4_timestamp_invalid');
  if (occurred < time - 3 * DAY) throw new Ga4Error('ga4_event_expired');
  if (!validContext(row.analytics_context, time)) throw new Ga4Error('ga4_consent_or_identity_invalid');
  if (!Number.isSafeInteger(row.amount_pence) || row.amount_pence <= 0 ||
      row.currency !== 'gbp') throw new Ga4Error('ga4_value_invalid');
  const context = row.analytics_context;
  const value = row.amount_pence / 100;
  const params = {
    currency: 'GBP', value,
    items: [{ item_id: 'cleaning_deposit', item_name: 'Cleaning booking deposit', price: value, quantity: 1 }],
  };
  if (row.event_name === 'purchase') params.transaction_id = `booking:${row.booking_id}:deposit`;
  // A request may be agreed days later. Do not pretend its old session is still
  // active: Google requires sending within 24h of session start for session joins.
  const session = String(context.session_id || '');
  const sessionStart = /^\d{1,16}$/.test(session) ? Number(session) * 1000 : NaN;
  if (Number.isSafeInteger(Number(session)) && Number(session) > 0 &&
      sessionStart <= occurred + 300000 && sessionStart <= time &&
      time - sessionStart < DAY && time - instant(context.captured_at) < DAY) {
    params.session_id = session;
  }
  return {
    client_id: context.client_id,
    timestamp_micros: Math.trunc(occurred * 1000),
    validation_behavior: 'ENFORCE_RECOMMENDATIONS',
    consent: {
      ad_user_data: context.advertising === true ? 'GRANTED' : 'DENIED',
      ad_personalization: context.advertising === true ? 'GRANTED' : 'DENIED',
    },
    events: [{ name: row.event_name, params }],
  };
}

async function mark(db, row, patch) {
  const { data, error } = await db.from(TABLE).update(patch)
    .eq('id', row.id).eq('status', 'sending').eq('claimed_at', row.claimed_at).select('id');
  if (error || !Array.isArray(data) || data.length !== 1) throw new Ga4Error('ga4_state_save_failed');
}

async function eligibility(db, row, now, measurementId) {
  const { data: delivery, error: de } = await db.from(TABLE)
    .select('status,claimed_at,is_test').eq('id', row.id).maybeSingle();
  if (de) throw new Ga4Error('ga4_state_recheck_failed');
  if (!delivery || delivery.status !== 'sending' || delivery.claimed_at !== row.claimed_at)
    return { final: true, reason: 'ga4_claim_no_longer_current' };
  const { data: booking, error: be } = await db.from('bookings')
    .select('ga4_context,measurement_is_test,measurement_consent_withdrawn_at')
    .eq('id', row.booking_id).maybeSingle();
  if (be) throw new Ga4Error('ga4_consent_recheck_failed');
  if (!booking) return { reason: 'ga4_booking_missing' };
  if (delivery.is_test || row.is_test || booking.measurement_is_test) return { reason: 'test_record' };
  if (booking.measurement_consent_withdrawn_at || !validContext(booking.ga4_context, now) ||
      booking.ga4_context.client_id !== row.analytics_context?.client_id ||
      booking.ga4_context.mode !== row.mode) return { reason: 'ga4_consent_or_identity_changed' };
  if (booking.ga4_context.measurement_id !== measurementId ||
      row.analytics_context?.measurement_id !== measurementId) return { reason: 'ga4_property_changed' };
  return { eligible: true, advertising: booking.ga4_context.advertising === true };
}

/** Disabled until independently configured. A 2xx response is submitted, not proof of GA4 ingestion. */
export async function deliverGa4Measurements(db, { fetchImpl = fetch, now = () => new Date() } = {}) {
  const configured = config();
  const counts = { processed: 0, submitted: 0, validated: 0, failed: 0, suppressed: 0, uncertain: 0 };
  if (!configured) return { status: 'disabled', ...counts };
  const { data: rows, error } = await db.rpc('claim_booking_ga4_measurements', {
    p_mode: configured.mode, p_limit: 10,
  });
  if (error) throw new Ga4Error('ga4_outbox_claim_failed');
  if (!rows?.length) return { status: 'idle', ...counts };
  for (const row of rows) {
    counts.processed++;
    let dispatched = false;
    try {
      const time = new Date(typeof now === 'function' ? now() : now);
      const current = await eligibility(db, row, time.getTime(), configured.id);
      if (!current.eligible) {
        if (!current.final) await mark(db, row, {
          status: 'suppressed', claimed_at: null, analytics_context: {}, last_error: current.reason,
        });
        counts.suppressed++;
        continue;
      }
      if (row.mode !== configured.mode) throw new Ga4Error('ga4_mode_mismatch');
      const payload = ga4MeasurementPayload({ ...row, analytics_context: {
        ...row.analytics_context, advertising: row.analytics_context.advertising === true && current.advertising,
      } }, { now: time });
      const endpoint = configured.mode === 'validate' ? '/debug/mp/collect' : '/mp/collect';
      const url = new URL(endpoint, 'https://www.google-analytics.com');
      url.searchParams.set('measurement_id', configured.id);
      url.searchParams.set('api_secret', configured.secret);
      dispatched = true;
      const response = await fetchImpl(url.toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000), redirect: 'error',
      });
      if (!response.ok) throw new Ga4Error('ga4_provider_http_error');
      if (configured.mode === 'validate') {
        const result = await response.json();
        if (!Array.isArray(result.validationMessages) || result.validationMessages.length)
          throw new Ga4Error('ga4_payload_validation_failed');
      }
      const status = configured.mode === 'validate' ? 'validated' : 'submitted';
      await mark(db, row, {
        status, submitted_at: status === 'submitted' ? time.toISOString() : null,
        claimed_at: null, next_attempt_at: null, last_error: null,
      });
      counts[status]++;
    } catch (error) {
      const code = error instanceof Ga4Error ? error.message : 'ga4_delivery_error';
      // If the acknowledgement could not be saved, keep the sending claim. The
      // DB only retries purchase (stable transaction_id); checkout becomes uncertain.
      if (code === 'ga4_state_save_failed') throw error;
      const terminal = ['ga4_event_ineligible', 'ga4_event_expired', 'ga4_timestamp_invalid',
        'ga4_consent_or_identity_invalid', 'ga4_value_invalid', 'ga4_mode_mismatch',
        'ga4_payload_validation_failed'].includes(code);
      // Google explicitly asks callers to correct non-2xx requests, not retry
      // the same payload. Leave these for review in either mode. A transport
      // timeout is different: only purchase has a stable transaction dedupe key.
      const status = terminal ? 'suppressed' :
        code === 'ga4_provider_http_error' ||
        (dispatched && row.event_name === 'begin_checkout' && configured.mode === 'live') ? 'uncertain' : 'failed';
      const time = new Date(typeof now === 'function' ? now() : now);
      await mark(db, row, {
        status, claimed_at: null, last_error: code,
        next_attempt_at: status === 'failed' ? new Date(time.getTime() +
          5 * 60000 * 2 ** Math.min(Math.max(Number(row.attempts || 1) - 1, 0), 4)).toISOString() : null,
        ...(terminal ? { analytics_context: {} } : {}),
      });
      counts[status]++;
    }
  }
  return { status: 'completed', ...counts };
}

export async function purgeExpiredGa4Measurements(db) {
  // After activation, pause reporting with mode=off and retain the property ID.
  // Retention must continue even after the sending credential is removed; it
  // does not contact Google. Entirely unconfigured installations remain inert.
  if (!['off', 'validate', 'live'].includes(process.env.GA4_BOOKING_MEASUREMENT_MODE) ||
      !MEASUREMENT_ID.test(process.env.GA4_MEASUREMENT_ID || '')) return { status: 'disabled' };
  const { error } = await db.rpc('purge_expired_booking_ga4_measurement');
  if (error) throw new Ga4Error('ga4_retention_failed');
  return { status: 'completed' };
}
