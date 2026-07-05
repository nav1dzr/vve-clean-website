// Backend pricing engine — authoritative source for price validation.
// Must stay in sync with QuoteCalculator.tsx when prices change.

const BASE_PRICES = {
  end_of_tenancy:    { studio: 159, bed1: 199, bed2: 249, bed3: 329, bed4: 419 },
  move_in:           { studio: 139, bed1: 169, bed2: 219, bed3: 269, bed4: 329 },
  after_builders:    { studio: 199, bed1: 239, bed2: 299, bed3: 369, bed4: 449 },
  carpet_upholstery: { studio:  90, bed1: 150, bed2: 210, bed3: 270, bed4: 330 },
};

const BATH_SURCHARGE = {
  end_of_tenancy: 20, move_in: 18, after_builders: 25, carpet_upholstery: 0,
};

const CARPET_BUNDLE_PRICE = { studio: 50, bed1: 50, bed2: 75, bed3: 100, bed4: 125 };
const STAIR_PRICES        = [0, 45, 80, 115];
const WINDOW_PRICES       = { small: 35, medium: 45, large: 55 };
const GUTTER_PRICES       = { terraced: 75, semi_detached: 110, detached: 160 };
const HOURLY_RATE         = 22.5;
const MIN_OFFICE_HOURS    = 4;
const MIN_CHARGE          = 90;

const ADDON_PRICES = {
  oven:         35,
  fridge:       20,
  ext_windows:  35,
  wall_marks:   25,
  key_collect:  10,
  rubbish:      40,
  sofa:         40,
  mattress:     25,
};

/**
 * Recompute the total price from a quoteConfig object sent by the frontend.
 * Returns null if config is missing or unrecognised (caller should fall through).
 */
export function computePrice(quoteConfig) {
  if (!quoteConfig || !quoteConfig.service) return null;

  const {
    service, deepService, deepSize, deepBaths,
    addOnCounts, windowSize, gutterType, officeHours,
  } = quoteConfig;

  if (service === 'deep') {
    const bp = BASE_PRICES[deepService];
    if (!bp) return null;
    const base = bp[deepSize];
    if (!base) return null;

    const isCarpet  = deepService === 'carpet_upholstery';
    const bathExtra = isCarpet ? 0 : (((deepBaths || 1) - 1) * (BATH_SURCHARGE[deepService] || 0));

    let addons = 0;
    if (addOnCounts && typeof addOnCounts === 'object') {
      for (const [key, count] of Object.entries(addOnCounts)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        if (key === 'staircase') {
          addons += STAIR_PRICES[Math.min(n, 3)];
        } else if (key === 'carpet_bundle') {
          addons += (CARPET_BUNDLE_PRICE[deepSize] ?? 0) * n;
        } else if (key === 'oven' && deepService === 'end_of_tenancy') {
          // FREE for end of tenancy — no charge
        } else {
          addons += (ADDON_PRICES[key] ?? 0) * n;
        }
      }
    }

    return base + bathExtra + addons;
  }

  if (service === 'window') {
    return Math.max(WINDOW_PRICES[windowSize] ?? 35, MIN_CHARGE);
  }

  if (service === 'gutter') {
    return Math.max(GUTTER_PRICES[gutterType] ?? 75, MIN_CHARGE);
  }

  if (service === 'office') {
    const h = Math.max(Number(officeHours) || MIN_OFFICE_HOURS, MIN_OFFICE_HOURS);
    return Math.max(h * HOURLY_RATE, MIN_CHARGE);
  }

  return null;
}
