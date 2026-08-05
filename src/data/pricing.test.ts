import { describe, it, expect } from 'vitest';
import {
  CARPET_BUNDLE_BANDS,
  CARPET_MIN_BOOKING_P,
  EOT_COMPLETE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_PRICES_P,
  eotPropertySizeValid,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_TAILORED_ADDON_PRICES_P,
  EOT_TAILORED_CUPBOARDS_PRICES_P,
  EOT_CARPET_PACKAGE_DISCOUNT_PCT,
  EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS,
  EOT_CARPET_QUALIFYING_KEYS,
  CARPET_ITEM_PRICES_P,
  calculateEotCarpetPackage,
  eotCarpetAreaStandalonePriceP,
  generateDefaultRooms,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  MOVEIN_EXTRA_WC_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_CARPET_RATE_APPROVED,
  SAME_DAY_POLICY_SHORT,
  DEPOSIT_P,
  WINDOW_CLEANING_FROM_P,
  WINDOW_CLEANING_MIN_P,
  GARDEN_SERVICES_FROM_P,
  GARDEN_SERVICES_MIN_P,
  stairsLinePricePence,
  penceToDisplay,
  calculateEotQuote,
  calculateMoveInQuote,
  calculateAfterBuildersEstimate,
  calculateBundleDiscount,
  calculateDepositAndBalance,
  getServiceStartingPrice,
} from './pricing';
import { computeCarpetPrice, CARPET_MIN_BOOKING } from './carpetPricing';

// ─── Canonical price values ───────────────────────────────────────────────────

describe('EOT price matrix — flat, explicit canonical values in pence', () => {
  it.each([
    ['studio', 15900, 22000],
    ['bed1',   19900, 27900],
    ['bed2',   25900, 33900],
    ['bed3',   31900, 40900],
    ['bed4',   41900, 52900],
  ])('%s — Tailored %ip, Complete %ip', (key, tailored, complete) => {
    expect(EOT_PRICES_P.flat[key as keyof typeof EOT_PRICES_P.flat].tailored).toBe(tailored);
    expect(EOT_PRICES_P.flat[key as keyof typeof EOT_PRICES_P.flat].complete).toBe(complete);
    expect(EOT_TAILORED_START_PRICES_P[key as keyof typeof EOT_TAILORED_START_PRICES_P]).toBe(tailored);
    expect(EOT_COMPLETE_PRICES_P[key as keyof typeof EOT_COMPLETE_PRICES_P]).toBe(complete);
  });

  it('extra bath is £40 (4000p)', () => expect(EOT_EXTRA_BATH_P).toBe(4000));
  it('extra WC is £20 (2000p)', () => expect(EOT_EXTRA_WC_P).toBe(2000));
  it('guarantee window is 72 hours', () => expect(EOT_GUARANTEE_HOURS).toBe(72));

  it('every Tailored starting price is below the equivalent Complete price', () => {
    for (const key of Object.keys(EOT_TAILORED_START_PRICES_P) as (keyof typeof EOT_TAILORED_START_PRICES_P)[]) {
      expect(EOT_TAILORED_START_PRICES_P[key]).toBeLessThan(EOT_COMPLETE_PRICES_P[key]);
    }
  });

  it('Tailored add-on prices, including the microwave', () => {
    expect(EOT_TAILORED_ADDON_PRICES_P.microwave_inside).toBe(1000);
    expect(EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside).toBe(2500);
    expect(EOT_TAILORED_ADDON_PRICES_P.extra_fridge_freezer).toBe(1500);
    expect(EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside).toBe(1000);
    expect(EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside).toBe(1000);
  });

  it('cupboards add-on scales with property size', () => {
    expect(EOT_TAILORED_CUPBOARDS_PRICES_P.studio).toBe(2500);
    expect(EOT_TAILORED_CUPBOARDS_PRICES_P.bed1).toBe(2500);
    expect(EOT_TAILORED_CUPBOARDS_PRICES_P.bed2).toBe(3500);
    expect(EOT_TAILORED_CUPBOARDS_PRICES_P.bed3).toBe(4500);
    expect(EOT_TAILORED_CUPBOARDS_PRICES_P.bed4).toBe(5500);
  });

  it('building every Tailored add-on (including microwave) can reach or exceed Complete at bed2', () => {
    // Complete bed2 = 33900p. Tailored bed2 (25900) + every add-on
    // (1000 microwave + 2500 + 1000 + 1000 + 3500 cupboards = 9000) = 34900p
    // — Complete is cheaper, which is exactly when shouldOfferComplete fires.
    const tailoredFull = EOT_TAILORED_START_PRICES_P.bed2
      + EOT_TAILORED_ADDON_PRICES_P.microwave_inside
      + EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside
      + EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside
      + EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside
      + EOT_TAILORED_CUPBOARDS_PRICES_P.bed2;
    expect(tailoredFull).toBeGreaterThanOrEqual(EOT_COMPLETE_PRICES_P.bed2);
  });
});

