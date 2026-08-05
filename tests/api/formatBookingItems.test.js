import { describe, it, expect } from 'vitest';
import {
  formatBookingItemLines,
  formatServiceDetail,
  splitServiceDetail,
} from '../../api/_lib/formatBookingItems.js';

describe('formatBookingItemLines — carpet & upholstery', () => {
  it('lists exact selected items, not a broad category, in Carpets-then-Sofas order', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCounts: { mattress_double: 1, sofa_3: 1 },
    });
    expect(lines).toEqual(['1 × 3-seater sofa', '1 × Mattress (double)']);
  });

  it('lists rooms, stairs and rugs with correct quantities', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCounts: { bedroom: 2, stairs: 1, rug: 1 },
    });
    expect(lines).toEqual(['2 × Bedroom', '1 × Stairs', '1 × Rug']);
  });

  it('lists armchairs and every sofa size distinctly', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCounts: { armchair: 1, sofa_2: 1, sofa_corner: 1 },
    });
    expect(lines).toEqual(['1 × Armchair', '1 × 2-seater sofa', '1 × Corner / L-shaped sofa']);
  });

  it('omits zero-quantity items', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCounts: { bedroom: 0, rug: 2, hallway: 0 },
    });
    expect(lines).toEqual(['2 × Rug']);
  });

  it('still itemises for a manual/delicate-condition quote (price unknown, items known)', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCondition: 'delicate',
      carpetCounts: { living_room: 1 },
    });
    expect(lines).toEqual(['1 × Living / dining room']);
  });

  it('humanises an unrecognised future item key rather than dropping it', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCounts: { footstool: 2 },
    });
    expect(lines).toEqual(['2 × Footstool']);
  });
});

describe('formatBookingItemLines — end of tenancy / deep clean', () => {
  it('shows property size, bathroom count and included-free oven, with the Complete package named', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed2',
      deepBaths: 1,
      addOnCounts: {},
      eotPackage: 'complete',
    });
    expect(lines).toEqual(['End of tenancy (Complete Agency-Ready Clean) — 2 Bed, 1 bathroom', 'Inside oven (included free)']);
  });

  it('lists selected add-ons for end of tenancy — fridge is excluded (covered by Tailored add-ons / included in Complete)', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed3',
      deepBaths: 2,
      addOnCounts: { ext_windows: 1, fridge: 1 },
      eotPackage: 'complete',
    });
    expect(lines).toEqual([
      'End of tenancy (Complete Agency-Ready Clean) — 3 Bed, 2 bathrooms',
      'Inside oven (included free)',
      '1 × Exterior windows',
    ]);
  });

  it('names the Tailored package and lists selected internal add-ons, house adjustment and extra WCs', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed1',
      deepBaths: 1,
      deepWcs: 1,
      isHouse: true,
      eotPackage: 'tailored',
      addOnCounts: {},
      tailoredAddOns: { fridgeFreezerInside: true, extraFridgeFreezers: 2, dishwasherInside: false },
    });
    expect(lines).toEqual([
      'End of tenancy (Tailored Checklist Clean) — 1 Bed, 1 bathroom',
      'House / maisonette adjustment',
      '1 × Additional separate WC',
      'Inside oven (included free)',
      'Inside fridge/freezer',
      '2 × Additional fridge/freezer',
    ]);
  });

  it('lists add-ons for move-in and after-builders without the free-oven line', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'move_in',
      deepSize: 'studio',
      deepBaths: 1,
      addOnCounts: { oven: 1, wall_marks: 1 },
    });
    expect(lines).toEqual([
      'Move-in deep clean — Studio, 1 bathroom',
      '1 × Inside oven',
      '1 × Wall marks & scuffs',
    ]);
  });
});

describe('formatBookingItemLines — house/maisonette adjustment', () => {
  it('does not add a house-adjustment line for a flat', () => {
    const lines = formatBookingItemLines({
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed4',
      deepBaths: 1,
      isHouse: false,
      addOnCounts: {},
      eotPackage: 'complete',
    });
    expect(lines).toEqual([
      'End of tenancy (Complete Agency-Ready Clean) — 4 Bed, 1 bathroom',
      'Inside oven (included free)',
    ]);
  });
});

