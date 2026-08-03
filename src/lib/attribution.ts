// Campaign attribution — written to localStorage on entry, read on booking submit.
//
// Capture used to happen on /leaflet only (setLeafletAttribution). Every other
// entry point recorded nothing, so a Google Ads click landing on the homepage or
// a service page arrived at the booking form with no gclid and no utm_*: the
// spend could not be tied to the revenue in the CRM. captureAttribution() now
// runs once per page load on any public route.
//
// Deliberate boundaries:
//   • Nothing is transmitted here. Values sit in localStorage and are read only
//     by BookingPage when the customer submits a booking they chose to make.
//   • Nothing is rendered. These values never appear in page content.
//   • Google Ads conversion logic is untouched — this only records the click id
//     alongside the booking; it does not fire, alter or gate any conversion.
//
// utm_term is deliberately NOT captured. It is unsupported end to end — absent
// from api/create-checkout-session.js, api/stripe-webhook.js, the CRM's
// bookingFields.js allow-list and the bookings row mapping — so capturing it
// would silently drop it at the API boundary and imply a coverage that does not
// exist. Adding it means an API and database change, which is out of scope here.

export interface AttributionData {
  first_source:    string | null;
  last_source:     string | null;
  landing_page:    string | null;
  offer_code:      string | null;
  discount_percent: number | null;
  utm_source:      string | null;
  utm_medium:      string | null;
  utm_campaign:    string | null;
  utm_content:     string | null;
  gclid:           string | null;
}

const KEYS = {
  first_source:     'vve_first_source',
  last_source:      'vve_last_source',
  landing_page:     'vve_landing_page',
  offer_code:       'vve_offer_code',
  discount_percent: 'vve_discount_percent',
  utm_source:       'vve_utm_source',
  utm_medium:       'vve_utm_medium',
  utm_campaign:     'vve_utm_campaign',
  utm_content:      'vve_utm_content',
  gclid:            'vve_gclid',
};

/**
 * Campaign parameters carried end-to-end into the CRM. This list is exactly
 * what api/create-checkout-session.js accepts and the bookings table stores —
 * anything added here without the matching API and schema change is dropped
 * silently at the boundary.
 */
const CAPTURED_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid'] as const;
type CapturedParam = typeof CAPTURED_PARAMS[number];

/** The API truncates these to 500 chars; match it so what we store is sendable. */
const MAX_VALUE_LENGTH = 500;

/**
 * Records campaign attribution for this visit. Safe to call on any public
 * route; call it once per page load.
 *
 * First-touch values (`first_source`, `landing_page`) are written once and then
 * never replaced — that is the point of first-touch. `last_source` and the
 * `utm_*` set are only updated when the URL actually carries campaign
 * parameters, so an internal navigation cannot overwrite a real campaign source
 * with "direct".
 */
export function captureAttribution(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  pathname: string = typeof window === 'undefined' ? '/' : window.location.pathname,
): void {
  try {
    const params = new URLSearchParams(search);
    const present = {} as Partial<Record<CapturedParam, string>>;
    for (const key of CAPTURED_PARAMS) {
      const value = params.get(key)?.trim();
      if (value) present[key] = value.slice(0, MAX_VALUE_LENGTH);
    }

    // A gclid with no utm_source is still a paid click; name it rather than
    // recording the visit as organic.
    const source = present.utm_source ?? (present.gclid ? 'google-ads' : null);

    // ── First touch: write-once ──
    if (!localStorage.getItem(KEYS.landing_page)) {
      localStorage.setItem(KEYS.landing_page, pathname);
    }
    if (!localStorage.getItem(KEYS.first_source)) {
      localStorage.setItem(KEYS.first_source, source ?? 'direct');
    }

    // ── Latest touch: only when this URL genuinely carries a campaign ──
    if (source) {
      localStorage.setItem(KEYS.last_source, source);
    }
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const) {
      const value = present[key];
      if (value) localStorage.setItem(KEYS[key], value);
    }

    // gclid stays write-once. It is the key Google Ads matches a conversion
    // against; replacing it would change which click gets credited.
    if (present.gclid && !localStorage.getItem(KEYS.gclid)) {
      localStorage.setItem(KEYS.gclid, present.gclid);
    }
  } catch {
    // localStorage unavailable (private mode, storage disabled) — attribution
    // is best-effort and must never block a booking.
  }
}

export function setLeafletAttribution(): void {
  try {
    // first_source is write-once — only set if not already recorded
    if (!localStorage.getItem(KEYS.first_source)) {
      localStorage.setItem(KEYS.first_source, 'leaflet');
    }
    // last_source always reflects the current visit
    localStorage.setItem(KEYS.last_source,      'leaflet');
    localStorage.setItem(KEYS.landing_page,     '/leaflet');
    localStorage.setItem(KEYS.offer_code,       'LEAFLET20');
    localStorage.setItem(KEYS.discount_percent, '20');
    localStorage.setItem(KEYS.utm_source,       'leaflet');
    localStorage.setItem(KEYS.utm_medium,       'qr');
    localStorage.setItem(KEYS.utm_campaign,     'leaflet20');
    localStorage.setItem(KEYS.utm_content,      '');
    // Capture gclid from URL if present (Google click ID)
    const urlGclid = new URLSearchParams(window.location.search).get('gclid');
    if (urlGclid && !localStorage.getItem(KEYS.gclid)) {
      localStorage.setItem(KEYS.gclid, urlGclid);
    }
  } catch { /* ignore — localStorage may be unavailable */ }
}

export function getAttribution(): AttributionData {
  try {
    const pct = localStorage.getItem(KEYS.discount_percent);
    return {
      first_source:     localStorage.getItem(KEYS.first_source),
      last_source:      localStorage.getItem(KEYS.last_source),
      landing_page:     localStorage.getItem(KEYS.landing_page),
      offer_code:       localStorage.getItem(KEYS.offer_code),
      discount_percent: pct !== null ? Number(pct) : null,
      utm_source:       localStorage.getItem(KEYS.utm_source),
      utm_medium:       localStorage.getItem(KEYS.utm_medium),
      utm_campaign:     localStorage.getItem(KEYS.utm_campaign),
      utm_content:      localStorage.getItem(KEYS.utm_content),
      gclid:            localStorage.getItem(KEYS.gclid),
    };
  } catch {
    return {
      first_source: null, last_source: null, landing_page: null,
      offer_code: null, discount_percent: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, gclid: null,
    };
  }
}