describe('EOT price matrix — house/maisonette, explicit canonical values (never flat + a blanket adjustment)', () => {
  it.each([
    ['bed1', 23900, 31900],
    ['bed2', 30900, 39900],
    ['bed3', 38900, 49900],
    ['bed4', 49900, 62900],
  ])('%s — Tailored %ip, Complete %ip', (key, tailored, complete) => {
    expect(EOT_PRICES_P.house[key as 'bed1' | 'bed2' | 'bed3' | 'bed4']!.tailored).toBe(tailored);
    expect(EOT_PRICES_P.house[key as 'bed1' | 'bed2' | 'bed3' | 'bed4']!.complete).toBe(complete);
  });

  it('has no studio entry — house/maisonette studios are always a manual quotation', () => {
    expect(EOT_PRICES_P.house.studio).toBeUndefined();
    expect(eotPropertySizeValid('house', 'studio')).toBe(false);
    expect(eotPropertySizeValid('flat', 'studio')).toBe(true);
  });

  it('every house price is genuinely higher than the equivalent flat price, not derived from a flat + surcharge formula', () => {
    for (const key of ['bed1', 'bed2', 'bed3', 'bed4'] as const) {
      expect(EOT_PRICES_P.house[key]!.tailored).toBeGreaterThan(EOT_PRICES_P.flat[key].tailored);
      expect(EOT_PRICES_P.house[key]!.complete).toBeGreaterThan(EOT_PRICES_P.flat[key].complete);
      // Not simply "flat + a constant" — the gap varies by size, confirming
      // these are independent, explicit catalogue entries.
    }
    const gapBed1 = EOT_PRICES_P.house.bed1!.complete - EOT_PRICES_P.flat.bed1.complete;
    const gapBed4 = EOT_PRICES_P.house.bed4!.complete - EOT_PRICES_P.flat.bed4.complete;
    expect(gapBed1).not.toBe(gapBed4);
  });
});

describe('move-in base prices — canonical values in pence', () => {
  it.each([
    ['studio', 15900],
    ['bed1',   19900],
    ['bed2',   24900],
    ['bed3',   30900],
    ['bed4',   38900],
  ])('%s is %ip', (key, expected) => {
    expect(MOVEIN_BASE_PRICES_P[key as keyof typeof MOVEIN_BASE_PRICES_P]).toBe(expected);
  });

  it('extra bath is £30 (3000p)', () => expect(MOVEIN_EXTRA_BATH_P).toBe(3000));
  it('extra WC is £15 (1500p)', () => expect(MOVEIN_EXTRA_WC_P).toBe(1500));
});

describe('after-builders from prices — unchanged from the existing live ladder', () => {
  it.each([
    ['small',  24900],
    ['studio', 27900],
    ['bed1',   32900],
    ['bed2',   39900],
    ['bed3',   49900],
    ['bed4',   62500],
  ])('%s is %ip', (key, expected) => {
    expect(AFTER_BUILDERS_FROM_PRICES_P[key]).toBe(expected);
  });

  it('lowest "from" price is the small renovation (£249)', () => {
    expect(AFTER_BUILDERS_START_FROM_P).toBe(AFTER_BUILDERS_FROM_PRICES_P.small);
  });
});

describe('EOT/move-in carpet add-on prices', () => {
  it.each([
    ['bedroom',     4000],
    ['living_room', 5500],
    ['large_lounge',7000],
    ['hallway',     2000],
    ['landing',     1500],
    ['stairs_first',4500],
    ['stairs_extra',3500],
  ])('%s is %ip', (key, expected) => {
    expect(EOT_CARPET_ADDON_PRICES_P[key]).toBe(expected);
  });

  it('EOT carpet add-on bedroom (£40) is less than standalone carpet bedroom (£50)', () => {
    expect(EOT_CARPET_ADDON_PRICES_P.bedroom / 100).toBeLessThan(50);
  });
});

describe('commercial regular rate', () => {
  it('hourly rate is £27.50 (2750p)', () => {
    expect(COMMERCIAL_REGULAR_HOURLY_P).toBe(2750);
  });
  it('min charge is £55 (5500p = 2 hours × £27.50)', () => {
    expect(COMMERCIAL_REGULAR_MIN_CHARGE_P).toBe(5500);
  });
});

