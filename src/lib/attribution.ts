import { isPrivatePage } from './privatePage';
// Campaign measurement waits for advertising consent. The requested leaflet offer
// is separate essential storage; rejecting cookies never removes the discount.
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
  captured_at:      'vve_attribution_captured_at',
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
  KEYS.captured_at,
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
  if (isPrivatePage(pathname)) return;
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
 * `false` — no current permission. Remove every advertising key and stop
 *           reading them (see getAttribution). Call this for an explicit
 *           rejection AND for every state that is not an affirmative yes:
 *           undecided, missing, corrupt, or carrying a superseded consent
 *           version. An earlier version of this file cleared only on an
 *           explicit rejection, which left keys written by the pre-consent
 *           implementation sitting in storage — readable, and transmittable at
 *           booking — for any visitor who had not answered the banner. Absence
 *           of consent is not permission.
 *
 * The in-memory entry snapshot is deliberately NOT discarded here: it is the
 * current visit's own URL, held in memory, and it is what gets written if the
 * visitor goes on to accept.
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
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i));
    for (const key of keys) if (key?.startsWith('vve_measured_')) sessionStorage.removeItem(key);
  } catch { /* Session storage may also be unavailable. */ }
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
  if (isPrivatePage(pathname)) return;
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

    expireAttribution();
    if (!localStorage.getItem(KEYS.landing_page)) localStorage.setItem(KEYS.landing_page, pathname.split(/[?#]/)[0].slice(0, MAX_VALUE_LENGTH));
    if (!localStorage.getItem(KEYS.first_source)) localStorage.setItem(KEYS.first_source, source ?? 'direct');
    // Replace the whole latest campaign together. A new paid click must never
    // inherit a different campaign's old click ID, content or medium.
    if (Object.keys(present).length) {
      localStorage.setItem(KEYS.last_source, source ?? 'campaign');
      for (const key of CAPTURED_PARAMS) {
        if (present[key]) localStorage.setItem(KEYS[key], present[key]!);
        else localStorage.removeItem(KEYS[key]);
      }
      localStorage.setItem(KEYS.captured_at, new Date().toISOString());
    } else if (!localStorage.getItem(KEYS.captured_at)) {
      localStorage.setItem(KEYS.captured_at, new Date().toISOString());
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
  writeAdvertisingAttribution('?utm_source=leaflet&utm_medium=qr&utm_campaign=leaflet20', '/leaflet');
}

const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
function expireAttribution(): void {
  const captured = localStorage.getItem(KEYS.captured_at);
  const timestamp = captured ? Date.parse(captured) : NaN;
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > ATTRIBUTION_MAX_AGE || timestamp > Date.now() + 60000) clearAdvertisingAttribution();
}

/** Test-only: drops the in-memory entry record so cases cannot bleed together. */
export function resetAttributionMemory(): void {
  entry = null;
  leafletVisit = false;
  advertisingConsent = false;
}

/** The advertising half of the payload, blanked. */
const NO_ADVERTISING_ATTRIBUTION = {
  first_source: null, last_source: null, landing_page: null,
  utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, gclid: null,
} as const;

/**
 * The shape BookingPage sends to the API.
 *
 * Consent-safe by construction: without current advertising consent the
 * advertising keys are not even read, and every campaign field comes back null.
 * Clearing storage (setAdvertisingConsent(false)) and refusing to read it are
 * belt and braces on purpose — clearing can fail if localStorage throws, a
 * stale key can be written by an older build still cached in a visitor's
 * browser, or another tab can race us. This function is the last thing standing
 * between storage and the network, so it fails closed: the module-level flag
 * starts `false`, which means a caller who somehow runs before the consent
 * state is known transmits nothing rather than transmitting without permission.
 *
 * offer_code and discount_percent are always returned. They are essential
 * storage — the discount the visitor asked us to apply — and BookingPage needs
 * them to honour it.
 */
export function getAttribution(): AttributionData {
  try {
    const pct = localStorage.getItem(KEYS.discount_percent);
    const essential = {
      offer_code:       localStorage.getItem(KEYS.offer_code),
      discount_percent: pct !== null ? Number(pct) : null,
    };

    if (!advertisingConsent) return { ...NO_ADVERTISING_ATTRIBUTION, ...essential };
    expireAttribution();

    return {
      ...essential,
      first_source:     localStorage.getItem(KEYS.first_source),
      last_source:      localStorage.getItem(KEYS.last_source),
      landing_page:     localStorage.getItem(KEYS.landing_page),
      utm_source:       localStorage.getItem(KEYS.utm_source),
      utm_medium:       localStorage.getItem(KEYS.utm_medium),
      utm_campaign:     localStorage.getItem(KEYS.utm_campaign),
      utm_content:      localStorage.getItem(KEYS.utm_content),
      gclid:            localStorage.getItem(KEYS.gclid),
    };
  } catch {
    return { ...NO_ADVERTISING_ATTRIBUTION, offer_code: null, discount_percent: null };
  }
}
