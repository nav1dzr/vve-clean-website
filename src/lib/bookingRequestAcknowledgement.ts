// Essential, tab-scoped refresh recovery. Never persist the reference (which
// contains a postcode/date), contact details, service, or submitted form here.
export const BOOKING_ACKNOWLEDGEMENT_KEY = 'vve_booking_acknowledgement_v1';
export const BOOKING_ACKNOWLEDGEMENT_TTL = 30 * 60 * 1000;

export function rememberBookingAcknowledgement(now = Date.now()): void {
  try {
    sessionStorage.setItem(BOOKING_ACKNOWLEDGEMENT_KEY, JSON.stringify({
      version: 1, expires: now + BOOKING_ACKNOWLEDGEMENT_TTL,
    }));
  } catch { /* The in-memory success screen still works with storage blocked. */ }
}

export function hasBookingAcknowledgement(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(BOOKING_ACKNOWLEDGEMENT_KEY);
    if (!raw) return false;
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)
      && 'version' in value && value.version === 1
      && 'expires' in value && typeof value.expires === 'number'
      && Number.isFinite(value.expires) && value.expires > now
      && value.expires <= now + BOOKING_ACKNOWLEDGEMENT_TTL) return true;
    clearBookingAcknowledgement();
  } catch { /* Invalid or unavailable storage is optional. */ }
  return false;
}

export function clearBookingAcknowledgement(): void {
  try { sessionStorage.removeItem(BOOKING_ACKNOWLEDGEMENT_KEY); }
  catch { /* Optional storage must not prevent starting another request. */ }
}
