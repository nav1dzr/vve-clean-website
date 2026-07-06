// Carpet & upholstery itemised pricing engine.
// Kept separate so /leaflet or partner pages can import with a custom multiplier.

export const CARPET_MIN_BOOKING = 85;

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
  { key: 'bedroom',         label: 'Bedroom',                 group: 'Carpets',            unitPrice: 50 },
  { key: 'living_room',     label: 'Living / dining room',    group: 'Carpets',            unitPrice: 70 },
  { key: 'large_lounge',    label: 'Large or through lounge', group: 'Carpets',            unitPrice: 90 },
  { key: 'hallway',         label: 'Hallway',                 group: 'Carpets',            unitPrice: 25 },
  { key: 'landing',         label: 'Landing',                 group: 'Carpets',            unitPrice: 15 },
  { key: 'stairs',          label: 'Stairs',                  group: 'Carpets',            unitPrice: null,
    stairsFirst: 55, stairsExtra: 40,
    helper: 'One flight = one set of stairs between floors.' },
  { key: 'rug',             label: 'Rug',                     group: 'Carpets',            unitPrice: 40,
    helper: 'Large or wool rugs — send a photo for a tailored quote.' },
  // ── Sofas & Upholstery ───────────────────────────────────────
  { key: 'armchair',        label: 'Armchair',                group: 'Sofas & Upholstery', unitPrice: 50  },
  { key: 'sofa_2',          label: '2-seater sofa',           group: 'Sofas & Upholstery', unitPrice: 75  },
  { key: 'sofa_3',          label: '3-seater sofa',           group: 'Sofas & Upholstery', unitPrice: 95  },
  { key: 'sofa_corner',     label: 'Corner / L-shaped sofa',  group: 'Sofas & Upholstery', unitPrice: 130 },
  { key: 'mattress_single', label: 'Mattress (single)',        group: 'Sofas & Upholstery', unitPrice: 45  },
  { key: 'mattress_double', label: 'Mattress (double/king)',   group: 'Sofas & Upholstery', unitPrice: 65  },
];

// Pre-grouped for rendering
export const CARPET_GROUPS: { group: string; items: CarpetItem[] }[] = [
  { group: 'Carpets',            items: CARPET_ITEM_DEFS.filter(i => i.group === 'Carpets') },
  { group: 'Sofas & Upholstery', items: CARPET_ITEM_DEFS.filter(i => i.group === 'Sofas & Upholstery') },
];

export type CarpetCounts = Partial<Record<string, number>>;

export function stairsLinePrice(n: number): number {
  if (n <= 0) return 0;
  return 55 + (n - 1) * 40;
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

export interface CarpetPriceResult {
  lines:            CarpetPriceLine[];
  subtotal:         number;
  heavySurcharge:   number;  // 0 unless heavy condition
  adjustedSubtotal: number;  // subtotal + heavySurcharge
  minAdjustment:    number;  // 0 unless min booking applies
  finalTotal:       number;
  minApplied:       boolean;
  totalItems:       number;
  isPhotoQuote:     boolean; // true when condition === 'delicate'
}

/**
 * @param counts     - map of item key → quantity
 * @param condition  - 'normal' | 'heavy' | 'delicate'
 * @param multiplier - price multiplier (default 1). Pass e.g. 0.9 for 10% off on /leaflet.
 */
export function computeCarpetPrice(
  counts:     CarpetCounts,
  condition:  CarpetCondition,
  multiplier = 1,
): CarpetPriceResult {
  const isPhotoQuote = condition === 'delicate';

  const lines: CarpetPriceLine[] = [];
  let subtotal = 0;

  for (const item of CARPET_ITEM_DEFS) {
    const qty = counts[item.key] ?? 0;
    if (qty <= 0) continue;
    const lt = Math.round(itemLinePrice(item, qty) * multiplier);
    subtotal += lt;
    lines.push({ key: item.key, label: item.label, qty, lineTotal: lt });
  }

  const heavySurcharge   = condition === 'heavy' ? Math.round(subtotal * 0.2) : 0;
  const adjustedSubtotal = subtotal + heavySurcharge;
  const minApplied       = !isPhotoQuote && adjustedSubtotal > 0 && adjustedSubtotal < CARPET_MIN_BOOKING;
  const minAdjustment    = minApplied ? CARPET_MIN_BOOKING - adjustedSubtotal : 0;
  const finalTotal       = isPhotoQuote
    ? 0
    : adjustedSubtotal > 0
      ? Math.max(adjustedSubtotal, CARPET_MIN_BOOKING)
      : 0;

  const totalItems = Object.values(counts).reduce<number>((s, v) => s + (v ?? 0), 0);

  return {
    lines, subtotal, heavySurcharge, adjustedSubtotal,
    minAdjustment, finalTotal, minApplied, totalItems, isPhotoQuote,
  };
}