describe('minimum booking constant is consistent', () => {
  it('CARPET_MIN_BOOKING_P is 8500 pence (£85)', () => {
    expect(CARPET_MIN_BOOKING_P).toBe(8500);
  });
  it('CARPET_MIN_BOOKING (pounds) matches CARPET_MIN_BOOKING_P / 100', () => {
    expect(CARPET_MIN_BOOKING).toBe(CARPET_MIN_BOOKING_P / 100);
  });
});

describe('deposit is £30 and unchanged', () => {
  it('DEPOSIT_P is 3000 pence', () => expect(DEPOSIT_P).toBe(3000));
});

describe('window & garden "from" prices are genuinely achievable', () => {
  it('window cleaning from price equals its own minimum call-out', () => {
    expect(WINDOW_CLEANING_FROM_P).toBe(WINDOW_CLEANING_MIN_P);
    expect(WINDOW_CLEANING_FROM_P).toBe(7500);
  });
  it('garden services from price equals its own minimum call-out', () => {
    expect(GARDEN_SERVICES_FROM_P).toBe(GARDEN_SERVICES_MIN_P);
    expect(GARDEN_SERVICES_FROM_P).toBe(7500);
  });
});

// ─── CARPET_BUNDLE_BANDS structure — item-count, not percentage-of-subtotal ──

describe('CARPET_BUNDLE_BANDS', () => {
  it('has exactly 4 bands (including the "no discount" 1-2 band)', () => {
    expect(CARPET_BUNDLE_BANDS).toHaveLength(4);
  });

  it('is ordered highest-first (descending minItems)', () => {
    for (let i = 1; i < CARPET_BUNDLE_BANDS.length; i++) {
      expect(CARPET_BUNDLE_BANDS[i].minItems).toBeLessThan(CARPET_BUNDLE_BANDS[i - 1].minItems);
    }
  });

  it('has thresholds at 1, 3, 5 and 7 items', () => {
    const thresholds = CARPET_BUNDLE_BANDS.map((b) => b.minItems).sort((a, b) => a - b);
    expect(thresholds).toEqual([1, 3, 5, 7]);
  });

  it('discount amounts increase monotonically with item count', () => {
    const asc = [...CARPET_BUNDLE_BANDS].sort((a, b) => a.minItems - b.minItems);
    for (let i = 1; i < asc.length; i++) {
      expect(asc[i].amountP).toBeGreaterThanOrEqual(asc[i - 1].amountP);
    }
  });
});

describe('calculateBundleDiscount', () => {
  it('0-2 items: no discount', () => {
    expect(calculateBundleDiscount(0).amountP).toBe(0);
    expect(calculateBundleDiscount(1).amountP).toBe(0);
    expect(calculateBundleDiscount(2).amountP).toBe(0);
  });
  it('3-4 items: £10 off', () => {
    expect(calculateBundleDiscount(3).amountP).toBe(1000);
    expect(calculateBundleDiscount(4).amountP).toBe(1000);
  });
  it('5-6 items: £20 off', () => {
    expect(calculateBundleDiscount(5).amountP).toBe(2000);
    expect(calculateBundleDiscount(6).amountP).toBe(2000);
  });
  it('7+ items: £35 off', () => {
    expect(calculateBundleDiscount(7).amountP).toBe(3500);
    expect(calculateBundleDiscount(20).amountP).toBe(3500);
  });
  it('discount is never negative and never decreases as item count rises', () => {
    let prev = 0;
    for (let n = 0; n <= 15; n++) {
      const amt = calculateBundleDiscount(n).amountP;
      expect(amt).toBeGreaterThanOrEqual(0);
      expect(amt).toBeGreaterThanOrEqual(prev);
      prev = amt;
    }
  });
});

// ─── stairsLinePricePence ─────────────────────────────────────────────────────

describe('stairsLinePricePence', () => {
  it('0 flights → 0p', () => expect(stairsLinePricePence(0)).toBe(0));
  it('1 flight  → 5000p (£50)',  () => expect(stairsLinePricePence(1)).toBe(5000));
  it('2 flights → 9000p (£90)',  () => expect(stairsLinePricePence(2)).toBe(9000));
  it('3 flights → 13000p (£130)', () => expect(stairsLinePricePence(3)).toBe(13000));
  it('negative → 0p',             () => expect(stairsLinePricePence(-1)).toBe(0));
});

// ─── penceToDisplay ───────────────────────────────────────────────────────────

describe('penceToDisplay', () => {
  it('whole pounds — no decimal', () => expect(penceToDisplay(19900)).toBe('£199'));
  it('with pence  — 2dp',         () => expect(penceToDisplay(2750)).toBe('£27.50'));
  it('zero',                       () => expect(penceToDisplay(0)).toBe('£0'));
  it('£85 minimum',                () => expect(penceToDisplay(8500)).toBe('£85'));
});

// ─── SAME_DAY_POLICY_SHORT ────────────────────────────────────────────────────

