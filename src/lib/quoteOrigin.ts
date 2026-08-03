// Remembers which quote the customer came from, so "Back to quote" on the
// Booking page returns them to it.
//
// Navigation state only. This never touches the booking payload, the price,
// the deposit or anything the server validates — it is a separate sessionStorage
// key read by exactly one link.
//
// Before this existed the link was hard-coded to '/#quote' (or '/leaflet#quote'
// for a leaflet booking), so a customer who built a quote on the Carpet or Sofa
// page was dropped on the homepage calculator instead, with their selections
// gone. The restore flag still carries the selections themselves; this only
// fixes *where* they are restored.

const ORIGIN_KEY = 'vve_quote_origin';

/** Routes a quote can legitimately be built on. Anything else is ignored. */
const ALLOWED_PATHS = new Set([
  '/',
  '/leaflet',
  '/booking',
  '/carpet-cleaning-london',
  '/sofa-cleaning-london',
  '/commercial-carpet-cleaning-london',
  '/end-of-tenancy-cleaning-london',
  '/after-builders-cleaning-london',
]);

/**
 * Records the current route as the quote's origin. Called at the moment of
 * navigating to /booking, which is the only time the origin is known.
 */
export function rememberQuoteOrigin(pathname: string = window.location.pathname): void {
  try {
    // Normalise a trailing slash so '/carpet-cleaning-london/' matches.
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    if (!ALLOWED_PATHS.has(path)) return;
    sessionStorage.setItem(ORIGIN_KEY, path);
  } catch {
    /* sessionStorage unavailable — the caller falls back to the default */
  }
}

/**
 * Where "Back to quote" should go. Falls back to the previous hard-coded
 * behaviour when nothing was recorded (e.g. the customer opened /booking
 * directly, or storage is unavailable).
 *
 * `isLeaflet` keeps the existing leaflet special case working for a booking
 * restored from storage in a fresh tab, where no origin was recorded.
 */
export function getQuoteOriginHref(isLeaflet = false): string {
  const fallback = isLeaflet ? '/leaflet#quote' : '/#quote';
  try {
    const stored = sessionStorage.getItem(ORIGIN_KEY);
    if (!stored || !ALLOWED_PATHS.has(stored)) return fallback;
    // /booking is a valid place to build a quote (the no-selection state shows
    // the calculator) but is useless as a destination — it is where we are.
    if (stored === '/booking') return fallback;
    // Keep the leading slash for the homepage: a bare '#quote' is a relative
    // hash, which react-router would resolve against /booking.
    return `${stored}#quote`;
  } catch {
    return fallback;
  }
}

/** Clears the recorded origin. */
export function clearQuoteOrigin(): void {
  try {
    sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    /* nothing to clear */
  }
}
