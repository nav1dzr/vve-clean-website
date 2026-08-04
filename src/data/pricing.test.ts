import { describe, it, expect } from 'vitest';
import {
  CARPET_BUNDLE_BANDS,
  CARPET_MIN_BOOKING_P,
  EOT_COMPLETE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_GUARANTEE_HOURS,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_TAILORED_ADDON_PRICES_P,
  EOT_TAILORED_CUPBOARDS_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  MOVEIN_EXTRA_WC_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
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

describe('EOT Complete package — canonical values in pence', () => {
  it.each([
    ['studio', 19900],
    ['bed1',   24900],
    ['bed2',   31900],
    ['bed3',   37900],
    ['bed4',   49900],
  ])('%s is %ip', (key, expected) => {
    expect(EOT_COMPLETE_PRICES_P[key as keyof typeof EOT_COMPLETE_PRICES_P]).toBe(expected);
  });

  it('extra bath is £40 (4000p)', () => expect(EOT_EXTRA_BATH_P).toBe(4000));
  it('extra WC is £20 (2000p)', () => expect(EOT_EXTRA_WC_P).toBe(2000));
  it('house/maisonette adjustment is £30 (3000p)', () => expect(EOT_HOUSE_ADJUSTMENT_P).toBe(3000));
  it('guarantee window is 72 hours', () => expect(EOT_GUARANTEE_HOURS).toBe(72));
});

describe('EOT Tailored package — canonical starting values in pence', () => {
  it.each([
    ['studio', 15900],
    ['bed1',   19900],
    ['bed2',   25900],
    ['bed3',   31900],
    ['bed4',   41900],
  ])('%s is %ip', (key, expected) => {
    expect(EOT_TAILORED_START_PRICES_P[key as keyof typeof EOT_TAILORED_START_PRICES_P]).toBe(expected);
  });

  it('every Tailored starting price is below the equivalent Complete price', () => {
    for (const key of Object.keys(EOT_TAILORED_START_PRICES_P) as (keyof typeof EOT_TAILORED_START_PRICES_P)[]) {
      expect(EOT_TAILORED_START_PRICES_P[key]).toBeLessThan(EOT_COMPLETE_PRICES_P[key]);
    }
  });

  it('Tailored add-on prices', () => {
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

  it('building every Tailored add-on never costs less than Complete stays a better/equal deal at bed2', () => {
    // Complete bed2 = 31900p. Tailored bed2 (25900) + every add-on
    // (2500 + 1000 + 1000 + 3500 = 8000) = 33900p — Complete is cheaper,
    // which is exactly when the "switch to Complete" nudge should fire.
    const tailoredFull = EOT_TAILORED_START_PRICES_P.bed2 + 2500 + 1000 + 1000 + EOT_TAILORED_CUPBOARDS_PRICES_P.bed2;
    expect(tailoredFull).toBeGreaterThanOrEqual(EOT_COMPLETE_PRICES_P.bed2);
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
    expect(r.totalP).toBe(19900);
    expect(r.guaranteeScope).toBe('complete');
    expect(r.guaranteeHours).toBe(72);
    expect(r.shouldOfferComplete).toBe(false);
  });

  it('2 bed house with 1 extra bathroom and 1 extra WC', () => {
    const r = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: true, extraBathrooms: 1, extraWcs: 1 });
    // 31900 + 3000 (house) + 4000 (bath) + 2000 (wc) = 40900
    expect(r.totalP).toBe(40900);
  });

  it('negative bathroom/WC counts are treated as zero, never subtracted', () => {
    const r = calculateEotQuote({ size: 'studio', package: 'complete', isHouse: false, extraBathrooms: -3, extraWcs: -2 });
    expect(r.totalP).toBe(19900);
  });
});

describe('calculateEotQuote — Tailored package', () => {
  it('bare starting price with nothing added', () => {
    const r = calculateEotQuote({ size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    expect(r.totalP).toBe(19900);
    expect(r.guaranteeScope).toBe('selected-tasks');
  });

  it('adding every add-on for bed1', () => {
    const r = calculateEotQuote({
      size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0,
      tailoredAddOns: { fridgeFreezerInside: true, dishwasherInside: true, washingMachineInside: true, cupboards: true, extraFridgeFreezers: 1 },
    });
    // 19900 + 2500 + 1000 + 1000 + 2500 (cupboards bed1) + 1500 (extra fridge) = 28400
    expect(r.totalP).toBe(28400);
  });

  it('shouldOfferComplete becomes true once Tailored reaches the Complete price', () => {
    const r = calculateEotQuote({
      size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0,
      tailoredAddOns: { fridgeFreezerInside: true, dishwasherInside: true, washingMachineInside: true, cupboards: true },
    });
    // 25900 + 2500 + 1000 + 1000 + 3500 = 33900 >= Complete 31900
    expect(r.totalP).toBe(33900);
    expect(r.completeEquivalentP).toBe(31900);
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
  it('adding bathrooms, WCs, house adjustment and add-ons only ever raises the price', () => {
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