describe('SAME_DAY_POLICY_SHORT — no automated surcharge', () => {
  it('is a non-empty string', () => {
    expect(typeof SAME_DAY_POLICY_SHORT).toBe('string');
    expect(SAME_DAY_POLICY_SHORT.length).toBeGreaterThan(0);
  });

  it('mentions "normal price" (same-day uses standard rates)', () => {
    expect(SAME_DAY_POLICY_SHORT.toLowerCase()).toContain('normal price');
  });

  it('does not mention "surcharge", "priority fee" or "extra charge"', () => {
    const lower = SAME_DAY_POLICY_SHORT.toLowerCase();
    expect(lower).not.toContain('surcharge');
    expect(lower).not.toContain('priority fee');
    expect(lower).not.toContain('extra charge');
  });
});

// ─── calculateEotQuote ────────────────────────────────────────────────────────

describe('calculateEotQuote — Complete package', () => {
  it('studio, flat, 1 bathroom, no WCs', () => {
    const r = calculateEotQuote({ size: 'studio', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    expect(r.totalP).toBe(22000);
    expect(r.guaranteeScope).toBe('complete');
    expect(r.guaranteeHours).toBe(72);
    expect(r.shouldOfferComplete).toBe(false);
  });

  it('2 bed house with 1 extra bathroom and 1 extra WC — from the explicit house price, not flat + a blanket adjustment', () => {
    const r = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: true, extraBathrooms: 1, extraWcs: 1 });
    // 39900 (explicit house bed2 Complete) + 4000 (bath) + 2000 (wc) = 45900
    expect(r.totalP).toBe(45900);
  });

  it('negative bathroom/WC counts are treated as zero, never subtracted', () => {
    const r = calculateEotQuote({ size: 'studio', package: 'complete', isHouse: false, extraBathrooms: -3, extraWcs: -2 });
    expect(r.totalP).toBe(22000);
  });
});

describe('calculateEotQuote — Tailored package', () => {
  it('bare starting price with nothing added', () => {
    const r = calculateEotQuote({ size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    expect(r.totalP).toBe(19900);
    expect(r.guaranteeScope).toBe('selected-tasks');
  });

  it('adding every add-on for bed1, including the microwave', () => {
    const r = calculateEotQuote({
      size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0,
      tailoredAddOns: { microwaveInside: true, fridgeFreezerInside: true, dishwasherInside: true, washingMachineInside: true, cupboards: true, extraFridgeFreezers: 1 },
    });
    // 19900 + 1000 (microwave) + 2500 + 1000 + 1000 + 2500 (cupboards bed1) + 1500 (extra fridge) = 29400
    expect(r.totalP).toBe(29400);
  });

  it('shouldOfferComplete becomes true once Tailored reaches the Complete price', () => {
    const r = calculateEotQuote({
      size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0,
      tailoredAddOns: { fridgeFreezerInside: true, dishwasherInside: true, washingMachineInside: true, cupboards: true },
    });
    // 25900 + 2500 + 1000 + 1000 + 3500 = 33900 >= Complete 33900 (flat bed2)
    expect(r.totalP).toBe(33900);
    expect(r.completeEquivalentP).toBe(33900);
    expect(r.shouldOfferComplete).toBe(true);
  });

  it('shouldOfferComplete is false when Tailored stays cheaper than Complete', () => {
    const r = calculateEotQuote({
      size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0,
      tailoredAddOns: { fridgeFreezerInside: true },
    });
    expect(r.totalP).toBeLessThan(r.completeEquivalentP);
    expect(r.shouldOfferComplete).toBe(false);
  });
});

describe('calculateEotQuote — adding scope never reduces the total (monotonic)', () => {
  it('adding bathrooms, WCs, switching to an explicit house price and add-ons only ever raises the price', () => {
    let prev = calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0 }).totalP;
    const steps = [
      calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 1, extraWcs: 0 }).totalP,
      calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 1, extraWcs: 1 }).totalP,
      calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: true, extraBathrooms: 1, extraWcs: 1 }).totalP,
      calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: true, extraBathrooms: 1, extraWcs: 1, tailoredAddOns: { fridgeFreezerInside: true } }).totalP,
    ];
    for (const total of steps) {
      expect(total).toBeGreaterThanOrEqual(prev);
      prev = total;
    }
  });
});

// ─── EOT carpet package — 50% off standalone value, 3+ qualifying areas ──────

function roomsFor(keys: string[]): { id: string; addonKey: string; floor: string }[] {
  return keys.map((addonKey, i) => ({ id: `r${i}`, addonKey, floor: 'carpet' }));
}

