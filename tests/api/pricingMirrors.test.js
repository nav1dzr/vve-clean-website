/**
 * Consistency tests for the two manually-maintained JS pricing mirrors.
 *
 * src/data/pricing.ts is the canonical source.  Two runtime files must stay
 * in sync but cannot import TypeScript directly:
 *
 *   api/servicePrices.js         – backend price-validation engine
 *   admin/api/_lib/catalogueSeed.js – CRM catalogue seed data
 *
 * These tests import from both mirrors and verify their key values against the
 * canonical constants exported by pricing.ts.  A failure here means a price
 * was updated in pricing.ts but the relevant JS file was not updated to match.
 */

import { describe, it, expect } from 'vitest';
import { computePrice } from '../../api/servicePrices.js';
import { CATALOGUE_SEED_ITEMS } from '../../admin/api/_lib/catalogueSeed.js';
import {
  EOT_BASE_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_HOUSE_ADJUSTMENT_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
  STAIRS_FIRST_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  PARKING_ESTIMATE_P,
  CONGESTION_CHARGE_P,
} from '../../src/data/pricing.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Look up a seed item by its exact name; throws if not found. */
function seedItem(name) {
  const item = CATALOGUE_SEED_ITEMS.find((i) => i.name === name);
  if (!item) throw new Error(`Catalogue seed item not found: "${name}"`);
  return item;
}

/** Call computePrice for a deep service (EOT / move-in / after-builders). */
function deepPrice(deepService, deepSize, deepBaths = 1, addOnCounts = undefined) {
  return computePrice({ service: 'deep', deepService, deepSize, deepBaths, addOnCounts });
}

// ═══════════════════════════════════════════════════════════════════════════════
// api/servicePrices.js — exercise computePrice to verify internal constants
// ═══════════════════════════════════════════════════════════════════════════════

describe('servicePrices.js — EOT base prices mirror pricing.ts', () => {
  it.each([
    ['studio', EOT_BASE_PRICES_P.studio],
    ['bed1',   EOT_BASE_PRICES_P.bed1],
    ['bed2',   EOT_BASE_PRICES_P.bed2],
    ['bed3',   EOT_BASE_PRICES_P.bed3],
    ['bed4',   EOT_BASE_PRICES_P.bed4],
  ])('%s', (size, expectedPence) => {
    expect(deepPrice('end_of_tenancy', size)).toBe(expectedPence / 100);
  });

  it('extra bath matches EOT_EXTRA_BATH_P', () => {
    const base = EOT_BASE_PRICES_P.studio / 100;
    const withBath = deepPrice('end_of_tenancy', 'studio', 2);
    expect(withBath - base).toBe(EOT_EXTRA_BATH_P / 100);
  });

  it('includes oven and fridge/freezer in the complete EOT base price', () => {
    const base = EOT_BASE_PRICES_P.bed2 / 100;
    expect(deepPrice('end_of_tenancy', 'bed2', 1, { oven: 1, fridge: 1 })).toBe(base);
  });

  it('prices a four-bedroom house carpet scope explicitly', () => {
    const base = EOT_BASE_PRICES_P.bed4 / 100;
    const result = deepPrice('end_of_tenancy', 'bed4', 1, {
      carpet_bundle: 1,
      eot_living_carpet: 1,
      staircase: 1,
    });
    expect(result).toBe(base + 195 + 55 + 45);
  });

  it('uses canonical upholstery and mattress prices for EOT upgrades', () => {
    const base = EOT_BASE_PRICES_P.bed1 / 100;
    const result = deepPrice('end_of_tenancy', 'bed1', 1, {
      eot_sofa_2: 1,
      eot_mattress_double: 1,
    });
    expect(result).toBe(
      base
      + CARPET_ITEM_PRICES_P.sofa_2 / 100
      + CARPET_ITEM_PRICES_P.mattress_double / 100,
    );
  });

  it('applies approved custom-scope credits with a £30 cap', () => {
    const base = EOT_BASE_PRICES_P.bed3 / 100;
    const result = computePrice({
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed3',
      deepBaths: 1,
      eotScopeExclusions: ['oven', 'fridge_freezer', 'cupboards'],
    });
    expect(result).toBe(base - 30);
  });
});

