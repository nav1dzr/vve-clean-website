// Backend pricing engine — authoritative checkout validation.
// Every monetary value is derived from the same canonical pence catalogue used
// by the public website and CRM. Calculation behaviour remains server-owned.
import {
  ADDON_PRICES_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  CARPET_BUNDLE_TIERS,
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_REGULAR_MIN_HOURS,
  CONGESTION_CHARGE_P,
  EOT_BASE_PRICES_P,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_CARPET_BUNDLE_P,
  EOT_EXTRA_AREAS_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_SCOPE_CREDITS_P,
  EOT_SCOPE_CREDIT_MAX_P,
  EOT_SCOPE_CREDIT_MAX_PERCENT,
  GENERAL_MIN_BOOKING_P,
  GUTTER_PRICES_P,
  LEGACY_CARPET_BASE_PRICES_P,
  LEGACY_DEEP_ADDON_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  PARKING_ESTIMATE_P,
  STAIRS_EXTRA_P,
  STAIRS_FIRST_P,
  WINDOW_PRICES_P,
} from '../admin/shared/pricingCatalogue.js';

const pounds = (pence) => pence / 100;
const poundsRecord = (record) => Object.fromEntries(
  Object.entries(record).map(([key, pence]) => [key, pounds(pence)]),
);
const fixedDeepSizes = (record) => Object.fromEntries(
  ['studio', 'bed1', 'bed2', 'bed3', 'bed4'].map((key) => [key, pounds(record[key])]),
);

const BASE_PRICES = {
  end_of_tenancy: fixedDeepSizes(EOT_BASE_PRICES_P),
  move_in: fixedDeepSizes(MOVEIN_BASE_PRICES_P),
  after_builders: fixedDeepSizes(AFTER_BUILDERS_FROM_PRICES_P),
  carpet_upholstery: fixedDeepSizes(LEGACY_CARPET_BASE_PRICES_P),
};

const BATH_SURCHARGE = {
  end_of_tenancy: pounds(EOT_EXTRA_BATH_P),
  move_in: pounds(MOVEIN_EXTRA_BATH_P),
  after_builders: 0,
  carpet_upholstery: 0,
};

const CARPET_BUNDLE_PRICE = poundsRecord(EOT_CARPET_BUNDLE_P);
const STAIR_PRICES = [
  0,
  pounds(EOT_CARPET_ADDON_PRICES_P.stairs_first),
  pounds(EOT_CARPET_ADDON_PRICES_P.stairs_first + EOT_CARPET_ADDON_PRICES_P.stairs_extra),
  pounds(EOT_CARPET_ADDON_PRICES_P.stairs_first + (2 * EOT_CARPET_ADDON_PRICES_P.stairs_extra)),
];
const WINDOW_PRICES = poundsRecord(WINDOW_PRICES_P);
const GUTTER_PRICES = poundsRecord(GUTTER_PRICES_P);
const HOURLY_RATE = pounds(COMMERCIAL_REGULAR_HOURLY_P);
const MIN_OFFICE_HOURS = COMMERCIAL_REGULAR_MIN_HOURS;
const MIN_OFFICE_CHARGE = pounds(COMMERCIAL_REGULAR_MIN_CHARGE_P);
const MIN_CHARGE = pounds(GENERAL_MIN_BOOKING_P);

const ADDON_PRICES = {
  ...poundsRecord(ADDON_PRICES_P),
  ...poundsRecord(LEGACY_DEEP_ADDON_PRICES_P),
  extra_wc: pounds(EOT_EXTRA_WC_P),
  ...poundsRecord(EOT_EXTRA_AREAS_P),
  eot_living_carpet: pounds(EOT_CARPET_ADDON_PRICES_P.living_room),
  eot_sofa_2: pounds(CARPET_ITEM_PRICES_P.sofa_2),
  eot_sofa_3: pounds(CARPET_ITEM_PRICES_P.sofa_3),
  eot_sofa_corner: pounds(CARPET_ITEM_PRICES_P.sofa_corner),
  eot_mattress_single: pounds(CARPET_ITEM_PRICES_P.mattress_single),
  eot_mattress_double: pounds(CARPET_ITEM_PRICES_P.mattress_double),
};

const EOT_SCOPE_CREDITS = poundsRecord(EOT_SCOPE_CREDITS_P);
const EOT_HOUSE_ADJUSTMENT = pounds(EOT_HOUSE_ADJUSTMENT_P);
const PARKING_ESTIMATE = pounds(PARKING_ESTIMATE_P);
const CONGESTION_CHARGE = pounds(CONGESTION_CHARGE_P);

function accessSurcharge(quoteConfig) {
  let add = 0;
  if (quoteConfig.parkingAvailable === 'no' || quoteConfig.parkingAvailable === 'not_sure') {
    add += PARKING_ESTIMATE;
  }
  if (quoteConfig.congestionZone === 'yes' || quoteConfig.congestionZone === 'not_sure') {
    add += CONGESTION_CHARGE;
  }
  return add;
}

