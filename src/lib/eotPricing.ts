// End of Tenancy quote pricing — headless engine shared by every EOT quote UI.
//
// IMPORTANT: this module introduces NO new prices. Every figure comes through
// src/data/pricing.ts from admin/shared/pricingCatalogue.js. The checkout API
// imports that same catalogue for server-authoritative validation.
// It exists only so that a redesigned quote UI can compute exactly what the
// legacy QuoteCalculator computes, without duplicating the arithmetic in each
// component. eotPricing.test.ts pins the results against the documented
// examples so a future refactor cannot silently move a price.
//
// Access charges (parking / Congestion Charge) are NOT part of this engine at
// all. They are asked once, later, on the booking page, which is authoritative:
// BookingPage adds them on top of the handed-off `selection.price` and the
// server independently recomputes them from `quoteConfig.parkingAvailable` /
// `.congestionZone` (api/servicePrices.js accessSurcharge). Asking here too
// would duplicate the question and risk a quote/booking mismatch, so the quote
// states that they are confirmed at booking instead of pricing them.

import {
  EOT_BASE_PRICES_P,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_EXTRA_AREAS_P,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_CARPET_BUNDLE_P,
  EOT_SCOPE_CREDITS_P,
  ADDON_PRICES_P,
  CARPET_ITEM_PRICES_P,
  DEPOSIT_P,
  eotScopeCreditPence,
} from '../data/pricing';

export type EotPropertyType = 'flat' | 'house';
export type EotSizeKey = 'studio' | 'bed1' | 'bed2' | 'bed3' | 'bed4' | 'bed5';

/** 5+ bedrooms never receives a fixed online price. */
export const EOT_TAILORED_SIZE: EotSizeKey = 'bed5';

export const EOT_SIZES: { key: EotSizeKey; label: string; short: string }[] = [
  { key: 'studio', label: 'Studio',       short: 'Studio' },
  { key: 'bed1',   label: '1 bedroom',    short: '1 bed' },
  { key: 'bed2',   label: '2 bedrooms',   short: '2 bed' },
  { key: 'bed3',   label: '3 bedrooms',   short: '3 bed' },
  { key: 'bed4',   label: '4 bedrooms',   short: '4 bed' },
  { key: 'bed5',   label: '5+ bedrooms',  short: '5+ bed' },
];

/** Optional paid extras. Prices mirror the legacy calculator's addOnDefs. */
export const EOT_EXTRAS = [
  { key: 'extra_wc',            label: 'Additional WC',              hint: 'Half bathroom / cloakroom', pence: EOT_EXTRA_WC_P },
  { key: 'reception',           label: 'Additional reception room',  hint: 'Beyond the first living room', pence: EOT_EXTRA_AREAS_P.reception },
  { key: 'conservatory',        label: 'Conservatory',               hint: '', pence: EOT_EXTRA_AREAS_P.conservatory },
  { key: 'balcony',             label: 'Balcony / small patio',      hint: 'From', pence: EOT_EXTRA_AREAS_P.balcony },
  { key: 'utility',             label: 'Utility room',               hint: '', pence: EOT_EXTRA_AREAS_P.utility },
  { key: 'ext_windows',         label: 'Exterior windows',           hint: 'Ground floor / accessible', pence: ADDON_PRICES_P.ext_windows },
  { key: 'wall_marks',          label: 'Wall marks & scuffs',        hint: '', pence: ADDON_PRICES_P.wall_marks },
  { key: 'rubbish',             label: 'Rubbish removal',            hint: '', pence: ADDON_PRICES_P.rubbish },
  { key: 'key_collect',         label: 'Key collection / return',    hint: '', pence: ADDON_PRICES_P.key_collect },
] as const;

/** Carpet & upholstery steam-cleaning upgrades priced for an EOT visit. */
export const EOT_CARPET_UPGRADES = [
  { key: 'eot_living_carpet',   label: 'Living / dining room carpet', pence: EOT_CARPET_ADDON_PRICES_P.living_room },
  { key: 'eot_sofa_2',          label: '2-seater sofa',               pence: CARPET_ITEM_PRICES_P.sofa_2 },
  { key: 'eot_sofa_3',          label: '3-seater sofa',               pence: CARPET_ITEM_PRICES_P.sofa_3 },
  { key: 'eot_sofa_corner',     label: 'Corner / L-shaped sofa',      pence: CARPET_ITEM_PRICES_P.sofa_corner },
  { key: 'eot_mattress_single', label: 'Single mattress',             pence: CARPET_ITEM_PRICES_P.mattress_single },
  { key: 'eot_mattress_double', label: 'Double / king mattress',      pence: CARPET_ITEM_PRICES_P.mattress_double },
] as const;

export const EOT_SCOPE_OPTIONS = [
  { key: 'oven',             label: 'Oven is already inspection-ready',              pence: EOT_SCOPE_CREDITS_P.oven },
  { key: 'fridge_freezer',   label: 'Fridge/freezer is empty and inspection-ready',  pence: EOT_SCOPE_CREDITS_P.fridge_freezer },
  { key: 'cupboards',        label: 'Empty cupboards are already inspection-ready',  pence: EOT_SCOPE_CREDITS_P.cupboards },
  { key: 'internal_windows', label: 'Internal windows are already cleaned',          pence: EOT_SCOPE_CREDITS_P.internal_windows },
] as const;

export type ExtraKey = (typeof EOT_EXTRAS)[number]['key'];
export type CarpetUpgradeKey = (typeof EOT_CARPET_UPGRADES)[number]['key'];
export type ScopeKey = (typeof EOT_SCOPE_OPTIONS)[number]['key'];

