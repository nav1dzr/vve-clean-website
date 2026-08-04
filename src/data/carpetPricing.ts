// Carpet & upholstery UI configuration + thin re-export of the shared
// calculation engine. The actual pricing logic (computeCarpetPrice) lives in
// ../../shared/pricingCatalogue.js — the single canonical source shared with
// the server and admin CRM. Do not reimplement pricing math here; this file
// only adds frontend-only presentational metadata (grouping, helper copy).

import {
  CARPET_MIN_BOOKING_P,
  CARPET_ITEM_PRICES_P,
  CARPET_ITEM_LABELS,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  stairsLinePricePence,
  computeCarpetPrice as _computeCarpetPrice,
} from '../../shared/pricingCatalogue.js';

// In pounds for components that display £ values.
export const CARPET_MIN_BOOKING = CARPET_MIN_BOOKING_P / 100;  // 85

// Shared customer-facing disclosure reused in the calculator, booking summary
// and leaflet page so the wording never drifts out of sync.
export const DISCOUNT_MIN_NOTE =
  `Book multiple carpet or upholstery items together and save automatically. ` +
  `£${CARPET_MIN_BOOKING} minimum booking applies.`;

export type CarpetCondition = 'normal' | 'heavy' | 'delicate';

export interface CarpetItem {
  key:         string;
  label:       string;
  group:       'Carpets' | 'Sofas & Upholstery';
  unitPrice:   number | null;  // null for stairs (non-linear)
  stairsFirst?: number;
  stairsExtra?: number;
  helper?:     string;
}

export const CARPET_ITEM_DEFS: CarpetItem[] = [
  // ── Carpets ──────────────────────────────────────────────────
  { key: 'bedroom',         label: CARPET_ITEM_LABELS.bedroom,         group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.bedroom         / 100 },
  { key: 'living_room',     label: CARPET_ITEM_LABELS.living_room,     group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.living_room     / 100 },
  { key: 'large_lounge',    label: CARPET_ITEM_LABELS.large_lounge,    group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.large_lounge    / 100 },
  { key: 'hallway',         label: CARPET_ITEM_LABELS.hallway,         group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.hallway         / 100 },
  { key: 'landing',         label: CARPET_ITEM_LABELS.landing,         group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.landing         / 100 },
  { key: 'stairs',          label: CARPET_ITEM_LABELS.stairs,          group: 'Carpets',            unitPrice: null,
    stairsFirst: STAIRS_FIRST_P / 100, stairsExtra: STAIRS_EXTRA_P / 100,
    helper: 'One flight = one set of stairs between floors.' },
  { key: 'rug',             label: CARPET_ITEM_LABELS.rug,             group: 'Carpets',            unitPrice: CARPET_ITEM_PRICES_P.rug             / 100,
    helper: 'Large, wool, silk or specialist rugs — send a photo for a tailored quote.' },
  // ── Sofas & Upholstery ───────────────────────────────────────
  { key: 'armchair',        label: CARPET_ITEM_LABELS.armchair,        group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.armchair        / 100  },
  { key: 'sofa_2',          label: CARPET_ITEM_LABELS.sofa_2,          group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.sofa_2          / 100  },
  { key: 'sofa_3',          label: CARPET_ITEM_LABELS.sofa_3,          group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.sofa_3          / 100  },
  { key: 'sofa_corner',     label: CARPET_ITEM_LABELS.sofa_corner,     group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.sofa_corner     / 100 },
  { key: 'mattress_single', label: CARPET_ITEM_LABELS.mattress_single, group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.mattress_single / 100  },
  { key: 'mattress_double', label: CARPET_ITEM_LABELS.mattress_double, group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.mattress_double / 100  },
  { key: 'mattress_king',   label: CARPET_ITEM_LABELS.mattress_king,   group: 'Sofas & Upholstery', unitPrice: CARPET_ITEM_PRICES_P.mattress_king   / 100  },
];

// Pre-grouped for rendering
export const CARPET_GROUPS: { group: string; items: CarpetItem[] }[] = [
  { group: 'Carpets',            items: CARPET_ITEM_DEFS.filter(i => i.group === 'Carpets') },
  { group: 'Sofas & Upholstery', items: CARPET_ITEM_DEFS.filter(i => i.group === 'Sofas & Upholstery') },
];

export type CarpetCounts = Partial<Record<string, number>>;

export function stairsLinePrice(n: number): number {
  return stairsLinePricePence(n) / 100;
}

export function itemLinePrice(item: CarpetItem, qty: number): number {
  if (qty <= 0) return 0;
  if (item.key === 'stairs') return stairsLinePrice(qty);
  return (item.unitPrice ?? 0) * qty;
}

export interface CarpetPriceLine {
  key:       string;
  label:     string;
  qty:       number;
  lineTotal: number;
}

export interface BundleInfo {
  saving:         number;
  source:         'bundle' | 'promo' | 'none';
  preDiscount:    number;
  itemCount:      number;
  display:        string;
  nextBandItems:  number | null;
  toNextBand:     number;
  nextBandSaving: number;
}

export interface CarpetPriceResult {
  lines:              CarpetPriceLine[];
  subtotal:           number;
  heavySurcharge:     number;
  adjustedSubtotal:   number;
  bundle:             BundleInfo;
  discountedSubtotal: number;
  minAdjustment:      number;
  finalTotal:         number;
  minApplied:         boolean;
  showSaving:         boolean;
  totalItems:         number;
  isPhotoQuote:       boolean;
}

// Re-typed wrapper — the runtime implementation (and the only place the
// actual pricing math lives) is computeCarpetPrice in the shared module,
// which is also what api/servicePrices.js calls server-side. This wrapper
// just attaches the TypeScript return type above for frontend consumers;
// exported under the original name so existing call sites are unaffected.
export function computeCarpetPrice(
  counts: CarpetCounts,
  condition: CarpetCondition,
  multiplier = 1,
  promoCode?: string,
): CarpetPriceResult {
  return _computeCarpetPrice(counts as Record<string, number>, condition, multiplier, promoCode) as CarpetPriceResult;
}
