import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  ACCEPT_ALL_CATEGORIES,
  REJECT_OPTIONAL_CATEGORIES,
  categoriesToGtagUpdate,
  getStoredConsent,
  saveConsent,
  applyConsentToGtag,
} from './consent';
import { CONSENT_VERSION } from './consentVersion';

beforeEach(() => {
  localStorage.clear();
  // @ts-expect-error test-only cleanup of a global set by other tests
  delete window.gtag;
});

describe('consent.ts — Consent Mode v2 category mapping', () => {
  it('maps accept-all to all four signals granted', () => {
    expect(categoriesToGtagUpdate(ACCEPT_ALL_CATEGORIES)).toEqual({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });

  it('maps reject-optional to all four signals denied (matches the page-load default)', () => {
    expect(categoriesToGtagUpdate(REJECT_OPTIONAL_CATEGORIES)).toEqual({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('grants only analytics_storage when analytics is chosen but not advertising', () => {
    expect(categoriesToGtagUpdate({ analytics: true, advertising: false })).toEqual({
      ad_storage: 'denied',
      analytics_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('grants ad_storage, ad_user_data and ad_personalization together when advertising is chosen', () => {
    expect(categoriesToGtagUpdate({ analytics: false, advertising: true })).toEqual({
      ad_storage: 'granted',
      analytics_storage: 'denied',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });
});

describe('consent.ts — storage round-trip', () => {
  it('returns null when nothing has been saved yet (first visit)', () => {
    expect(getStoredConsent()).toBeNull();
  });

  it('saves and reads back the same categories, tagged with the current version', () => {
    saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all');
    const stored = getStoredConsent();
    expect(stored).not.toBeNull();
    expect(stored!.analytics).toBe(true);
    expect(stored!.advertising).toBe(true);
    expect(stored!.choice).toBe('accepted_all');
    expect(stored!.version).toBe(CONSENT_VERSION);
    expect(typeof stored!.timestamp).toBe('string');
  });

  it('writes under the exact key "vve_consent" (confirmation.html already reads this key for diagnostics)', () => {
    saveConsent(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional');
    expect(CONSENT_STORAGE_KEY).toBe('vve_consent');
    expect(localStorage.getItem('vve_consent')).not.toBeNull();
  });

  it('treats a stored consent from an older policy version as unset, so the banner re-prompts', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: true, advertising: true, choice: 'accepted_all', version: '2020-01-01', timestamp: 'x' }),
    );
    expect(getStoredConsent()).toBeNull();
  });

  it('treats corrupt JSON as unset rather than throwing', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, '{not json');
    expect(getStoredConsent()).toBeNull();
  });
});

describe('consent.ts — applying to gtag', () => {
  it('calls window.gtag("consent", "update", ...) with the mapped signals when gtag exists', () => {
    const gtagSpy = vi.fn();
    // @ts-expect-error test-only global assignment
    window.gtag = gtagSpy;
    applyConsentToGtag(ACCEPT_ALL_CATEGORIES);
    expect(gtagSpy).toHaveBeenCalledWith('consent', 'update', categoriesToGtagUpdate(ACCEPT_ALL_CATEGORIES));
  });

  it('does not throw when window.gtag is not yet defined', () => {
    expect(() => applyConsentToGtag(REJECT_OPTIONAL_CATEGORIES)).not.toThrow();
  });
});