export interface EotQuoteConfig {
  propertyType: EotPropertyType;
  size: EotSizeKey;
  /** Total full bathrooms, minimum 1. The first is included in the base price. */
  bathrooms: number;
  /** Counts keyed by extra / carpet-upgrade key. Absent = 0. */
  counts: Record<string, number>;
  /** Whole-home carpet bundle for this property size. */
  carpetWholeHome: boolean;
  scopeExclusions: string[];
}

export interface EotLine {
  key: string;
  label: string;
  qty: number;
  /** Signed pence. Negative for scope credits. */
  pence: number;
}

export interface EotQuoteResult {
  /** 5+ bedrooms — no fixed online price is ever produced. */
  isTailored: boolean;
  basePence: number;
  houseAdjustmentPence: number;
  extraBathroomPence: number;
  extrasPence: number;
  scopeCreditPence: number;
  /** Price handed to booking. EXCLUDES access charges, matching BookingPage. */
  totalPence: number;
  /** What the total would be with no scope credit applied. */
  standardPence: number;
  depositPence: number;
  balancePence: number;
  baseLine: EotLine;
  adjustmentLines: EotLine[];
  optionalLines: EotLine[];
  creditLines: EotLine[];
}

const priceOf = (key: string): number => {
  const extra = EOT_EXTRAS.find((e) => e.key === key);
  if (extra) return extra.pence;
  const upgrade = EOT_CARPET_UPGRADES.find((u) => u.key === key);
  if (upgrade) return upgrade.pence;
  return 0;
};

const labelOf = (key: string): string => {
  const extra = EOT_EXTRAS.find((e) => e.key === key);
  if (extra) return extra.label;
  const upgrade = EOT_CARPET_UPGRADES.find((u) => u.key === key);
  if (upgrade) return upgrade.label;
  return key;
};

export function computeEotQuote(config: EotQuoteConfig): EotQuoteResult {
  const {
    propertyType, size, bathrooms, counts, carpetWholeHome, scopeExclusions,
  } = config;

  // 5+ bedrooms: never produce a fixed total.
  if (size === EOT_TAILORED_SIZE) {
    return {
      isTailored: true,
      basePence: 0, houseAdjustmentPence: 0, extraBathroomPence: 0,
      extrasPence: 0, scopeCreditPence: 0, totalPence: 0, standardPence: 0,
      depositPence: DEPOSIT_P, balancePence: 0,
      baseLine: { key: 'base', label: '5+ bedroom tailored quote', qty: 1, pence: 0 },
      adjustmentLines: [], optionalLines: [], creditLines: [],
    };
  }

  const basePence = EOT_BASE_PRICES_P[size];
  const houseAdjustmentPence = propertyType === 'house' ? EOT_HOUSE_ADJUSTMENT_P : 0;
  const extraBathroomPence = Math.max(0, bathrooms - 1) * EOT_EXTRA_BATH_P;

  const adjustmentLines: EotLine[] = [];
  if (houseAdjustmentPence > 0) {
    adjustmentLines.push({ key: 'house', label: 'House / maisonette adjustment', qty: 1, pence: houseAdjustmentPence });
  }
  if (extraBathroomPence > 0) {
    adjustmentLines.push({
      key: 'extra_bath',
      label: 'Additional full bathroom',
      qty: bathrooms - 1,
      pence: extraBathroomPence,
    });
  }

  const optionalLines: EotLine[] = [];
  if (carpetWholeHome) {
    optionalLines.push({
      key: 'carpet_bundle',
      label: 'Carpets — whole home',
      qty: 1,
      pence: EOT_CARPET_BUNDLE_P[size] ?? 0,
    });
  }
  for (const [key, qty] of Object.entries(counts)) {
    if (!qty || qty <= 0) continue;
    const unit = priceOf(key);
    if (unit === 0) continue;
    optionalLines.push({ key, label: labelOf(key), qty, pence: unit * qty });
  }
  const extrasPence = optionalLines.reduce((sum, l) => sum + l.pence, 0);

  // Scope credit is capped against the BASE price only — never the total.
  const scopeCreditPence = eotScopeCreditPence(basePence, scopeExclusions);
  const creditLines: EotLine[] = scopeExclusions
    .filter((k) => EOT_SCOPE_CREDITS_P[k] !== undefined)
    .map((k) => ({
      key: k,
      label: EOT_SCOPE_OPTIONS.find((o) => o.key === k)?.label ?? k,
      qty: 1,
      pence: -(EOT_SCOPE_CREDITS_P[k] ?? 0),
    }));

  const standardPence = basePence + houseAdjustmentPence + extraBathroomPence + extrasPence;
  const totalPence = standardPence - scopeCreditPence;

  return {
    isTailored: false,
    basePence, houseAdjustmentPence, extraBathroomPence, extrasPence,
    scopeCreditPence, totalPence, standardPence,
    depositPence: DEPOSIT_P,
    balancePence: totalPence - DEPOSIT_P,
    baseLine: {
      key: 'base',
      label: `${EOT_SIZES.find((s) => s.key === size)?.label ?? size} ${propertyType === 'house' ? 'house' : 'flat'} — complete package`,
      qty: 1,
      pence: basePence,
    },
    adjustmentLines, optionalLines, creditLines,
  };
}

export const poundsFromPence = (pence: number): number => Math.round(pence / 100);
export const displayPence = (pence: number): string => `£${poundsFromPence(pence)}`;