describe('servicePrices.js — EOT house/maisonette adjustment mirrors EOT_HOUSE_ADJUSTMENT_P', () => {
  it('4-bed house base is £584 (£549 base + £35 house adjustment)', () => {
    const result = computePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed4', deepBaths: 1, propertyType: 'house',
    });
    expect(result).toBe((EOT_BASE_PRICES_P.bed4 + EOT_HOUSE_ADJUSTMENT_P) / 100);
    expect(result).toBe(584);
  });

  it('does not add the house adjustment for a flat', () => {
    const result = computePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed4', deepBaths: 1, propertyType: 'flat',
    });
    expect(result).toBe(EOT_BASE_PRICES_P.bed4 / 100);
  });

  it('does not add the house adjustment to non-EOT deep services', () => {
    const result = computePrice({
      service: 'deep', deepService: 'move_in', deepSize: 'bed4', deepBaths: 1, propertyType: 'house',
    });
    expect(result).toBe(MOVEIN_BASE_PRICES_P.bed4 / 100);
  });
});

describe('servicePrices.js — 5+ bedroom EOT has no fixed price (tailored quote required)', () => {
  it('returns null for deepSize "bed5" — no BASE_PRICES entry exists by design', () => {
    const result = computePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed5', deepBaths: 1,
    });
    expect(result).toBeNull();
  });

  it('returns null for a 5+ bedroom house too — the tailored-quote path never invents a total', () => {
    const result = computePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed5', deepBaths: 1, propertyType: 'house',
    });
    expect(result).toBeNull();
  });
});

describe('servicePrices.js — parking / Congestion Charge access charges', () => {
  it('mirrors PARKING_ESTIMATE_P (£15) and CONGESTION_CHARGE_P (£18)', () => {
    expect(PARKING_ESTIMATE_P).toBe(1500);
    expect(CONGESTION_CHARGE_P).toBe(1800);
  });

  it('adds nothing when parking is available and the property is outside the zone', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'no',
    });
    expect(result).toBe(90);
  });

  it('adds £15 when parking is not available', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'no', congestionZone: 'no',
    });
    expect(result).toBe(105);
  });

  it('adds £15 when parking is not sure (estimate)', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'not_sure', congestionZone: 'no',
    });
    expect(result).toBe(105);
  });

  it('adds £18 when inside the Congestion Charge zone', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'yes',
    });
    expect(result).toBe(108);
  });

  it('adds £18 when not sure about the Congestion Charge zone (estimate pending address confirmation)', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'not_sure',
    });
    expect(result).toBe(108);
  });

  it('adds both charges together when parking is unavailable and inside the zone', () => {
    const result = computePrice({
      service: 'window', windowSize: 'medium', parkingAvailable: 'no', congestionZone: 'yes',
    });
    expect(result).toBe(90 + 15 + 18);
  });

  it('never adds an access charge on top of a null (manual/tailored-quote) result', () => {
    const result = computePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed5', deepBaths: 1,
      parkingAvailable: 'no', congestionZone: 'yes',
    });
    expect(result).toBeNull();
  });
});

describe('servicePrices.js — move-in base prices mirror pricing.ts', () => {
  it.each([
    ['studio', MOVEIN_BASE_PRICES_P.studio],
    ['bed1',   MOVEIN_BASE_PRICES_P.bed1],
    ['bed2',   MOVEIN_BASE_PRICES_P.bed2],
    ['bed3',   MOVEIN_BASE_PRICES_P.bed3],
    ['bed4',   MOVEIN_BASE_PRICES_P.bed4],
  ])('%s', (size, expectedPence) => {
    expect(deepPrice('move_in', size)).toBe(expectedPence / 100);
  });

  it('extra bath matches MOVEIN_EXTRA_BATH_P', () => {
    const base = MOVEIN_BASE_PRICES_P.bed1 / 100;
    const withBath = deepPrice('move_in', 'bed1', 2);
    expect(withBath - base).toBe(MOVEIN_EXTRA_BATH_P / 100);
  });
});