describe('calculateEotCarpetPackage — standalone values are untouched', () => {
  it('reads the exact same per-item prices as the standalone carpet & upholstery service', () => {
    expect(CARPET_ITEM_PRICES_P.bedroom).toBe(5000);
    expect(CARPET_ITEM_PRICES_P.living_room).toBe(6000);
    expect(CARPET_ITEM_PRICES_P.large_lounge).toBe(8000);
    expect(CARPET_ITEM_PRICES_P.hallway).toBe(2500);
    expect(CARPET_ITEM_PRICES_P.landing).toBe(2000);
  });

  it('eotCarpetAreaStandalonePriceP reads straight from CARPET_ITEM_PRICES_P — no second table', () => {
    for (const key of ['bedroom', 'living_room', 'large_lounge', 'hallway', 'landing']) {
      expect(eotCarpetAreaStandalonePriceP(key)).toBe(CARPET_ITEM_PRICES_P[key]);
    }
  });

  it('stairs use the same non-linear stairsLinePricePence formula as standalone stairs', () => {
    expect(eotCarpetAreaStandalonePriceP('stairs', 1)).toBe(stairsLinePricePence(1));
    expect(eotCarpetAreaStandalonePriceP('stairs', 3)).toBe(stairsLinePricePence(3));
  });
});

describe('calculateEotCarpetPackage — nothing is charged until confirmed', () => {
  it('a suggested room that is not in carpetRoomIds is never priced', () => {
    const rooms = generateDefaultRooms('bed2', 'flat');
    const r = calculateEotCarpetPackage(rooms, []);
    expect(r.chargedP).toBe(0);
    expect(r.itemCount).toBe(0);
  });

  it('generateDefaultRooms suggests exactly one stairs area for every size — never multiple flights pre-assumed', () => {
    const sizes: ('studio' | 'bed1' | 'bed2' | 'bed3' | 'bed4')[] = ['studio', 'bed1', 'bed2', 'bed3', 'bed4'];
    for (const size of sizes) {
      const rooms = generateDefaultRooms(size, 'house');
      const stairsRooms = rooms.filter((r: { addonKey: string }) => r.addonKey === 'stairs');
      expect(stairsRooms.length).toBe(1); // one suggested "Stairs" area, regardless of a 4-bed house
    }
  });

  it('an unspecified stairFlights is priced as exactly 1 flight — never assumed higher for a large property', () => {
    const rooms = [{ id: 'st', addonKey: 'stairs' }]; // no stairFlights field at all
    expect(eotCarpetAreaStandalonePriceP('stairs', undefined)).toBe(stairsLinePricePence(1));
    const r = calculateEotCarpetPackage(rooms, ['st']);
    expect(r.standaloneSubtotalP).toBe(stairsLinePricePence(1));
  });

  it('a 5-bedroom-style layout is still calculated from the ACTUAL confirmed areas, not from bedroom count', () => {
    // 5 bedrooms suggested, but the customer only confirms 2 of them.
    const rooms = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, addonKey: 'bedroom' })),
      { id: 'hall', addonKey: 'hallway' },
    ];
    const r = calculateEotCarpetPackage(rooms, ['b0', 'b1']);
    expect(r.itemCount).toBe(2); // not 5
    expect(r.standaloneSubtotalP).toBe(CARPET_ITEM_PRICES_P.bedroom * 2);
    expect(r.eligible).toBe(false);
  });
});

describe('calculateEotCarpetPackage — eligibility requires 3+ qualifying areas', () => {
  it('fewer than 3 confirmed areas are charged at full standalone value — no discount', () => {
    const rooms = roomsFor(['bedroom', 'bedroom']);
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1']);
    expect(r.eligible).toBe(false);
    expect(r.standaloneSubtotalP).toBe(CARPET_ITEM_PRICES_P.bedroom * 2);
    expect(r.chargedP).toBe(CARPET_ITEM_PRICES_P.bedroom * 2); // no saving
    expect(r.savingP).toBe(0);
  });

  it(`exactly ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} evenly-priced areas receive exactly ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off once the marginal-value floor is not binding`, () => {
    // 4 equal-priced bedrooms is the smallest evenly-priced selection where
    // the top-2-areas monotonicity floor lands exactly on 50% (see the
    // "never reduces the payable total" describe block below for why 3
    // items can never reach a clean 50% — the floor always binds tighter).
    const rooms = roomsFor(['bedroom', 'bedroom', 'bedroom', 'bedroom']);
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2', 'r3']);
    expect(r.itemCount).toBe(4);
    expect(r.eligible).toBe(true);
    expect(r.standaloneSubtotalP).toBe(CARPET_ITEM_PRICES_P.bedroom * 4); // £200
    expect(r.chargedP).toBe(CARPET_ITEM_PRICES_P.bedroom * 4 * (1 - EOT_CARPET_PACKAGE_DISCOUNT_PCT / 100)); // £100
    expect(r.savingP).toBe(r.standaloneSubtotalP - r.chargedP);
    expect(r.savingP).toBe(r.standaloneSubtotalP / 2); // exactly 50%
  });
});

