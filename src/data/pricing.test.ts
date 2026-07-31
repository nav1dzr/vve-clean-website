import { describe, it, expect } from 'vitest';
import {
  CARPET_BUNDLE_TIERS,
  CARPET_MIN_BOOKING_P,
  EOT_BASE_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_SCOPE_CREDIT_MAX_P,
  eotScopeCreditPence,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  SAME_DAY_POLICY_SHORT,
  stairsLinePricePence,
  penceToDisplay,
} from './pricing';
import { computeCarpetPrice, CARPET_MIN_BOOKING } from './carpetPricing';

// ─── Canonical price values ───────────────────────────────────────────────────

describe('EOT base prices — canonical values in pence', () => {
  it.each([
    ['studio', 22900],
    ['bed1',   29900],
    ['bed2',   36900],
    ['bed3',   44900],
    ['bed4',   54900],
  ])('%s is %ip', (key, expected) => {
    expect(EOT_BASE_PRICES_P[key]).toBe(expected);
  });

  it('extra bath is £50 (5000p)', () => expect(EOT_EXTRA_BATH_P).toBe(5000));
  it('extra WC is £25 (2500p)', () => expect(EOT_EXTRA_WC_P).toBe(2500));
});

describe('EOT scope credits', () => {
  it('applies the approved item credits', () => {
    expect(eotScopeCreditPence(44900, ['oven', 'fridge_freezer'])).toBe(2500);
  });

  it('caps combined credits at £30', () => {
    expect(eotScopeCreditPence(44900, [
      'oven',
      'fridge_freezer',
      'cupboards',
      'internal_windows',
    ])).toBe(EOT_SCOPE_CREDIT_MAX_P);
  });

  it('also caps the reduction at 10% of the base price, rounded down to pounds', () => {
    expect(eotScopeCreditPence(22900, [
      'oven',
      'fridge_freezer',
      'cupboards',
    ])).toBe(2200);
  });

  it('does not count duplicates or unknown keys', () => {
    expect(eotScopeCreditPence(29900, ['oven', 'oven', 'unknown'])).toBe(1500);
  });
});

describe('move-in base prices — canonical values in pence', () => {
  it.each([
    ['studio', 17900],
    ['bed1',   21900],
    ['bed2',   26900],
    ['bed3',   32900],
    ['bed4',   42900],
  ])('%s is %ip', (key, expected) => {
    expect(MOVEIN_BASE_PRICES_P[key]).toBe(expected);
  });

  it('extra bath is £40 (4000p)', () => expect(MOVEIN_EXTRA_BATH_P).toBe(4000));
});

