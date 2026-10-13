// Optional metadata must not relax the request's business validation. The
// server controls mode/property; this cannot be enabled by a browser payload.
const CONSENT_VERSION = '2026-07-14';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function recentTimestamp(value, now, maxAge) {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now + 60_000 &&
    parsed >= now - maxAge && new Date(parsed).toISOString() === value;
}

export function normaliseGa4Context(value, { env = process.env, now = Date.now() } = {}) {
  if (!['validate', 'live'].includes(env.GA4_BOOKING_MEASUREMENT_MODE) ||
      !/^G-[A-Z0-9]+$/.test(env.GA4_MEASUREMENT_ID || '') ||
      !value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.analytics !== true || typeof value.advertising !== 'boolean' ||
      value.consent_version !== CONSENT_VERSION ||
      value.measurement_id !== env.GA4_MEASUREMENT_ID ||
      typeof value.client_id !== 'string' || !/^\d{1,20}\.\d{1,20}$/.test(value.client_id) ||
      !recentTimestamp(value.captured_at, now, 24 * 60 * 60 * 1000) ||
      !recentTimestamp(value.consent_recorded_at, now, 366 * 24 * 60 * 60 * 1000)) return null;
  return {
    measurement_id: env.GA4_MEASUREMENT_ID,
    client_id: value.client_id,
    ...(typeof value.session_id === 'string' && /^\d{1,20}$/.test(value.session_id)
      ? { session_id: value.session_id } : {}),
    captured_at: value.captured_at,
    consent_version: CONSENT_VERSION,
    consent_recorded_at: value.consent_recorded_at,
    analytics: true,
    advertising: value.advertising,
    mode: env.GA4_BOOKING_MEASUREMENT_MODE,
  };
}

// Analytics is optional. A missing migration or metadata write must never
// turn an already committed customer request into a reported booking failure.
export async function saveGa4Context(db, bookingId, raw) {
  const context = normaliseGa4Context(raw);
  if (!context) return;
  try {
    const { error } = await db.from('bookings').update({ ga4_context: context }).eq('id', bookingId);
    if (error) throw new Error('ga4_context_save_failed');
  } catch {
    console.warn('[booking-request] optional GA4 context was not saved');
  }
}
