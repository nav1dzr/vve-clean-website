import { describe, it, expect } from 'vitest';
import { computeCarpetPrice, CARPET_MIN_BOOKING } from './carpetPricing';

describe('computeCarpetPrice — leaflet 20% discount vs minimum booking charge', () => {
  it('shows a real saving when the discounted total is comfortably above the minimum', () => {
    // living_room (70) + sofa_3 (95) = 165 subtotal, 20% off = 33 saving, 132 final
    const result = computeCarpetPrice({ living_room: 1, sofa_3: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.adjustedSubtotal).toBe(165);
    expect(result.bundle.saving).toBe(33);
    expect(result.discountedSubtotal).toBe(132);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(132);
    expect(result.showSaving).toBe(true);
  });

  it('does NOT claim a saving when the minimum booking charge overrides the discount', () => {
    // bedroom (50) alone, 20% off = 10 saving, discounted subtotal 40 — well below £85
    const result = computeCarpetPrice({ bedroom: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.adjustedSubtotal).toBe(50);
    expect(result.bundle.saving).toBe(10); // the raw discount is still computed...
    expect(result.discountedSubtotal).toBe(40);
    expect(result.minApplied).toBe(true);
    expect(result.finalTotal).toBe(CARPET_MIN_BOOKING); // ...but the customer pays the £85 floor
    expect(result.showSaving).toBe(false); // ...so no "you save £X" claim should be shown
  });

  it('does not show a saving just below the minimum threshold (discounted subtotal £84)', () => {
    // bedroom (50) + rug (40) + landing (15) = 105 subtotal, 20% off = 21, discounted 84
    const result = computeCarpetPrice({ bedroom: 1, rug: 1, landing: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.discountedSubtotal).toBe(84);
    expect(result.minApplied).toBe(true);
    expect(result.finalTotal).toBe(CARPET_MIN_BOOKING);
    expect(result.showSaving).toBe(false);
  });

  it('does show a saving just above the minimum threshold (discounted subtotal £88)', () => {
    // mattress_single (45) + mattress_double (65) = 110 subtotal, 20% off = 22, discounted 88
    const result = computeCarpetPrice({ mattress_single: 1, mattress_double: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.discountedSubtotal).toBe(88);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(88);
    expect(result.showSaving).toBe(true);
    expect(result.bundle.saving).toBe(22);
  });

  it('never lets finalTotal fall below the minimum booking charge when a discount applies', () => {
    const result = computeCarpetPrice({ bedroom: 1 }, 'normal', 1, 'LEAFLET20');
    expect(result.finalTotal).toBeGreaterThanOrEqual(CARPET_MIN_BOOKING);
  });

  it('keeps discountedSubtotal + minAdjustment consistent with finalTotal when the minimum applies', () => {
    const result = computeCarpetPrice({ bedroom: 1 }, 'normal', 1, 'LEAFLET20');
    expect(result.discountedSubtotal + result.minAdjustment).toBe(result.finalTotal);
  });

  it('applies the minimum booking charge even with no discount at all (plain small job)', () => {
    const result = computeCarpetPrice({ bedroom: 1 }, 'normal'); // no promoCode

    expect(result.bundle.saving).toBe(0);
    expect(result.minApplied).toBe(true);
    expect(result.finalTotal).toBe(CARPET_MIN_BOOKING);
    expect(result.showSaving).toBe(false);
  });

  it('shows no discount and no minimum-charge note for a normal job with neither', () => {
    const result = computeCarpetPrice({ sofa_3: 1 }, 'normal'); // 95, no promo, no bundle tier

    expect(result.adjustedSubtotal).toBe(95);
    expect(result.bundle.saving).toBe(0);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(95);
    expect(result.showSaving).toBe(false);
  });

  it('shows a real saving for a non-promo bundle-tier discount that stays above the minimum', () => {
    // large_lounge (90) + sofa_3 (95) + landing (15) = 200 → 5% bundle tier
    const result = computeCarpetPrice({ large_lounge: 1, sofa_3: 1, landing: 1 }, 'normal');

    expect(result.adjustedSubtotal).toBe(200);
    expect(result.bundle.source).toBe('bundle');
    expect(result.bundle.saving).toBe(10);
    expect(result.discountedSubtotal).toBe(190);
    expect(result.minApplied).toBe(false);
    expect(result.showSaving).toBe(true);
  });

  it('the sum of finalTotal always accounts for both the discount and the minimum floor correctly', () => {
    const cases: Array<[Record<string, number>, string | undefined]> = [
      [{ bedroom: 1 }, 'LEAFLET20'],
      [{ living_room: 1, sofa_3: 1 }, 'LEAFLET20'],
      [{ sofa_3: 1 }, undefined],
    ];
    for (const [counts, promo] of cases) {
      const r = computeCarpetPrice(counts, 'normal', 1, promo);
      // finalTotal must always be either 0 (nothing selected), or at least the minimum.
      if (r.totalItems > 0) {
        expect(r.finalTotal).toBeGreaterThanOrEqual(CARPET_MIN_BOOKING);
      }
      // showSaving must never be true unless the discount is fully reflected in finalTotal.
      if (r.showSaving) {
        expect(r.adjustedSubtotal - r.finalTotal).toBe(r.bundle.saving);
      }
    }
  });
});