describe('formatBookingItemLines — access charges (parking / Congestion Charge)', () => {
  it('adds no access-charge line when parking is available and outside the zone', () => {
    const lines = formatBookingItemLines({
      service: 'window', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'no',
    });
    expect(lines).toEqual([
      'Window cleaning — 3 Bed',
      'Parking: free parking available — £0',
      'Congestion Charge zone: no — £0',
    ]);
  });

  it('adds the parking estimate line when parking is not available', () => {
    const lines = formatBookingItemLines({
      service: 'window', windowSize: 'medium', parkingAvailable: 'no',
    });
    expect(lines).toEqual([
      'Window cleaning — 3 Bed',
      'Parking: not available on-site — +£15 estimated parking allowance (charged at actual cost)',
    ]);
  });

  it('adds the parking estimate line when parking is not sure', () => {
    const lines = formatBookingItemLines({
      service: 'window', windowSize: 'medium', parkingAvailable: 'not_sure',
    });
    expect(lines).toEqual([
      'Window cleaning — 3 Bed',
      'Parking: not sure — +£15 estimated parking allowance (charged at actual cost)',
    ]);
  });

  it('adds the Congestion Charge line when the property is inside the zone', () => {
    const lines = formatBookingItemLines({
      service: 'window', windowSize: 'medium', congestionZone: 'yes',
    });
    expect(lines).toEqual([
      'Window cleaning — 3 Bed',
      'Congestion Charge zone — +£18 pass-through Congestion Charge',
    ]);
  });

  it('adds the estimated Congestion Charge line when not sure', () => {
    const lines = formatBookingItemLines({
      service: 'window', windowSize: 'medium', congestionZone: 'not_sure',
    });
    expect(lines).toEqual([
      'Window cleaning — 3 Bed',
      'Congestion Charge zone: not sure — £18 estimated pending address confirmation (pass-through Congestion Charge)',
    ]);
  });

  it('adds both lines when parking is unavailable and the property is in the zone', () => {
    const lines = formatBookingItemLines({
      service: 'gutter', gutterType: 'semi_detached', parkingAvailable: 'no', congestionZone: 'yes',
    });
    expect(lines).toEqual([
      'Gutter clearing — Semi-Detached',
      'Parking: not available on-site — +£15 estimated parking allowance (charged at actual cost)',
      'Congestion Charge zone — +£18 pass-through Congestion Charge',
    ]);
  });

  it('adds no access-charge lines for an unrecognised service, even with access-charge answers set', () => {
    expect(formatBookingItemLines({
      service: 'unknown_future_service', parkingAvailable: 'no', congestionZone: 'yes',
    })).toEqual([]);
  });
});

describe('formatBookingItemLines — window / gutter / office / unknown', () => {
  it('describes a window clean by property size', () => {
    expect(formatBookingItemLines({ service: 'window', windowSize: 'medium' }))
      .toEqual(['Window cleaning — 3 Bed']);
  });

  it('describes a gutter clean by property type', () => {
    expect(formatBookingItemLines({ service: 'gutter', gutterType: 'semi_detached' }))
      .toEqual(['Gutter clearing — Semi-Detached']);
  });

  it('describes an office clean by hours', () => {
    expect(formatBookingItemLines({ service: 'office', officeHours: 6 }))
      .toEqual(['Office cleaning — 6 hours']);
  });

  it('returns an empty array for a missing quoteConfig', () => {
    expect(formatBookingItemLines(null)).toEqual([]);
    expect(formatBookingItemLines(undefined)).toEqual([]);
  });

  it('returns an empty array for an unrecognised service', () => {
    expect(formatBookingItemLines({ service: 'unknown_future_service' })).toEqual([]);
  });
});

describe('formatServiceDetail — fallback to broad category', () => {
  it('joins item lines with newlines when item-level detail exists', () => {
    const detail = formatServiceDetail(
      { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { rug: 1, armchair: 1 } },
      'Carpet & upholstery · 2 items',
    );
    expect(detail).toBe('1 × Rug\n1 × Armchair');
  });

  it('falls back to the broad service category when there is no item-level detail', () => {
    const detail = formatServiceDetail({ service: 'deep', deepService: 'carpet_upholstery', carpetCounts: {} },
      'Carpet & upholstery · 0 items');
    expect(detail).toBe('Carpet & upholstery · 0 items');
  });

  it('falls back to the broad category for a missing quoteConfig', () => {
    expect(formatServiceDetail(null, 'End of tenancy — 2 Bed')).toBe('End of tenancy — 2 Bed');
  });

  it('returns an empty string when there is neither item detail nor a fallback', () => {
    expect(formatServiceDetail(null, '')).toBe('');
  });
});

describe('splitServiceDetail', () => {
  it('splits a newline-joined detail string back into trimmed lines', () => {
    expect(splitServiceDetail('1 × Rug\n1 × Armchair')).toEqual(['1 × Rug', '1 × Armchair']);
  });

  it('treats a single-line fallback string as one line', () => {
    expect(splitServiceDetail('Carpet & upholstery · 2 items')).toEqual(['Carpet & upholstery · 2 items']);
  });

  it('returns an empty array for empty/undefined input', () => {
    expect(splitServiceDetail('')).toEqual([]);
    expect(splitServiceDetail(undefined)).toEqual([]);
  });
});