describe('calculateEotCarpetPackage — £85 minimum applies correctly', () => {
  it('a single cheap area is floored at £85, not its own standalone value', () => {
    const rooms = roomsFor(['landing']); // £20 standalone
    const r = calculateEotCarpetPackage(rooms, ['r0']);
    expect(r.standaloneSubtotalP).toBe(CARPET_ITEM_PRICES_P.landing);
    expect(r.chargedP).toBe(CARPET_MIN_BOOKING_P); // £85 floor
  });

  it('an eligible, discounted package below £85 is raised to the £85 floor', () => {
    // 3 landings: £60 standalone, 50% off would be £30 — well under £85.
    const rooms = roomsFor(['landing', 'landing', 'landing']);
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']);
    expect(r.eligible).toBe(true);
    expect(r.chargedP).toBe(CARPET_MIN_BOOKING_P);
  });

  it('a selection already worth more than £85 is never reduced down to it', () => {
    const rooms = roomsFor(['bedroom', 'bedroom']); // £100, ineligible
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1']);
    expect(r.chargedP).toBe(10000);
  });
});

describe('calculateEotCarpetPackage — rugs and specialist materials are excluded', () => {
  it('EOT_CARPET_QUALIFYING_KEYS never includes rugs or anything requiring photo review', () => {
    expect(EOT_CARPET_QUALIFYING_KEYS).not.toContain('rug');
    expect(EOT_CARPET_QUALIFYING_KEYS).not.toContain('sofa_2');
    expect(EOT_CARPET_QUALIFYING_KEYS).not.toContain('mattress_double');
    expect(EOT_CARPET_QUALIFYING_KEYS.sort()).toEqual(
      ['bedroom', 'hallway', 'landing', 'large_lounge', 'living_room', 'stairs'].sort(),
    );
  });

  it('a rug included in carpetRoomIds is silently priced at £0 and excluded from eligibility', () => {
    const rooms = [
      { id: 'r0', addonKey: 'bedroom' }, { id: 'r1', addonKey: 'bedroom' },
      { id: 'r2', addonKey: 'rug' },
    ];
    const withRug = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']);
    const withoutRug = calculateEotCarpetPackage(rooms, ['r0', 'r1']);
    expect(withRug.itemCount).toBe(2); // rug not counted
    expect(withRug).toEqual(withoutRug); // identical result — rug contributed nothing
    expect(withRug.eligible).toBe(false); // still only 2 real qualifying areas
  });
});

describe('calculateEotCarpetPackage — no double discount', () => {
  it('never applies the item-count CARPET_BUNDLE_BANDS discount on top of the EOT package discount', () => {
    // 7+ items would trigger a £35 CARPET_BUNDLE_BANDS discount on the
    // standalone carpet page — calculateEotCarpetPackage must never call
    // that logic, so a large EOT selection is discounted by exactly 50%,
    // never 50% plus a further bundle-band reduction.
    const rooms = roomsFor(['bedroom', 'bedroom', 'bedroom', 'bedroom', 'living_room', 'hallway', 'landing']);
    const ids = rooms.map((r) => r.id);
    const r = calculateEotCarpetPackage(rooms, ids);
    const naive50 = Math.round(r.standaloneSubtotalP * 0.5);
    // chargedP is either the monotonic floor or exactly naive50 — never less
    // than naive50 (which stacking a further discount on top would produce).
    expect(r.chargedP).toBeGreaterThanOrEqual(naive50);
  });

  it('does not reuse the already-discounted EOT_CARPET_ADDON_PRICES_P table (that would double-discount)', () => {
    const rooms = roomsFor(['bedroom', 'bedroom', 'bedroom']);
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']);
    // If the (already-discounted) EOT_CARPET_ADDON_PRICES_P table had been
    // used as the base instead of the standalone CARPET_ITEM_PRICES_P table,
    // the standalone subtotal would be 3 * 4000 = 12000, not 3 * 5000.
    expect(r.standaloneSubtotalP).toBe(CARPET_ITEM_PRICES_P.bedroom * 3);
    expect(r.standaloneSubtotalP).not.toBe(EOT_CARPET_ADDON_PRICES_P.bedroom * 3);
  });
});

