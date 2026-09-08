import { describe, expect, it } from 'vitest';
import { createPricingCatalogue, getWebsitePricebookFields, validateWebsitePricebook } from '../../shared/pricingCatalogue.js';
import { validatePricebookSnapshot } from '../lib/websitePricebook';

describe('immutable published website pricebooks', () => {
  it('retains all currently approved base amounts and the protected deposit', () => {
    const prices = createPricingCatalogue();
    expect(prices.CARPET_ITEM_PRICES_P.sofa_2).toBe(7000);
    expect(prices.CARPET_ITEM_PRICES_P.mattress_king).toBe(6500);
    expect(prices.EOT_PRICES_P.flat.bed1.complete).toBe(27900);
    expect(prices.DEPOSIT_P).toBe(3000);
    expect(prices.EOT_GUARANTEE_HOURS).toBe(168);
  });
  it('isolates concurrent versions and derives calculator totals from each one', () => {
    const original = createPricingCatalogue();
    const edited = createPricingCatalogue({ CARPET_ITEM_PRICES_P: { bedroom: 6000 } });
    expect(original.computeCarpetPrice({ bedroom: 2 }, 'normal').finalTotal).toBe(100);
    expect(edited.computeCarpetPrice({ bedroom: 2 }, 'normal').finalTotal).toBe(120);
    expect(original.CARPET_ITEM_PRICES_P.bedroom).toBe(5000);
    expect(edited.CARPET_ITEM_PRICES_P.sofa_2).toBe(7000);
  });
  it('recomputes EOT aliases and commercial minimums from the chosen version', () => {
    const prices = createPricingCatalogue({ EOT_PRICES_P: { flat: { bed1: { complete: 28000 } } }, COMMERCIAL_REGULAR_HOURLY_P: 3000 });
    expect(prices.EOT_BASE_PRICES_P.bed1).toBe(28000);
    expect(prices.calculateEotQuote({ size: 'bed1', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0 }).totalP).toBe(28000);
    expect(prices.COMMERCIAL_REGULAR_MIN_CHARGE_P).toBe(6000);
  });
  it('copies the input and freezes nested prices so later writes cannot change a quote', () => {
    const input = { CARPET_ITEM_PRICES_P: { bedroom: 6000 } };
    const prices = createPricingCatalogue(input);
    input.CARPET_ITEM_PRICES_P.bedroom = 9000;
    expect(prices.CARPET_ITEM_PRICES_P.bedroom).toBe(6000);
    expect(Object.isFrozen(prices.CARPET_ITEM_PRICES_P)).toBe(true);
  });
  it.each([
    { DEPOSIT_P: 1 }, { EOT_GUARANTEE_HOURS: 24 }, { COVERAGE_POSTCODES: ['N6'] },
    { PROMO_CODES: { NEW50: 50 } }, { CARPET_ITEM_PRICES_P: { made_up_service: 5000 } },
    { CARPET_ITEM_PRICES_P: { bedroom: -1 } }, { CARPET_ITEM_PRICES_P: { bedroom: 5000.5 } },
    { CARPET_ITEM_PRICES_P: { bedroom: '5000' } }, { EOT_PRICES_P: { flat: { bed1: { tailored: 50000, complete: 20000 } } } },
  ])('rejects protected, malformed or contradictory edits: %j', override => {
    expect(validateWebsitePricebook(override).ok).toBe(false);
  });
  it('preserves photo assessment and existing promotion calculation', () => {
    const prices = createPricingCatalogue();
    expect(prices.computeCarpetPrice({ bedroom: 1, rug: 1 }, 'normal').isPhotoQuote).toBe(true);
    expect(prices.computeCarpetPrice({ sofa_2: 1, sofa_3: 1 }, 'normal', 1, 'LEAFLET20').finalTotal).toBe(132);
  });
  it('lists approved editable prices but never exposes protected payment or coverage fields', () => {
    const fields = getWebsitePricebookFields();
    expect(fields.some(field => field.key === 'CARPET_ITEM_PRICES_P.mattress_king' && field.pence === 6500)).toBe(true);
    expect(fields.some(field => /DEPOSIT|COVERAGE|GUARANTEE|PROMO/.test(field.key))).toBe(false);
  });
  it('rejects invalid API snapshots before rendering any new prices', () => {
    expect(() => validatePricebookSnapshot({ id: 'v2', overrides: { DEPOSIT_P: 1 } })).toThrow();
    expect(() => validatePricebookSnapshot({ overrides: {} })).toThrow();
    expect(validatePricebookSnapshot({ id: 'v2', overrides: {} }).version).toBe('v2');
  });
});
