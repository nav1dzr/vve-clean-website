// Pricing-parity guard for the redesigned End of Tenancy quote.
//
// The quote UI was redesigned; the prices must not have moved by a single
// penny. These cases pin the engine against the figures already documented in
// PRICING_SYSTEM.md, EndOfTenancyPage.test.tsx and the public pricing table.
// If a redesign ever changes arithmetic instead of presentation, this fails.

import { describe, it, expect } from 'vitest';
import { computeEotQuote, type EotQuoteConfig } from './eotPricing';
import {
  EOT_BASE_PRICES_P,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  DEPOSIT_P,
} from '../data/pricing';

const base = (over: Partial<EotQuoteConfig> = {}): EotQuoteConfig => ({
  propertyType: 'flat',
  size: 'bed2',
  bathrooms: 1,
  counts: {},
  carpetWholeHome: false,
  scopeExclusions: [],
  ...over,
});

describe('EOT quote engine — base package prices are unchanged', () => {
  it.each([
    ['studio', 22900],
    ['bed1',   29900],
    ['bed2',   36900],
    ['bed3',   44900],
    ['bed4',   54900],
  ] as const)('%s flat with one bathroom totals %ip', (size, expected) => {
    const r = computeEotQuote(base({ size }));
    expect(r.basePence).toBe(EOT_BASE_PRICES_P[size]);
    expect(r.totalPence).toBe(expected);
    expect(r.isTailored).toBe(false);
  });

  it('never produces a fixed price for 5+ bedrooms', () => {
    const r = computeEotQuote(base({ size: 'bed5' }));
    expect(r.isTailored).toBe(true);
    expect(r.totalPence).toBe(0);
  });
});

describe('EOT quote engine — adjustments', () => {
  it('adds the £35 house adjustment for a house, never for a flat', () => {
    expect(computeEotQuote(base({ size: 'bed4', propertyType: 'house' })).totalPence)
      .toBe(54900 + EOT_HOUSE_ADJUSTMENT_P);
    expect(computeEotQuote(base({ size: 'bed4', propertyType: 'flat' })).totalPence)
      .toBe(54900);
  });

  it('prices the documented four-bedroom house example at £584', () => {
    const r = computeEotQuote(base({ size: 'bed4', propertyType: 'house' }));
    expect(r.totalPence).toBe(58400);
  });

  it('charges £50 per additional full bathroom beyond the first', () => {
    expect(computeEotQuote(base({ bathrooms: 1 })).extraBathroomPence).toBe(0);
    expect(computeEotQuote(base({ bathrooms: 2 })).extraBathroomPence).toBe(EOT_EXTRA_BATH_P);
    expect(computeEotQuote(base({ bathrooms: 3 })).extraBathroomPence).toBe(2 * EOT_EXTRA_BATH_P);
    expect(computeEotQuote(base({ bathrooms: 3 })).totalPence).toBe(36900 + 10000);
  });

  it('charges £25 per additional WC as an optional extra', () => {
    const r = computeEotQuote(base({ counts: { extra_wc: 1 } }));
    expect(r.extrasPence).toBe(EOT_EXTRA_WC_P);
    expect(r.totalPence).toBe(36900 + 2500);
  });
});

describe('EOT quote engine — scope credits stay capped', () => {
  it('applies a single credit at face value', () => {
    const r = computeEotQuote(base({ scopeExclusions: ['oven'] }));
    expect(r.scopeCreditPence).toBe(1500);
    expect(r.totalPence).toBe(36900 - 1500);
  });

  it('never exceeds the £30 absolute cap', () => {
    const r = computeEotQuote(base({
      size: 'bed4',
      scopeExclusions: ['oven', 'fridge_freezer', 'cupboards', 'internal_windows'],
    }));
    // Requested 15+10+10+10 = £45, capped to £30.
    expect(r.scopeCreditPence).toBe(3000);
    expect(r.totalPence).toBe(54900 - 3000);
  });

  it('never exceeds 10% of the base price on the smallest property', () => {
    const r = computeEotQuote(base({
      size: 'studio',
      scopeExclusions: ['oven', 'fridge_freezer', 'cupboards', 'internal_windows'],
    }));
    // 10% of £229 floored to whole pounds = £22.
    expect(r.scopeCreditPence).toBe(2200);
    expect(r.totalPence).toBe(22900 - 2200);
  });

  it('reports the pre-credit standard price for honest strike-through', () => {
    const r = computeEotQuote(base({ scopeExclusions: ['oven'] }));
    expect(r.standardPence).toBe(36900);
  });
});

describe('EOT quote engine — access charges are never priced here', () => {
  it('exposes no parking or Congestion Charge fields at all', () => {
    const r = computeEotQuote(base());
    // The quote must not ask for or price access charges. BookingPage asks the
    // two required questions once and adds them on top of totalPence, and the
    // server recomputes them from quoteConfig. Reintroducing them here would
    // double-charge the customer or desynchronise the two totals.
    expect(r).not.toHaveProperty('parkingPence');
    expect(r).not.toHaveProperty('congestionPence');
    expect(r).not.toHaveProperty('accessChargesPence');
    expect(r).not.toHaveProperty('totalWithAccessPence');
    expect(r).not.toHaveProperty('accessLines');
  });

  it('keeps the deposit inside the total and reports the remaining balance', () => {
    const r = computeEotQuote(base());
    expect(r.depositPence).toBe(DEPOSIT_P);
    expect(r.balancePence).toBe(r.totalPence - DEPOSIT_P);
  });
});

describe('EOT quote engine — optional upgrades', () => {
  it('prices the whole-home carpet bundle per property size', () => {
    expect(computeEotQuote(base({ size: 'bed3', carpetWholeHome: true })).totalPence)
      .toBe(44900 + 15000);
  });

  it('multiplies unit prices by quantity', () => {
    const r = computeEotQuote(base({ counts: { eot_sofa_3: 2 } }));
    expect(r.optionalLines.find((l) => l.key === 'eot_sofa_3')?.qty).toBe(2);
    expect(r.totalPence).toBe(36900 + r.optionalLines[0].pence);
  });

  it('ignores zero and negative counts', () => {
    const r = computeEotQuote(base({ counts: { eot_sofa_3: 0, reception: -1 } }));
    expect(r.optionalLines).toHaveLength(0);
    expect(r.totalPence).toBe(36900);
  });
});

describe('EOT quote engine — breakdown integrity', () => {
  it('reconciles every displayed line back to the total', () => {
    const r = computeEotQuote(base({
      size: 'bed3', propertyType: 'house', bathrooms: 2,
      counts: { reception: 1, eot_sofa_2: 1 }, carpetWholeHome: true,
      scopeExclusions: ['oven'],
    }));
    const summed =
      r.baseLine.pence
      + r.adjustmentLines.reduce((s, l) => s + l.pence, 0)
      + r.optionalLines.reduce((s, l) => s + l.pence, 0)
      + r.creditLines.reduce((s, l) => s + l.pence, 0);
    expect(summed).toBe(r.totalPence);
  });
});