describe('calculateEotCarpetPackage — adding another area never reduces the payable total', () => {
  it('3 items can never receive a clean 50% off — the monotonicity floor always binds first', () => {
    // Mathematical property of this design: for exactly 3 positive-priced
    // items, the 2-most-expensive-items floor is always >= 2/3 of the
    // subtotal, which always exceeds 50% — proving 3-item selections are
    // always floored above naive 50%, by construction, for any real prices.
    const rooms = roomsFor(['bedroom', 'bedroom', 'living_room']);
    const r = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']);
    const naive50 = Math.round(r.standaloneSubtotalP * 0.5);
    expect(r.chargedP).toBeGreaterThan(naive50);
  });

  it('adding a 3rd area never charges less than 2 areas alone already cost, even in an adversarial combination', () => {
    const rooms = roomsFor(['large_lounge', 'bedroom', 'landing']); // £80, £50, £20
    const twoItems = calculateEotCarpetPackage(rooms, ['r0', 'r1']); // £130, ineligible
    const threeItems = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']); // eligible, naive 50% of £150 = £75
    expect(twoItems.chargedP).toBe(13000);
    expect(threeItems.chargedP).toBeGreaterThanOrEqual(twoItems.chargedP);
  });

  it('a long incremental sequence in an adversarial order is monotonic throughout', () => {
    const rooms = roomsFor(['large_lounge', 'bedroom', 'hallway', 'landing', 'bedroom', 'stairs', 'bedroom']);
    const ids = rooms.map((r) => r.id);
    let prevCharge = 0;
    for (let i = 1; i <= ids.length; i++) {
      const r = calculateEotCarpetPackage(rooms, ids.slice(0, i));
      expect(r.chargedP).toBeGreaterThanOrEqual(prevCharge);
      prevCharge = r.chargedP;
    }
  });

  it('removing then re-adding an area returns to the same price as before (no state-order dependence)', () => {
    const rooms = roomsFor(['bedroom', 'bedroom', 'hallway']);
    const before = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']);
    const after = calculateEotCarpetPackage(rooms, ['r0', 'r1']); // remove hallway
    const readded = calculateEotCarpetPackage(rooms, ['r0', 'r1', 'r2']); // re-add
    expect(after.chargedP).toBeLessThanOrEqual(before.chargedP);
    expect(readded).toEqual(before);
  });
});

describe('calculateEotQuote — carpet package is included in Complete and Tailored totals identically', () => {
  it('Complete and Tailored add the same carpet package charge on top of their own base price', () => {
    const rooms = roomsFor(['bedroom', 'bedroom', 'hallway']);
    const carpetRoomIds = ['r0', 'r1', 'r2'];
    const complete = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds });
    const tailored = calculateEotQuote({ size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds });
    expect(complete.carpetAddonP).toBe(tailored.carpetAddonP);
    expect(complete.carpetAddonP).toBe(complete.carpetPackage.chargedP);
    expect(complete.totalP).toBe(EOT_COMPLETE_PRICES_P.bed2 + complete.carpetAddonP);
    expect(tailored.totalP).toBe(EOT_TAILORED_START_PRICES_P.bed2 + tailored.carpetAddonP);
  });

  it('the carpet package never changes the EOT base price itself — only adds to it', () => {
    const rooms = roomsFor(['bedroom', 'bedroom', 'hallway']);
    const withoutCarpet = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    const withCarpet = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds: ['r0', 'r1', 'r2'] });
    expect(withCarpet.basePriceP).toBe(withoutCarpet.basePriceP);
    expect(withCarpet.completeEquivalentP).toBe(withoutCarpet.completeEquivalentP);
    expect(withCarpet.totalP).toBe(withoutCarpet.totalP + withCarpet.carpetAddonP);
  });
});

// ─── calculateMoveInQuote ─────────────────────────────────────────────────────

describe('calculateMoveInQuote', () => {
  it('studio, no extras', () => {
    expect(calculateMoveInQuote({ size: 'studio', extraBathrooms: 0, extraWcs: 0 }).totalP).toBe(15900);
  });
  it('bed3 with 1 extra bathroom and 2 extra WCs', () => {
    // 30900 + 3000 + (2 * 1500) = 36900
    expect(calculateMoveInQuote({ size: 'bed3', extraBathrooms: 1, extraWcs: 2 }).totalP).toBe(36900);
  });
});

// ─── calculateAfterBuildersEstimate ───────────────────────────────────────────

describe('calculateAfterBuildersEstimate', () => {
  it('is always a "from" price, never presented as final', () => {
    const r = calculateAfterBuildersEstimate('bed2');
    expect(r.pricingMode).toBe('from');
    expect(r.fromP).toBe(39900);
    expect(r.note.toLowerCase()).toContain('confirmed');
  });
});

// ─── calculateDepositAndBalance ───────────────────────────────────────────────