describe('servicePrices.js — after-builders prices mirror pricing.ts', () => {
  it.each([
    ['studio', AFTER_BUILDERS_FROM_PRICES_P.studio],
    ['bed1',   AFTER_BUILDERS_FROM_PRICES_P.bed1],
    ['bed2',   AFTER_BUILDERS_FROM_PRICES_P.bed2],
    ['bed3',   AFTER_BUILDERS_FROM_PRICES_P.bed3],
    ['bed4',   AFTER_BUILDERS_FROM_PRICES_P.bed4],
  ])('%s', (size, expectedPence) => {
    expect(deepPrice('after_builders', size)).toBe(expectedPence / 100);
  });
});

describe('servicePrices.js — carpet minimum and item prices mirror pricing.ts', () => {
  it('minimum booking floor matches CARPET_MIN_BOOKING_P', () => {
    const result = computePrice({
      service: 'deep', deepService: 'carpet_upholstery',
      carpetCounts: { bedroom: 1 }, carpetCondition: 'normal',
    });
    expect(result).toBe(CARPET_MIN_BOOKING_P / 100);
  });

  it('sofa item prices and 5% bundle tier match pricing.ts', () => {
    // sofa_corner (130) + sofa_3 (95) + sofa_2 (75) = 300 → 5% tier → saving 15 → 285
    const result = computePrice({
      service: 'deep', deepService: 'carpet_upholstery',
      carpetCounts: { sofa_corner: 1, sofa_3: 1, sofa_2: 1 }, carpetCondition: 'normal',
    });
    const sub = (CARPET_ITEM_PRICES_P.sofa_corner + CARPET_ITEM_PRICES_P.sofa_3 + CARPET_ITEM_PRICES_P.sofa_2) / 100;
    const saving = Math.round(sub * 5 / 100);
    expect(result).toBe(sub - saving);
  });
});

describe('servicePrices.js — EOT staircase add-on mirrors EOT_CARPET_ADDON_PRICES_P', () => {
  it('one stair flight matches stairs_first', () => {
    const base = EOT_BASE_PRICES_P.studio / 100;
    const result = deepPrice('end_of_tenancy', 'studio', 1, { staircase: 1 });
    expect(result - base).toBe(EOT_CARPET_ADDON_PRICES_P.stairs_first / 100);
  });

  it('two stair flights matches stairs_first + stairs_extra', () => {
    const base = EOT_BASE_PRICES_P.studio / 100;
    const result = deepPrice('end_of_tenancy', 'studio', 1, { staircase: 2 });
    const expected = (EOT_CARPET_ADDON_PRICES_P.stairs_first + EOT_CARPET_ADDON_PRICES_P.stairs_extra) / 100;
    expect(result - base).toBe(expected);
  });
});

