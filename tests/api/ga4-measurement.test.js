import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverGa4Measurements, ga4MeasurementPayload, purgeExpiredGa4Measurements } from '../../api/_lib/ga4Measurement.js';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const ID = '11111111-1111-4111-8111-111111111111';
const context = (extra = {}) => ({
  client_id: '123456.654321', session_id: String(NOW.getTime() / 1000 - 600),
  measurement_id: 'G-TEST1234',
  captured_at: '2026-10-04T11:55:00.000Z', analytics: true, advertising: false,
  consent_version: '2026-07-14', consent_recorded_at: '2026-10-04T11:54:00.000Z',
  mode: 'live', ...extra,
});
const row = (extra = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', booking_id: ID,
  event_name: 'purchase', event_key: `booking:${ID}:purchase`, amount_pence: 4275,
  currency: 'gbp', occurred_at: '2026-10-04T11:59:00.000Z',
  analytics_context: context(), is_test: false, mode: 'live', status: 'pending',
  claimed_at: null, attempts: 0, ...extra,
});
const checkout = (extra = {}) => row({ event_name: 'begin_checkout', event_key: `booking:${ID}:begin_checkout`, ...extra });

function fakeDb(initialRow = row(), bookingPatch = {}) {
  let outbox = { ...initialRow };
  let booking = { ga4_context: { ...initialRow.analytics_context, mode: initialRow.mode },
    measurement_is_test: false, measurement_consent_withdrawn_at: null, ...bookingPatch };
  const db = {
    rpc: vi.fn(async (name, args) => {
      if (name === 'purge_expired_booking_ga4_measurement') return { error: null };
      if (!['pending', 'failed'].includes(outbox.status) || outbox.mode !== args.p_mode) return { data: [], error: null };
      outbox = { ...outbox, status: 'sending', claimed_at: NOW.toISOString(), attempts: outbox.attempts + 1 };
      return { data: [{ ...outbox }], error: null };
    }),
    from(table) {
      let patch;
      const filters = {};
      const query = {
        select() { return query; }, update(value) { patch = value; return query; },
        eq(key, value) { filters[key] = value; return query; },
        async maybeSingle() {
          if (table === 'bookings') return { data: { ...booking }, error: null };
          return { data: { ...outbox }, error: null };
        },
        then(resolve, reject) {
          const matches = patch && Object.entries(filters).every(([key, value]) => outbox[key] === value);
          if (matches) outbox = { ...outbox, ...patch };
          return Promise.resolve({ data: matches ? [{ id: outbox.id }] : [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    get row() { return outbox; },
    setBooking(patch) { booking = { ...booking, ...patch }; },
    setRow(patch) { outbox = { ...outbox, ...patch }; },
  };
  return db;
}
function configure(mode = 'live') {
  vi.stubEnv('GA4_BOOKING_MEASUREMENT_MODE', mode);
  vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST1234');
  vi.stubEnv('GA4_API_SECRET', 'synthetic-secret');
  vi.stubEnv('VERCEL_ENV', 'production');
}
const accepted = () => ({ ok: true, status: 204 });
afterEach(() => vi.unstubAllEnvs());

describe('GA4 authoritative payment payload', () => {
  it('uses actual ledger value and an opaque stable transaction, with no PII or private URL', () => {
    const payload = ga4MeasurementPayload(row({
      bank_reference: 'E1 1AA Customer', email: 'customer@example.invalid',
      analytics_context: context({ email: 'customer@example.invalid', address: '1 Customer Road',
        landing_page: '/manage-booking#private-token', payment_reference: 'E11AA041026' }),
    }), { now: NOW });
    expect(payload.events[0]).toEqual({ name: 'purchase', params: {
      currency: 'GBP', value: 42.75, transaction_id: `booking:${ID}:deposit`,
      session_id: context().session_id,
      items: [{ item_id: 'cleaning_deposit', item_name: 'Cleaning booking deposit', price: 42.75, quantity: 1 }],
    } });
    expect(payload.client_id).toBe(context().client_id);
    expect(payload.consent).toEqual({ ad_user_data: 'DENIED', ad_personalization: 'DENIED' });
    const serialized = JSON.stringify(payload);
    for (const forbidden of ['customer@', 'Customer Road', 'private-token', 'E11AA041026', 'engagement_time'])
      expect(serialized).not.toContain(forbidden);
  });

  it('describes deposit checkout separately without a purchase transaction', () => {
    const payload = ga4MeasurementPayload(checkout({ amount_pence: 1750 }), { now: NOW });
    expect(payload.events[0].name).toBe('begin_checkout');
    expect(payload.events[0].params.value).toBe(17.5);
    expect(payload.events[0].params.transaction_id).toBeUndefined();
  });

  it('does not invent add_payment_info from a click or payment receipt', () => {
    expect(() => ga4MeasurementPayload(row({ event_name: 'add_payment_info' }), { now: NOW })).toThrow('ga4_event_ineligible');
  });

  it('preserves client identity but omits a session more than 24h old', () => {
    const payload = ga4MeasurementPayload(row({ analytics_context: context({
      session_id: String(NOW.getTime() / 1000 - 90000), captured_at: '2026-10-02T11:00:00Z',
      consent_recorded_at: '2026-10-02T10:00:00Z',
    }) }), { now: NOW });
    expect(payload.client_id).toBe(context().client_id);
    expect(payload.events[0].params.session_id).toBeUndefined();
  });

  it.each(['name@example.invalid', '/private#token', '1.2.extra', '', 123.456, { toString: () => '123.456' }])('rejects invalid client identity %s', (client_id) => {
    expect(() => ga4MeasurementPayload(row({ analytics_context: context({ client_id }) }), { now: NOW }))
      .toThrow('ga4_consent_or_identity_invalid');
  });

  it.each([
    [{ is_test: true }, 'ga4_event_ineligible'],
    [{ amount_pence: 0 }, 'ga4_value_invalid'],
    [{ amount_pence: 1.2 }, 'ga4_value_invalid'],
    [{ currency: 'usd' }, 'ga4_value_invalid'],
    [{ event_key: 'customer-reference' }, 'ga4_event_ineligible'],
    [{ occurred_at: '2026-09-30T12:00:00Z' }, 'ga4_event_expired'],
    [{ occurred_at: '2026-10-05T12:00:00Z' }, 'ga4_timestamp_invalid'],
    [{ analytics_context: context({ analytics: false }) }, 'ga4_consent_or_identity_invalid'],
    [{ analytics_context: context({ consent_version: 'old' }) }, 'ga4_consent_or_identity_invalid'],
    [{ analytics_context: context({ consent_recorded_at: '' }) }, 'ga4_consent_or_identity_invalid'],
  ])('fails closed for ineligible data %#', (patch, code) => {
    expect(() => ga4MeasurementPayload(row(patch), { now: NOW })).toThrow(code);
  });
});

describe('GA4 separate delivery worker', () => {
  it('is disabled by default without claiming rows or sending data', async () => {
    vi.stubEnv('GA4_BOOKING_MEASUREMENT_MODE', '');
    const db = fakeDb(); const fetchImpl = vi.fn();
    expect(await deliverGa4Measurements(db, { fetchImpl })).toMatchObject({ status: 'disabled' });
    expect(db.rpc).not.toHaveBeenCalled(); expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks live delivery from hosted preview', async () => {
    configure(); vi.stubEnv('VERCEL_ENV', 'preview');
    const db = fakeDb();
    expect(await deliverGa4Measurements(db)).toMatchObject({ status: 'disabled' });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('submits once, does not claim ingestion, and does not replay on the next worker run', async () => {
    configure(); const db = fakeDb(); const fetchImpl = vi.fn(async () => accepted());
    const options = { fetchImpl, now: () => NOW };
    expect(await deliverGa4Measurements(db, options)).toMatchObject({ submitted: 1 });
    expect(db.row.status).toBe('submitted');
    expect(await deliverGa4Measurements(db, options)).toMatchObject({ status: 'idle' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('/mp/collect?measurement_id=G-TEST1234');
  });

  it('validates only against debug endpoint; validation rows never become live uploads', async () => {
    configure('validate');
    const db = fakeDb(row({ mode: 'validate' }));
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ validationMessages: [] }) }));
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ validated: 1, submitted: 0 });
    expect(fetchImpl.mock.calls[0][0]).toContain('/debug/mp/collect?');
    configure('live');
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ status: 'idle' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { measurement_is_test: true },
    { measurement_consent_withdrawn_at: NOW.toISOString() },
    { ga4_context: context({ analytics: false }) },
    { ga4_context: context({ client_id: '999.111' }) },
  ])('rechecks current consent/identity/test status before external send %#', async (booking) => {
    configure(); const db = fakeDb(row(), booking); const fetchImpl = vi.fn();
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ suppressed: 1 });
    expect(fetchImpl).not.toHaveBeenCalled(); expect(db.row.analytics_context).toEqual({});
  });

  it('uses analytics consent independently and honours later advertising rejection', async () => {
    configure(); const db = fakeDb(row({ analytics_context: context({ advertising: true }) }), { ga4_context: context() });
    const fetchImpl = vi.fn(async () => accepted());
    await deliverGa4Measurements(db, { fetchImpl, now: NOW });
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.consent.ad_user_data).toBe('DENIED');
  });

  it.each(['snapshot', 'current', 'configuration'])('prevents a %s property switch from misrouting GA identity', async (source) => {
    configure();
    const db = fakeDb(source === 'snapshot' ? row({ analytics_context: context({ measurement_id: 'G-OTHER1234' }) }) : row(),
      source === 'current' ? { ga4_context: context({ measurement_id: 'G-OTHER1234' }) } : {});
    if (source === 'configuration') vi.stubEnv('GA4_MEASUREMENT_ID', 'G-OTHER1234');
    const fetchImpl = vi.fn();
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ suppressed: 1 });
    expect(db.row.last_error).toBe('ga4_property_changed'); expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never sends an expired event under a false current timestamp', async () => {
    configure(); const db = fakeDb(row({ occurred_at: '2026-09-30T12:00:00Z' })); const fetchImpl = vi.fn();
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ suppressed: 1 });
    expect(db.row.last_error).toBe('ga4_event_expired'); expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('marks unknown checkout delivery uncertain instead of replaying it', async () => {
    configure(); const db = fakeDb(checkout());
    const fetchImpl = vi.fn(async () => { throw new Error('network may include synthetic-secret and PII'); });
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ uncertain: 1 });
    expect(db.row.last_error).toBe('ga4_delivery_error');
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ status: 'idle' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a purchase with exactly the same transaction and event time', async () => {
    configure(); const db = fakeDb();
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(accepted());
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ failed: 1 });
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ submitted: 1 });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(JSON.parse(fetchImpl.mock.calls[1][1].body));
  });

  it.each([400, 429, 500])('does not blindly resend HTTP %s responses that Google asks to correct', async (status) => {
    configure(); const db = fakeDb(); const fetchImpl = vi.fn(async () => ({ ok: false, status }));
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ uncertain: 1 });
    expect(db.row.last_error).toBe('ga4_provider_http_error');
    await deliverGa4Measurements(db, { fetchImpl, now: NOW });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not persist raw validation errors or provider response payloads', async () => {
    configure('validate'); const db = fakeDb(row({ mode: 'validate' }));
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({
      validationMessages: [{ description: 'private customer@example.invalid' }],
    }) }));
    expect(await deliverGa4Measurements(db, { fetchImpl, now: NOW })).toMatchObject({ suppressed: 1 });
    expect(db.row.last_error).toBe('ga4_payload_validation_failed');
    expect(JSON.stringify(db.row)).not.toContain('customer@example');
  });

  it('preserves sending status after a lost acknowledgement save', async () => {
    configure(); const db = fakeDb();
    const fetchImpl = vi.fn(async () => { db.setRow({ claimed_at: 'new-owner-claim' }); return accepted(); });
    await expect(deliverGa4Measurements(db, { fetchImpl, now: NOW })).rejects.toThrow('ga4_state_save_failed');
    expect(db.row.status).toBe('sending');
  });

  it('only invokes the separate retention RPC when GA4 is enabled', async () => {
    vi.stubEnv('GA4_BOOKING_MEASUREMENT_MODE', ''); const db = fakeDb();
    expect(await purgeExpiredGa4Measurements(db)).toEqual({ status: 'disabled' });
    configure(); expect(await purgeExpiredGa4Measurements(db)).toEqual({ status: 'completed' });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('purge_expired_booking_ga4_measurement');
  });

  it.each(['off', 'validate', 'live'])('continues retention in %s mode without a sending secret', async (mode) => {
    configure(mode); vi.stubEnv('GA4_API_SECRET', '');
    const db = fakeDb(); const fetchImpl = vi.fn();
    expect(await purgeExpiredGa4Measurements(db)).toEqual({ status: 'completed' });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('purge_expired_booking_ga4_measurement');
    expect(await deliverGa4Measurements(db, { fetchImpl })).toMatchObject({ status: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it('off mode stops delivery even with a valid secret while cleanup continues in preview', async () => {
    configure('off'); vi.stubEnv('VERCEL_ENV', 'preview');
    const db = fakeDb(); const fetchImpl = vi.fn();
    expect(await deliverGa4Measurements(db, { fetchImpl })).toMatchObject({ status: 'disabled' });
    expect(await purgeExpiredGa4Measurements(db)).toEqual({ status: 'completed' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('purge_expired_booking_ga4_measurement');
  });

  it('retention remains disabled without the installed property configuration', async () => {
    configure('off'); vi.stubEnv('GA4_MEASUREMENT_ID', '');
    const db = fakeDb();
    expect(await purgeExpiredGa4Measurements(db)).toEqual({ status: 'disabled' });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