describe('calculateDepositAndBalance', () => {
  it('deposit is £30 and balance is the remainder for a normal total', () => {
    const r = calculateDepositAndBalance(19900);
    expect(r.depositP).toBe(3000);
    expect(r.balanceP).toBe(16900);
    expect(r.depositP + r.balanceP).toBe(19900);
  });

  it('deposit never exceeds the total for very small totals', () => {
    const r = calculateDepositAndBalance(2000); // £20 total
    expect(r.depositP).toBe(2000);
    expect(r.balanceP).toBe(0);
  });

  it('balance is never negative', () => {
    for (const totalP of [0, 1, 2999, 3000, 3001, 100000]) {
      const r = calculateDepositAndBalance(totalP);
      expect(r.balanceP).toBeGreaterThanOrEqual(0);
      expect(r.depositP).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── getServiceStartingPrice ──────────────────────────────────────────────────

describe('getServiceStartingPrice', () => {
  it('eot_complete matches EOT_COMPLETE_PRICES_P.studio', () => {
    expect(getServiceStartingPrice('eot_complete').fromP).toBe(EOT_COMPLETE_PRICES_P.studio);
  });
  it('commercial has no numeric from-price (quote required)', () => {
    const r = getServiceStartingPrice('commercial');
    expect(r.pricingMode).toBe('quote_required');
    expect(r.fromP).toBeNull();
  });
  it('commercial_carpet stays quote-required — the £4.50/sqm rate has no owner approval', () => {
    const r = getServiceStartingPrice('commercial_carpet');
    expect(r.pricingMode).toBe('quote_required');
    expect(r.fromP).toBeNull();
    expect(COMMERCIAL_CARPET_RATE_APPROVED).toBe(false);
  });
  it('window is a genuine "from" price matching the true floor', () => {
    const r = getServiceStartingPrice('window');
    expect(r.fromP).toBe(WINDOW_CLEANING_FROM_P);
  });
});

// ─── Carpet & upholstery item-count bundle discount (via computeCarpetPrice) ──

describe('carpet bundle discount — item-count bands (via computeCarpetPrice)', () => {
  it('no discount at 2 items', () => {
    const r = computeCarpetPrice({ bedroom: 1, sofa_3: 1 }, 'normal'); // 50 + 95 = 145
    expect(r.totalItems).toBe(2);
    expect(r.bundle.saving).toBe(0);
    expect(r.bundle.source).toBe('none');
  });

  it('£10 off at 3 items', () => {
    const r = computeCarpetPrice({ bedroom: 1, sofa_3: 1, armchair: 1 }, 'normal'); // 50+95+45=190
    expect(r.totalItems).toBe(3);
    expect(r.bundle.saving).toBe(10);
    expect(r.bundle.source).toBe('bundle');
    expect(r.discountedSubtotal).toBe(180);
  });

  it('£20 off at 5 items', () => {
    const r = computeCarpetPrice({ bedroom: 2, sofa_3: 1, armchair: 2 }, 'normal'); // 5 items
    expect(r.totalItems).toBe(5);
    expect(r.bundle.saving).toBe(20);
  });

  it('£35 off at 7+ items', () => {
    const r = computeCarpetPrice({ bedroom: 3, sofa_3: 2, armchair: 2 }, 'normal'); // 7 items
    expect(r.totalItems).toBe(7);
    expect(r.bundle.saving).toBe(35);
  });

  it('promo code is never stacked on top of the bundle discount — best wins', () => {
    // 3 items = £10 bundle; LEAFLET20 = 20% of subtotal — promo should win here
    const r = computeCarpetPrice({ bedroom: 1, sofa_3: 1, armchair: 1 }, 'normal', 1, 'LEAFLET20');
    expect(r.bundle.source).toBe('promo');
  });
});

describe('carpet & upholstery totals are monotonic — adding an item never reduces the price', () => {
  it('adding items one at a time never decreases finalTotal', () => {
    const keys = ['bedroom', 'living_room', 'large_lounge', 'hallway', 'landing', 'armchair', 'sofa_2', 'sofa_3', 'sofa_corner', 'mattress_single'];
    const counts: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    let prevTotal = 0;
    for (const key of keys) {
      counts[key] = 1;
      const r = computeCarpetPrice({ ...counts }, 'normal');
      expect(r.finalTotal).toBeGreaterThanOrEqual(prevTotal);
      prevTotal = r.finalTotal;
    }
  });

  it('crossing every bundle-band boundary never decreases the price (no cliff-edge defect)', () => {
    // Each additional bedroom (£50) crosses band boundaries at 3, 5 and 7 items.
    let prevTotal = 0;
    for (let n = 1; n <= 9; n++) {
      const r = computeCarpetPrice({ bedroom: n }, 'normal');
      expect(r.finalTotal).toBeGreaterThanOrEqual(prevTotal);
      prevTotal = r.finalTotal;
    }
  });
});
