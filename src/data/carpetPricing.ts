// Carpet & upholstery itemised pricing engine.
// Kept separate so /leaflet or partner pages can import with a custom multiplier.

export const CARPET_MIN_BOOKING = 85;

// Bundle discount tiers applied to the carpet/upholstery eligible subtotal
const BUNDLE_TIERS = [
  { min: 400, pct: 12 },
  { min: 300, pct: 10 },
  { min: 200, pct:  5 },
] as const;
const MAX_BUNDLE_SAVING = 60;

// Promo codes: key → discount percentage
const PROMO_CODES: Record<string, number> = {
  LEAFLET20: 20,
};

export interface BundleInfo {
  pct:         number;              // discount percentage applied (0 if none)
  saving:      number;              // £ saved (0 if none)
  source:      'bundle' | 'promo' | 'none';
  preDiscount: number;              // adjustedSubtotal before discount (for strikethrough)
  nextTier:    number | null;       // next tier threshold (200/300/400) or null
  toNextTier:  number;              // £ to add to reach next tier (0 if not within £40)
  nextTierPct: number;              // pct at next tier
}

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
  bundle:           BundleInfo;
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
  multiplier  = 1,
  promoCode?: string,
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

  // ── Bundle / promo discount (applied after condition multiplier) ──────────
  const promoPct      = promoCode ? (PROMO_CODES[promoCode.toUpperCase()] ?? 0) : 0;
  const tier          = BUNDLE_TIERS.find((t) => adjustedSubtotal >= t.min);
  const rawBundleSave = tier ? Math.round(adjustedSubtotal * tier.pct / 100) : 0;
  const bundleSave    = Math.min(rawBundleSave, MAX_BUNDLE_SAVING);
  const promoSave     = promoPct > 0 ? Math.round(adjustedSubtotal * promoPct / 100) : 0;
  const finalSaving   = Math.max(bundleSave, promoSave);
  const bundleSource: BundleInfo['source'] =
    finalSaving === 0        ? 'none'
    : promoSave > bundleSave ? 'promo'
    : 'bundle';
  const bundlePct = bundleSource === 'promo' ? promoPct : (tier?.pct ?? 0);

  // Next-tier nudge: show if within £40 of the next higher tier
  const ALL_TIERS = [
    { threshold: 200, pct: 5 },
    { threshold: 300, pct: 10 },
    { threshold: 400, pct: 12 },
  ];
  const nextTierEntry  = ALL_TIERS.find((t) => t.threshold > adjustedSubtotal) ?? null;
  const toNextTier     = nextTierEntry ? nextTierEntry.threshold - adjustedSubtotal : 0;
  const showNudge      = toNextTier > 0 && toNextTier <= 40;

  const bundle: BundleInfo = {
    pct:         bundlePct,
    saving:      finalSaving,
    source:      bundleSource,
    preDiscount: adjustedSubtotal,
    nextTier:    showNudge ? nextTierEntry!.threshold : null,
    toNextTier:  showNudge ? toNextTier : 0,
    nextTierPct: showNudge ? nextTierEntry!.pct : 0,
  };

  // ── Min booking (applied after discount) ──────────────────────────────────
  const discountedSubtotal = adjustedSubtotal - finalSaving;
  const minApplied         = !isPhotoQuote && discountedSubtotal > 0 && discountedSubtotal < CARPET_MIN_BOOKING;
  const minAdjustment      = minApplied ? CARPET_MIN_BOOKING - discountedSubtotal : 0;
  const finalTotal         = isPhotoQuote
    ? 0
    : discountedSubtotal > 0
      ? Math.max(discountedSubtotal, CARPET_MIN_BOOKING)
      : 0;

  const totalItems = Object.values(counts).reduce<number>((s, v) => s + (v ?? 0), 0);

  return {
    lines, subtotal, heavySurcharge, adjustedSubtotal,
    bundle, minAdjustment, finalTotal, minApplied, totalItems, isPhotoQuote,
  };
}
