// Campaign attribution — remembered in memory on entry, written to localStorage
// only after the visitor grants advertising consent, read on booking submit.
//
// ── What this is for ─────────────────────────────────────────────────────────
// Capture used to happen on /leaflet only (setLeafletAttribution). Every other
// entry point recorded nothing, so a Google Ads click landing on the homepage or
// a service page arrived at the booking form with no gclid and no utm_*: the
// spend could not be tied to the revenue in the CRM.
//
// ── Why it is behind consent ─────────────────────────────────────────────────
// The first fix for that ran on every page load and wrote utm_* and gclid to
// localStorage the moment the page rendered — before the cookie banner had even
// been answered. That is advertising measurement, not storage strictly
// necessary to deliver a service the visitor asked for, so under UK PECR it
// needs consent like any other advertising storage. The site already has a
// consent mechanism (src/context/CookieConsentContext.tsx); this now uses it.
//
// The shape of the solution matters. A naive "only capture if already
// consented" loses the campaign entirely, because the banner is answered
// several seconds after the landing URL has been replaced by ordinary
// navigation. So the entry URL is held in a module variable — memory, not
// storage, nothing persisted and nothing sent — and written only if and when
// advertising consent arrives. Accept on page five and the original ad click is
// still the one recorded.
//
// ── Essential vs advertising ─────────────────────────────────────────────────
// Two things were tangled together in the leaflet flow:
//   • the discount (offer_code, discount_percent) — the visitor scanned a
//     leaflet promising 20% off and asked us to honour it. Remembering which
//     offer to apply is fulfilling their request, so it is essential storage
//     and is written regardless of consent (setLeafletOffer);
//   • the measurement (first_source, last_source, landing_page, utm_*, gclid) —
//     which is for us, not for them, and is gated.
// They are now separate functions. Rejecting advertising costs the visitor
// nothing: the discount still applies, the quote still calculates, the booking
// still submits.
//
// ── Boundaries that have not changed ─────────────────────────────────────────
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
 * Every key that exists for advertising measurement.
 *
 * Nothing in this list may be written before advertising consent, and every
 * one of them is removed if consent is withdrawn. offer_code and
 * discount_percent are deliberately absent — they fulfil a discount the visitor
 * asked for and are essential storage.
 */
export const ADVERTISING_KEYS = [
  KEYS.first_source,
  KEYS.last_source,
  KEYS.landing_page,
  KEYS.utm_source,
  KEYS.utm_medium,
  KEYS.utm_campaign,
  KEYS.utm_content,
  KEYS.gclid,
] as const;

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

// ── In-memory entry record ───────────────────────────────────────────────────
// Module state, deliberately. It lives for one page load, is never serialised,
// never leaves the tab, and is discarded if consent never arrives.

interface EntrySnapshot {
  search: string;
  pathname: string;
}

let entry: EntrySnapshot | null = null;
let leafletVisit = false;
let advertisingConsent = false;

/**
 * Records where this visit started, in memory only.
 *
 * Write-once per page load: the point is the ORIGINAL entry URL, so an internal
 * navigation to /pricing must not replace an ad click that landed on /.
 * Persists nothing — see persistIfConsented().
 */
export function rememberEntry(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  pathname: string = typeof window === 'undefined' ? '/' : window.location.pathname,
): void {
  if (!entry) entry = { search, pathname };
  persistIfConsented();
}

/**
 * Notes that the visitor came through /leaflet and writes the essential half of
 * that: which offer to honour.
 *
 * The offer code is written immediately and unconditionally. The visitor
 * scanned a leaflet promising a discount and asked for it to be applied;
 * storing the code is how we deliver what they requested, and it is not used
 * for advertising on its own. The source/campaign half is remembered in memory
 * and waits for consent like everything else.
 */
export function markLeafletVisit(): void {
  leafletVisit = true;
  rememberEntry();
  setLeafletOffer();
  persistIfConsented();
}

/** Essential storage: the discount the leaflet promised. Never consent-gated. */
export function setLeafletOffer(): void {
  try {
    localStorage.setItem(KEYS.offer_code,       'LEAFLET20');
    localStorage.setItem(KEYS.discount_percent, '20');
  } catch { /* ignore — localStorage may be unavailable */ }
}

/**
 * The consent gate. Call whenever the visitor's advertising choice is known or
 * changes.
 *
 * `true`  — write the attribution remembered since entry, even if the banner
 *           was answered several pages later. This is what makes late consent
 *           still credit the original ad click.
 * `false` — remove every advertising key. Only call this on an explicit
 *           rejection, not while the banner is merely unanswered; see
 *           components/CampaignAttribution.tsx.
 */
export function setAdvertisingConsent(granted: boolean): void {
  advertisingConsent = granted;
  if (granted) persistIfConsented();
  else clearAdvertisingAttribution();
}

/** True once advertising consent has been granted in this page load. */
export function hasAdvertisingConsent(): boolean {
  return advertisingConsent;
}

/** Removes every advertising key, leaving essential offer storage intact. */
export function clearAdvertisingAttribution(): void {
  try {
    for (const key of ADVERTISING_KEYS) localStorage.removeItem(key);
  } catch { /* ignore — localStorage may be unavailable */ }
}

/**
 * Writes what has been remembered, if and only if advertising consent is held.
 * Idempotent: every write below is either write-once or writes the same value
 * again, so calling this on entry, on consent and on a later leaflet visit is
 * safe in any order.
 */
function persistIfConsented(): void {
  if (!advertisingConsent) return;
  // Leaflet first, then the entry URL — the same order the two effects ran in
  // before, so a /leaflet?gclid=… landing still ends up with last_source
  // 'google-ads' and utm_source 'leaflet', exactly as it did.
  if (leafletVisit) writeLeafletAttribution();
  if (entry) writeAdvertisingAttribution(entry.search, entry.pathname);
}

/**
 * Writes campaign attribution to localStorage immediately.
 *
 * DIRECT CALLERS MUST ALREADY HOLD ADVERTISING CONSENT. In the app the only
 * caller is persistIfConsented() above; it is exported so the storage rules
 * below can be tested in isolation.
 *
 * First-touch values (`first_source`, `landing_page`) are written once and then
 * never replaced — that is the point of first-touch. `last_source` and the
 * `utm_*` set are only updated when the URL actually carries campaign
 * parameters, so an internal navigation cannot overwrite a real campaign source
 * with "direct".
 */
export function writeAdvertisingAttribution(search: string, pathname: string): void {
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

/**
 * The advertising half of the old setLeafletAttribution: which campaign brought
 * them, not which discount to give them. Consent-gated via persistIfConsented.
 */
export function writeLeafletAttribution(): void {
  try {
    // first_source is write-once — only set if not already recorded
    if (!localStorage.getItem(KEYS.first_source)) {
      localStorage.setItem(KEYS.first_source, 'leaflet');
    }
    // last_source always reflects the current visit
    localStorage.setItem(KEYS.last_source,      'leaflet');
    localStorage.setItem(KEYS.landing_page,     '/leaflet');
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

/** Test-only: drops the in-memory entry record so cases cannot bleed together. */
export function resetAttributionMemory(): void {
  entry = null;
  leafletVisit = false;
  advertisingConsent = false;
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