describe('servicePrices.js — commercial office rate mirrors pricing.ts', () => {
  it('minimum charge matches COMMERCIAL_REGULAR_MIN_CHARGE_P', () => {
    expect(computePrice({ service: 'office', officeHours: 2 })).toBe(COMMERCIAL_REGULAR_MIN_CHARGE_P / 100);
  });

  it('hourly rate matches COMMERCIAL_REGULAR_HOURLY_P for 4 hours', () => {
    expect(computePrice({ service: 'office', officeHours: 4 })).toBe((COMMERCIAL_REGULAR_HOURLY_P / 100) * 4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// admin/api/_lib/catalogueSeed.js — check seed item pence against pricing.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe('catalogueSeed.js — EOT prices mirror pricing.ts', () => {
  it.each([
    ['End of tenancy clean — studio',    EOT_BASE_PRICES_P.studio],
    ['End of tenancy clean — 1 bedroom', EOT_BASE_PRICES_P.bed1],
    ['End of tenancy clean — 2 bedroom', EOT_BASE_PRICES_P.bed2],
    ['End of tenancy clean — 3 bedroom', EOT_BASE_PRICES_P.bed3],
    ['End of tenancy clean — 4 bedroom', EOT_BASE_PRICES_P.bed4],
  ])('%s', (name, expectedPence) => {
    expect(seedItem(name).default_price_pence).toBe(expectedPence);
  });

  it('EOT extra bath matches EOT_EXTRA_BATH_P', () => {
    expect(seedItem('EOT — additional full bathroom').default_price_pence).toBe(EOT_EXTRA_BATH_P);
  });

  it('EOT extra WC matches EOT_EXTRA_WC_P', () => {
    expect(seedItem('EOT — additional WC').default_price_pence).toBe(EOT_EXTRA_WC_P);
  });
});

describe('catalogueSeed.js — move-in prices mirror pricing.ts', () => {
  it.each([
    ['Move-in clean — studio',    MOVEIN_BASE_PRICES_P.studio],
    ['Move-in clean — 1 bedroom', MOVEIN_BASE_PRICES_P.bed1],
    ['Move-in clean — 2 bedroom', MOVEIN_BASE_PRICES_P.bed2],
    ['Move-in clean — 3 bedroom', MOVEIN_BASE_PRICES_P.bed3],
    ['Move-in clean — 4 bedroom', MOVEIN_BASE_PRICES_P.bed4],
  ])('%s', (name, expectedPence) => {
    expect(seedItem(name).default_price_pence).toBe(expectedPence);
  });

  it('move-in extra bath matches MOVEIN_EXTRA_BATH_P', () => {
    expect(seedItem('Move-in — additional bathroom').default_price_pence).toBe(MOVEIN_EXTRA_BATH_P);
  });
});

describe('catalogueSeed.js — after-builders prices mirror pricing.ts', () => {
  it('small area matches AFTER_BUILDERS_START_FROM_P', () => {
    expect(seedItem('After builders clean — small area').default_price_pence).toBe(AFTER_BUILDERS_START_FROM_P);
  });

  it.each([
    ['After builders clean — studio',    AFTER_BUILDERS_FROM_PRICES_P.studio],
    ['After builders clean — 1 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed1],
    ['After builders clean — 2 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed2],
    ['After builders clean — 3 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed3],
    ['After builders clean — 4 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed4],
  ])('%s', (name, expectedPence) => {
    expect(seedItem(name).default_price_pence).toBe(expectedPence);
  });
});

describe('catalogueSeed.js — EOT carpet add-on prices mirror pricing.ts', () => {
  it.each([
    ['EOT carpet add-on — bedroom',        EOT_CARPET_ADDON_PRICES_P.bedroom],
    ['EOT carpet add-on — living room',    EOT_CARPET_ADDON_PRICES_P.living_room],
    ['EOT carpet add-on — large lounge',   EOT_CARPET_ADDON_PRICES_P.large_lounge],
    ['EOT carpet add-on — hallway',        EOT_CARPET_ADDON_PRICES_P.hallway],
    ['EOT carpet add-on — landing',        EOT_CARPET_ADDON_PRICES_P.landing],
    ['EOT carpet add-on — stairs (first)', EOT_CARPET_ADDON_PRICES_P.stairs_first],
    ['EOT carpet add-on — stairs (extra)', EOT_CARPET_ADDON_PRICES_P.stairs_extra],
  ])('%s', (name, expectedPence) => {
    expect(seedItem(name).default_price_pence).toBe(expectedPence);
  });
});

describe('catalogueSeed.js — carpet and stairs prices mirror pricing.ts', () => {
  it('bedroom carpet matches CARPET_ITEM_PRICES_P.bedroom', () => {
    expect(seedItem('Bedroom carpet clean').default_price_pence).toBe(CARPET_ITEM_PRICES_P.bedroom);
  });

  it('stairs first flight matches STAIRS_FIRST_P', () => {
    expect(seedItem('Stairs carpet clean — first flight').default_price_pence).toBe(STAIRS_FIRST_P);
  });
});

describe('catalogueSeed.js — commercial prices mirror pricing.ts', () => {
  it('regular contract hourly matches COMMERCIAL_REGULAR_HOURLY_P', () => {
    expect(
      seedItem('Commercial cleaning — regular contract (per hour)').default_price_pence,
    ).toBe(COMMERCIAL_REGULAR_HOURLY_P);
  });
});
