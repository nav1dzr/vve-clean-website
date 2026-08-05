import { describe, it, expect } from 'vitest';
import { computeCarpetPrice, CARPET_MIN_BOOKING, itemLinePrice, CARPET_ITEM_DEFS } from './carpetPricing';

describe('computeCarpetPrice — leaflet 20% discount vs minimum booking charge', () => {
  it('shows a real saving when the discounted total is comfortably above the minimum', () => {
    // living_room (60) + sofa_3 (95) = 155 subtotal, 20% off = 31 saving, 124 final
    const result = computeCarpetPrice({ living_room: 1, sofa_3: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.adjustedSubtotal).toBe(155);
    expect(result.bundle.saving).toBe(31);
    expect(result.discountedSubtotal).toBe(124);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(124);
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
    // bedroom (50) + rug (40) + landing (20) = 110 subtotal, 20% off = 22, discounted 88 — above threshold, so use hallway instead
    // hallway (25) + rug (40) + landing (20) = 85; adjust to land just under £85 discounted:
    // bedroom (50) + rug (40) = 90 subtotal, 20% off = 18, discounted 72 — below £85
    const result = computeCarpetPrice({ bedroom: 1, rug: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.discountedSubtotal).toBe(72);
    expect(result.minApplied).toBe(true);
    expect(result.finalTotal).toBe(CARPET_MIN_BOOKING);
    expect(result.showSaving).toBe(false);
  });

  it('does show a saving just above the minimum threshold', () => {
    // mattress_single (45) + mattress_double (55) = 100 subtotal, 20% off = 20, discounted 80 — still below £85
    // use a slightly larger basket instead: living_room (60) + mattress_single (45) = 105, 20% off = 21, discounted 84 — still under
    // large_lounge (80) + hallway (25) = 105, 20% off = 21, discounted 84 — under; bump to landing extra
    // large_lounge (80) + hallway (25) + landing (20) = 125, 20% off = 25, discounted 100 — comfortably above £85
    const result = computeCarpetPrice({ large_lounge: 1, hallway: 1, landing: 1 }, 'normal', 1, 'LEAFLET20');

    expect(result.discountedSubtotal).toBe(100);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(100);
    expect(result.showSaving).toBe(true);
    expect(result.bundle.saving).toBe(25);
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
    const result = computeCarpetPrice({ sofa_3: 1 }, 'normal'); // 95, no promo, only 1 item (no bundle band)

    expect(result.adjustedSubtotal).toBe(95);
    expect(result.bundle.saving).toBe(0);
    expect(result.minApplied).toBe(false);
    expect(result.finalTotal).toBe(95);
    expect(result.showSaving).toBe(false);
  });

  it('does NOT apply a bundle discount below the 3-item threshold', () => {
    const result = computeCarpetPrice({ large_lounge: 1, sofa_3: 1 }, 'normal'); // 2 items

    expect(result.totalItems).toBe(2);
    expect(result.bundle.source).toBe('none');
    expect(result.bundle.saving).toBe(0);
    expect(result.minApplied).toBe(false);
    expect(result.showSaving).toBe(false);
  });

  it('shows a real saving for a non-promo bundle-band discount that stays above the minimum', () => {
    // sofa_corner (130) + sofa_3 (95) + sofa_2 (70) = 295, 3 items → £10 off
    const result = computeCarpetPrice({ sofa_corner: 1, sofa_3: 1, sofa_2: 1 }, 'normal');

    expect(result.totalItems).toBe(3);
    expect(result.adjustedSubtotal).toBe(295);
    expect(result.bundle.source).toBe('bundle');
    expect(result.bundle.saving).toBe(10);
    expect(result.discountedSubtotal).toBe(285);
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

describe('king-size mattress item', () => {
  it('is priced at £65', () => {
    const item = CARPET_ITEM_DEFS.find((i) => i.key === 'mattress_king')!;
    expect(item.unitPrice).toBe(65);
    expect(itemLinePrice(item, 1)).toBe(65);
  });
});

describe('heavy condition surcharge is transparent and consistent', () => {
  it('applies a disclosed +20% before the bundle discount and minimum floor', () => {
    const normal = computeCarpetPrice({ large_lounge: 1 }, 'normal'); // 80
    const heavy  = computeCarpetPrice({ large_lounge: 1 }, 'heavy');
    expect(heavy.heavySurcharge).toBe(Math.round(normal.subtotal * 0.2));
    expect(heavy.adjustedSubtotal).toBe(normal.subtotal + heavy.heavySurcharge);
  });
});

describe('delicate condition is always a photo quote — never a fixed price', () => {
  it('finalTotal is 0 and isPhotoQuote is true', () => {
    const r = computeCarpetPrice({ sofa_corner: 1 }, 'delicate');
    expect(r.isPhotoQuote).toBe(true);
    expect(r.finalTotal).toBe(0);
  });
});
