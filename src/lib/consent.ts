// Google Consent Mode v2 — cookie consent storage and gtag wiring.
//
// Two user-facing categories are offered (Analytics, Advertising); each maps
// onto one or more of Google's four consent signals. Essential storage used
// for the quote/booking/payment flow (see src/lib/attribution.ts and the
// sessionStorage keys in BookingPage.tsx/QuoteCalculator.tsx) is never
// gated here — it is required for the site to function and is out of scope
// for consent under UK PECR/GDPR guidance on strictly necessary cookies.
import { CONSENT_VERSION } from './consentVersion';

export const CONSENT_STORAGE_KEY = 'vve_consent';

export type ConsentChoice = 'accepted_all' | 'rejected_optional' | 'custom';

export interface ConsentCategories {
  analytics: boolean;
  advertising: boolean;
}

export interface StoredConsent extends ConsentCategories {
  choice: ConsentChoice;
  version: string;
  timestamp: string;
}

export type GtagConsentField =
  | 'ad_storage'
  | 'analytics_storage'
  | 'ad_user_data'
  | 'ad_personalization';

export type GtagConsentUpdate = Record<GtagConsentField, 'granted' | 'denied'>;

export const DEFAULT_DENIED_GTAG_CONSENT: GtagConsentUpdate = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

export const ACCEPT_ALL_CATEGORIES: ConsentCategories = { analytics: true, advertising: true };
export const REJECT_OPTIONAL_CATEGORIES: ConsentCategories = { analytics: false, advertising: false };

export function categoriesToGtagUpdate(categories: ConsentCategories): GtagConsentUpdate {
  const state = categories.advertising ? 'granted' : 'denied';
  return {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: categories.analytics ? 'granted' : 'denied',
  };
}

export function getStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.version !== CONSENT_VERSION) return null; // policy changed — re-prompt
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.advertising !== 'boolean') return null;
    return {
      analytics: parsed.analytics,
      advertising: parsed.advertising,
      choice: parsed.choice ?? 'custom',
      version: parsed.version,
      timestamp: parsed.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return null; // storage unavailable or corrupt — treat as not-yet-decided
  }
}

export function saveConsent(categories: ConsentCategories, choice: ConsentChoice): StoredConsent {
  const consent: StoredConsent = {
    ...categories,
    choice,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    /* ignore — localStorage may be unavailable (private browsing, quota) */
  }
  return consent;
}

export function applyConsentToGtag(categories: ConsentCategories): void {
  const gtagFn = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtagFn !== 'function') return;
  gtagFn('consent', 'update', categoriesToGtagUpdate(categories));
}