function eotScopeCredit(base, excludedItems) {
  const unique = [...new Set(Array.isArray(excludedItems) ? excludedItems : [])];
  const requested = unique.reduce((sum, key) => sum + (EOT_SCOPE_CREDITS[key] ?? 0), 0);
  const percentageCap = Math.floor(base * EOT_SCOPE_CREDIT_MAX_PERCENT / 100);
  return Math.min(requested, pounds(EOT_SCOPE_CREDIT_MAX_P), percentageCap);
}

// Carpet itemised engine. Its formula remains unchanged; only its values now
// come from the canonical catalogue.
const CARPET_MIN_BOOKING = pounds(CARPET_MIN_BOOKING_P);
const CARPET_BUNDLE_DISCOUNT_TIERS = CARPET_BUNDLE_TIERS.map((tier) => ({
  min: pounds(tier.minP),
  pct: tier.pct,
}));
const CARPET_ITEM_PRICES = poundsRecord(CARPET_ITEM_PRICES_P);

function stairsLinePrice(n) {
  if (n <= 0) return 0;
  return pounds(STAIRS_FIRST_P) + (n - 1) * pounds(STAIRS_EXTRA_P);
}

function computeCarpetItemisedPrice(carpetCounts, carpetCondition) {
  if (carpetCondition === 'delicate') return null;

  let subtotal = 0;
  for (const [key, qty] of Object.entries(carpetCounts || {})) {
    const n = Number(qty) || 0;
    if (n <= 0) continue;
    if (key === 'stairs') {
      subtotal += stairsLinePrice(n);
    } else {
      subtotal += (CARPET_ITEM_PRICES[key] ?? 0) * n;
    }
  }

  if (carpetCondition === 'heavy') subtotal = Math.round(subtotal * 1.2);
  if (subtotal <= 0) return null;

  const tier = CARPET_BUNDLE_DISCOUNT_TIERS.find((candidate) => subtotal >= candidate.min);
  if (tier) subtotal -= Math.round(subtotal * tier.pct / 100);

  return Math.max(subtotal, CARPET_MIN_BOOKING);
}

/**
 * Recompute the total price from a quoteConfig object sent by the frontend.
 * Returns null if config is missing or unrecognised.
 */
export function computePrice(quoteConfig) {
  if (!quoteConfig || !quoteConfig.service) return null;

  const result = computeBasePrice(quoteConfig);
  if (result === null) return null;
  return result + accessSurcharge(quoteConfig);
}

function computeBasePrice(quoteConfig) {
  const {
    service, deepService, deepSize, deepBaths, propertyType,
    addOnCounts, windowSize, gutterType, officeHours,
    carpetCounts, carpetCondition, eotScopeExclusions,
  } = quoteConfig;

  if (service === 'deep') {
    if (deepService === 'carpet_upholstery' && carpetCounts) {
      return computeCarpetItemisedPrice(carpetCounts, carpetCondition || 'normal');
    }

    // 5+ bedroom EOT stays a tailored quote: bed5 is absent from fixed sizes.
    const bp = BASE_PRICES[deepService];
    if (!bp) return null;
    const base = bp[deepSize];
    if (!base) return null;

    const isCarpet = deepService === 'carpet_upholstery';
    const bathExtra = isCarpet ? 0 : (((deepBaths || 1) - 1) * (BATH_SURCHARGE[deepService] || 0));
    const houseAdjustment = deepService === 'end_of_tenancy' && propertyType === 'house'
      ? EOT_HOUSE_ADJUSTMENT
      : 0;

    let addons = 0;
    if (addOnCounts && typeof addOnCounts === 'object') {
      for (const [key, count] of Object.entries(addOnCounts)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        if (key === 'staircase') {
          addons += STAIR_PRICES[Math.min(n, 3)];
        } else if (key === 'carpet_bundle') {
          addons += (CARPET_BUNDLE_PRICE[deepSize] ?? 0) * n;
        } else if ((key === 'oven' || key === 'fridge') && deepService === 'end_of_tenancy') {
          // Included in every complete end-of-tenancy package.
        } else {
          addons += (ADDON_PRICES[key] ?? 0) * n;
        }
      }
    }
    const scopeCredit = deepService === 'end_of_tenancy'
      ? eotScopeCredit(base, eotScopeExclusions)
      : 0;
    return base + houseAdjustment + bathExtra + addons - scopeCredit;
  }

  if (service === 'window') {
    return Math.max(WINDOW_PRICES[windowSize] ?? WINDOW_PRICES.small, MIN_CHARGE);
  }

  if (service === 'gutter') {
    return Math.max(GUTTER_PRICES[gutterType] ?? GUTTER_PRICES.terraced, MIN_CHARGE);
  }

  if (service === 'office') {
    const hours = Math.max(Number(officeHours) || MIN_OFFICE_HOURS, MIN_OFFICE_HOURS);
    return Math.max(hours * HOURLY_RATE, MIN_OFFICE_CHARGE);
  }

  return null;
}
