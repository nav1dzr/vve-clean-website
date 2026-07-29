// Backend pricing engine — authoritative source for price validation.
// Must stay in sync with src/data/pricing.ts when prices change.

const BASE_PRICES = {
  end_of_tenancy:    { studio: 229, bed1: 299, bed2: 369, bed3: 449, bed4: 549 },
  move_in:           { studio: 179, bed1: 219, bed2: 269, bed3: 329, bed4: 429 },
  after_builders:    { studio: 279, bed1: 329, bed2: 399, bed3: 499, bed4: 625 },
  carpet_upholstery: { studio:  90, bed1: 150, bed2: 210, bed3: 270, bed4: 330 },
};

const BATH_SURCHARGE = {
  end_of_tenancy: 50, move_in: 40, after_builders: 0, carpet_upholstery: 0,
};

// EOT carpet bundle add-on (reduced rates for add-on to EOT clean)
const CARPET_BUNDLE_PRICE = { studio: 60, bed1: 60, bed2: 100, bed3: 150, bed4: 195 };
const STAIR_PRICES        = [0, 45, 80, 115];
const WINDOW_PRICES       = { small: 35, medium: 45, large: 55 };
const GUTTER_PRICES       = { terraced: 75, semi_detached: 110, detached: 160 };
const HOURLY_RATE         = 27.5;
const MIN_OFFICE_HOURS    = 2;
const MIN_OFFICE_CHARGE   = 55;
const MIN_CHARGE          = 90;

const ADDON_PRICES = {
  oven: 35, fridge: 20, ext_windows: 35, wall_marks: 25, key_collect: 10, rubbish: 40,
  sofa: 40, mattress: 25,
  extra_wc: 25, reception: 35, conservatory: 40, balcony: 25, utility: 25,
  eot_living_carpet: 55,
  eot_sofa_2: 75, eot_sofa_3: 95, eot_sofa_corner: 130,
  eot_mattress_single: 45, eot_mattress_double: 65,
};

const EOT_SCOPE_CREDITS = {
  oven: 15, fridge_freezer: 10, cupboards: 10, internal_windows: 10,
};

// Transparent house/maisonette adjustment (mirrors EOT_HOUSE_ADJUSTMENT_P).
const EOT_HOUSE_ADJUSTMENT = 35;

// Access charges — required booking questions, apply regardless of service
// (mirrors PARKING_ESTIMATE_P / CONGESTION_CHARGE_P). Parking is an estimated
// allowance reconciled to actual cost; the Congestion Charge is a pass-through,
// never a cleaning-service fee.
const PARKING_ESTIMATE  = 15;
const CONGESTION_CHARGE = 18;

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
  const percentageCap = Math.floor(base * 0.1);
  return Math.min(requested, 30, percentageCap);
}

// ── Carpet itemised engine (mirrors carpetPricing.ts) ────────────────────────
const CARPET_MIN_BOOKING = 85;

const CARPET_BUNDLE_DISCOUNT_TIERS = [
  { min: 600, pct: 10  },
  { min: 400, pct: 7.5 },
  { min: 250, pct: 5   },
];

const CARPET_ITEM_PRICES = {
  bedroom: 50, living_room: 70, large_lounge: 90, hallway: 25, landing: 15,
  rug: 40, armchair: 50, sofa_2: 75, sofa_3: 95, sofa_corner: 130,
  mattress_single: 45, mattress_double: 65,
};

function stairsLinePrice(n) {
  if (n <= 0) return 0;
  return 55 + (n - 1) * 40;
}

function computeCarpetItemisedPrice(carpetCounts, carpetCondition) {
  if (carpetCondition === 'delicate') return null; // photo quote — no fixed price

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

  // Apply same-visit bundle discount (mirrors src/data/carpetPricing.ts)
  const tier = CARPET_BUNDLE_DISCOUNT_TIERS.find((t) => subtotal >= t.min);
  if (tier) {
    subtotal -= Math.round(subtotal * tier.pct / 100);
  }

  return Math.max(subtotal, CARPET_MIN_BOOKING);
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Recompute the total price from a quoteConfig object sent by the frontend.
 * Returns null if config is missing or unrecognised (caller should fall through).
 */
export function computePrice(quoteConfig) {
  if (!quoteConfig || !quoteConfig.service) return null;

  const result = computeBasePrice(quoteConfig);

  // Access charges (parking / Congestion Charge) apply on top of any fixed
  // price, regardless of service — never on a null (manual/photo-quote) result.
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
    // ── Carpet itemised flow (quote-v2) ─────────────────────────────────────
    if (deepService === 'carpet_upholstery' && carpetCounts) {
      return computeCarpetItemisedPrice(carpetCounts, carpetCondition || 'normal');
    }

    // ── Other deep services (EOT, move-in, after-builders) ──────────────────
    // 5+ bedroom EOT properties have no fixed price by design (tailored quote
    // required) — bp[deepSize] is undefined for 'bed5' and this correctly
    // falls through to null, never inventing a fixed total.
    const bp = BASE_PRICES[deepService];
    if (!bp) return null;
    const base = bp[deepSize];
    if (!base) return null;

    const isCarpet  = deepService === 'carpet_upholstery';
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
    return Math.max(WINDOW_PRICES[windowSize] ?? 35, MIN_CHARGE);
  }

  if (service === 'gutter') {
    return Math.max(GUTTER_PRICES[gutterType] ?? 75, MIN_CHARGE);
  }

  if (service === 'office') {
    const h = Math.max(Number(officeHours) || MIN_OFFICE_HOURS, MIN_OFFICE_HOURS);
    return Math.max(h * HOURLY_RATE, MIN_OFFICE_CHARGE);
  }

  return null;
}
