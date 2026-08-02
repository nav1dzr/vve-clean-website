// The restore mapper is the only new code between a stored booking and the
// premium quote's state, so it is pinned directly: it must never invent a
// selection, and never let an unusable payload through.

import { beforeEach, describe, expect, it } from 'vitest';
import { eotStateFromConfig, isEotQuoteConfig, peekEotRestore } from './restoreEotQuote';

type Config = Parameters<typeof eotStateFromConfig>[0];

const EOT_CONFIG = {
  service: 'deep',
  deepService: 'end_of_tenancy',
  deepSize: 'bed3',
  deepBaths: 2,
  addOnCounts: { carpet_bundle: 1, extra_wc: 2, reception: 0 },
  propertyType: 'house',
  eotScopeExclusions: ['oven'],
} as unknown as Config;

beforeEach(() => sessionStorage.clear());

describe('isEotQuoteConfig', () => {
  it('recognises only End of Tenancy quotes', () => {
    expect(isEotQuoteConfig(EOT_CONFIG)).toBe(true);
    expect(isEotQuoteConfig({ deepService: 'carpet_upholstery' } as unknown as Config)).toBe(false);
    expect(isEotQuoteConfig(null)).toBe(false);
    expect(isEotQuoteConfig(undefined)).toBe(false);
  });
});

describe('peekEotRestore', () => {
  it('returns null without the flag, even when a booking is stored', () => {
    sessionStorage.setItem('vve_booking', JSON.stringify({ quoteConfig: EOT_CONFIG }));
    expect(peekEotRestore()).toBeNull();
  });

  it('returns the config when the flag and an EOT booking are both present', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({ quoteConfig: EOT_CONFIG }));
    expect(peekEotRestore()).toMatchObject({ deepService: 'end_of_tenancy', deepSize: 'bed3' });
  });

  it('does not consume the flag', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({ quoteConfig: EOT_CONFIG }));
    peekEotRestore();
    // QuoteCalculator still needs to see it for every non-EOT service.
    expect(sessionStorage.getItem('vve_restore_quote')).toBe('1');
  });

  it('ignores a non-EOT booking so the existing calculator keeps handling it', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      quoteConfig: { deepService: 'carpet_upholstery' },
    }));
    expect(peekEotRestore()).toBeNull();
  });

  it('survives malformed storage', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', 'not json');
    expect(peekEotRestore()).toBeNull();
  });
});

describe('eotStateFromConfig', () => {
  it('maps a complete config', () => {
    expect(eotStateFromConfig(EOT_CONFIG)).toEqual({
      propertyType: 'house',
      size: 'bed3',
      bathrooms: 2,
      // carpet_bundle is lifted to its own flag; zero-quantity items dropped.
      counts: { extra_wc: 2 },
      carpetWholeHome: true,
      scopeExclusions: ['oven'],
    });
  });

  it('drops a size the premium quote does not offer', () => {
    const out = eotStateFromConfig({ ...EOT_CONFIG, deepSize: 'penthouse' } as unknown as Config);
    expect(out.size).toBeUndefined();
  });

  it('drops an invalid bathroom count rather than passing it through', () => {
    expect(eotStateFromConfig({ ...EOT_CONFIG, deepBaths: -4 } as unknown as Config).bathrooms)
      .toBeUndefined();
    expect(eotStateFromConfig({ ...EOT_CONFIG, deepBaths: 'two' } as unknown as Config).bathrooms)
      .toBeUndefined();
  });

  it('drops an invalid property type', () => {
    expect(eotStateFromConfig({ ...EOT_CONFIG, propertyType: 'castle' } as unknown as Config).propertyType)
      .toBeUndefined();
  });

  it('returns an empty state for an empty config, inventing nothing', () => {
    expect(eotStateFromConfig({} as Config)).toEqual({});
  });

  it('treats a missing carpet bundle as not selected', () => {
    const out = eotStateFromConfig({ ...EOT_CONFIG, addOnCounts: { extra_wc: 1 } } as unknown as Config);
    expect(out.carpetWholeHome).toBe(false);
    expect(out.counts).toEqual({ extra_wc: 1 });
  });
});