describe('after-builders from prices — canonical values in pence', () => {
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

describe('EOT carpet add-on prices', () => {
  it.each([
    ['bedroom',     4000],
    ['living_room', 5500],
    ['large_lounge',7500],
    ['hallway',     2000],
    ['landing',     1200],
    ['stairs_first',4500],
    ['stairs_extra',3500],
  ])('%s is %ip', (key, expected) => {
    expect(EOT_CARPET_ADDON_PRICES_P[key]).toBe(expected);
  });

  it('EOT carpet add-on bedroom (£40) is less than standalone carpet bedroom (£50)', () => {
    // EOT add-on pricing is always lower than standalone because travel/setup is already covered.
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

// ─── CARPET_BUNDLE_TIERS structure ───────────────────────────────────────────

describe('CARPET_BUNDLE_TIERS', () => {
  it('has exactly 3 tiers', () => {
    expect(CARPET_BUNDLE_TIERS).toHaveLength(3);
  });

  it('is ordered highest-first (descending minP)', () => {
    for (let i = 1; i < CARPET_BUNDLE_TIERS.length; i++) {
      expect(CARPET_BUNDLE_TIERS[i].minP).toBeLessThan(CARPET_BUNDLE_TIERS[i - 1].minP);
    }
  });

  it('has thresholds at £250, £400 and £600', () => {
    const thresholds = CARPET_BUNDLE_TIERS.map(t => t.minP);
    expect(thresholds).toContain(25000);
    expect(thresholds).toContain(40000);
    expect(thresholds).toContain(60000);
  });

  it('has percentages 5, 7.5 and 10', () => {
    const pcts = CARPET_BUNDLE_TIERS.map(t => t.pct).sort((a, b) => a - b);
    expect(pcts).toEqual([5, 7.5, 10]);
  });
});

// ─── stairsLinePricePence ─────────────────────────────────────────────────────

describe('stairsLinePricePence', () => {
  it('0 flights → 0p', () => expect(stairsLinePricePence(0)).toBe(0));
  it('1 flight  → 5500p (£55)',  () => expect(stairsLinePricePence(1)).toBe(5500));
  it('2 flights → 9500p (£95)',  () => expect(stairsLinePricePence(2)).toBe(9500));
  it('3 flights → 13500p (£135)', () => expect(stairsLinePricePence(3)).toBe(13500));
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

// ─── Carpet bundle discount tier boundaries ───────────────────────────────────
//
// Items used (all in £):
//   bedroom 50, living_room 70, large_lounge 90, hallway 25, landing 15,
//   sofa_2 75, sofa_3 95, sofa_corner 130, mattress_single 45, armchair 50

describe('carpet bundle discount tier boundaries (via computeCarpetPrice)', () => {
  it('no discount at £200 — below the £250 threshold', () => {
    // large_lounge (90) + sofa_3 (95) + landing (15) = 200
    const r = computeCarpetPrice({ large_lounge: 1, sofa_3: 1, landing: 1 }, 'normal');
    expect(r.adjustedSubtotal).toBe(200);
    expect(r.bundle.saving).toBe(0);
    expect(r.bundle.source).toBe('none');
    expect(r.showSaving).toBe(false);
  });

  it('5% at exactly £250 threshold', () => {
    // sofa_corner (130) + sofa_2 (75) + mattress_single (45) = 250
    const r = computeCarpetPrice({ sofa_corner: 1, sofa_2: 1, mattress_single: 1 }, 'normal');
    expect(r.adjustedSubtotal).toBe(250);
    expect(r.bundle.pct).toBe(5);
    // Math.round(250 * 5/100) = Math.round(12.5) = 13
    expect(r.bundle.saving).toBe(13);
    expect(r.discountedSubtotal).toBe(237);
    expect(r.showSaving).toBe(true);
  });

  it('5% at £300 (between £250 and £400)', () => {
    // sofa_corner (130) + sofa_3 (95) + sofa_2 (75) = 300
    const r = computeCarpetPrice({ sofa_corner: 1, sofa_3: 1, sofa_2: 1 }, 'normal');
    expect(r.adjustedSubtotal).toBe(300);
    expect(r.bundle.pct).toBe(5);
    expect(r.bundle.saving).toBe(15);  // Math.round(15) = 15
    expect(r.discountedSubtotal).toBe(285);
    expect(r.showSaving).toBe(true);
  });

  it('5% at £395 — just below the £400 → 7.5% threshold', () => {
    // sofa_corner (130) + sofa_3 (95) + sofa_2 (75) + armchair (50) + mattress_single (45) = 395
    const r = computeCarpetPrice(
      { sofa_corner: 1, sofa_3: 1, sofa_2: 1, armchair: 1, mattress_single: 1 },
      'normal',
    );
    expect(r.adjustedSubtotal).toBe(395);
    expect(r.bundle.pct).toBe(5);
    // Math.round(395 * 5/100) = Math.round(19.75) = 20
    expect(r.bundle.saving).toBe(20);
    expect(r.discountedSubtotal).toBe(375);
    expect(r.showSaving).toBe(true);
  });

  it('7.5% at exactly £400 threshold', () => {
    // sofa_corner (130) + sofa_3 (95) + sofa_2 (75) + bedroom (50) × 2 = 400
    const r = computeCarpetPrice(
      { sofa_corner: 1, sofa_3: 1, sofa_2: 1, bedroom: 2 },
      'normal',
    );
    expect(r.adjustedSubtotal).toBe(400);
    expect(r.bundle.pct).toBe(7.5);
    // Math.round(400 * 7.5/100) = Math.round(30) = 30
    expect(r.bundle.saving).toBe(30);
    expect(r.discountedSubtotal).toBe(370);
    expect(r.showSaving).toBe(true);
  });

  it('7.5% at £540 (between £400 and £600)', () => {
    // sofa_corner (130) × 2 + sofa_3 (95) × 2 + large_lounge (90) = 540
    const r = computeCarpetPrice({ sofa_corner: 2, sofa_3: 2, large_lounge: 1 }, 'normal');
    expect(r.adjustedSubtotal).toBe(540);
    expect(r.bundle.pct).toBe(7.5);
    // Math.round(540 * 7.5/100) = Math.round(40.5) = 41
    expect(r.bundle.saving).toBe(41);
    expect(r.discountedSubtotal).toBe(499);
    expect(r.showSaving).toBe(true);
  });

  it('10% at exactly £600 threshold', () => {
    // sofa_corner (130) × 2 + sofa_3 (95) × 2 + sofa_2 (75) × 2 = 600
    const r = computeCarpetPrice({ sofa_corner: 2, sofa_3: 2, sofa_2: 2 }, 'normal');
    expect(r.adjustedSubtotal).toBe(600);
    expect(r.bundle.pct).toBe(10);
    expect(r.bundle.saving).toBe(60);
    expect(r.discountedSubtotal).toBe(540);
    expect(r.showSaving).toBe(true);
  });

  it('promo code is never stacked on top of bundle discount — best wins', () => {
    // At £300 (5% bundle): bundle saving = 15, LEAFLET20 saving = 60 → LEAFLET20 wins
    const r = computeCarpetPrice({ sofa_corner: 1, sofa_3: 1, sofa_2: 1 }, 'normal', 1, 'LEAFLET20');
    expect(r.adjustedSubtotal).toBe(300);
    // 20% promo vs 5% bundle — promo wins; savings are NOT added together
    expect(r.bundle.saving).toBe(60);   // promoSave = Math.round(300*20/100) = 60
    expect(r.bundle.source).toBe('promo');
    expect(r.discountedSubtotal).toBe(240);
    expect(r.showSaving).toBe(true);
  });

  it('same-day bookings: no parameter exists and discount tiers apply normally', () => {
    // By design, computeCarpetPrice has no same-day parameter — same-day bookings
    // use standard prices. This test documents the API contract.
    const r = computeCarpetPrice({ sofa_corner: 1, sofa_3: 1, sofa_2: 1 }, 'normal');
    // Standard 5% bundle tier applies
    expect(r.bundle.pct).toBe(5);
    expect(r.adjustedSubtotal).toBe(300);
  });
});
