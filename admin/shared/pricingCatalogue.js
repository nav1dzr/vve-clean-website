// VVE Clean canonical pricing catalogue.
//
// This is the ONE file to edit when an approved price changes. It deliberately
// lives inside the admin project root so both Vercel projects can import it:
//
//   public website  -> src/data/pricing.ts (typed re-export + helpers)
//   checkout API    -> api/servicePrices.js (server-authoritative validation)
//   CRM catalogue   -> admin/api/_lib/catalogueSeed.js (opt-in seed values)
//
// Every monetary value is integer pence. Do not put display strings, pounds or
// calculation logic here; consumers derive those from these immutable values.

const freezeRecord = (record) => Object.freeze(record);

export const CARPET_MIN_BOOKING_P = 8500;

export const CARPET_ITEM_PRICES_P = freezeRecord({
  bedroom: 5000,
  living_room: 7000,
  large_lounge: 9000,
  hallway: 2500,
  landing: 1500,
  rug: 4000,
  armchair: 5000,
  sofa_2: 7500,
  sofa_3: 9500,
  sofa_corner: 13000,
  mattress_single: 4500,
  mattress_double: 6500,
});

export const STAIRS_FIRST_P = 5500;
export const STAIRS_EXTRA_P = 4000;

export const CARPET_BUNDLE_TIERS = Object.freeze([
  Object.freeze({ minP: 60000, pct: 10, display: '10%' }),
  Object.freeze({ minP: 40000, pct: 7.5, display: '7.5%' }),
  Object.freeze({ minP: 25000, pct: 5, display: '5%' }),
]);

export const EOT_BASE_PRICES_P = freezeRecord({
  studio: 22900,
  bed1: 29900,
  bed2: 36900,
  bed3: 44900,
  bed4: 54900,
});

export const EOT_TAILORED_QUOTE_SIZE = 'bed5';
export const EOT_HOUSE_ADJUSTMENT_P = 3500;
export const EOT_EXTRA_BATH_P = 5000;
export const EOT_EXTRA_WC_P = 2500;

export const EOT_EXTRA_AREAS_P = freezeRecord({
  reception: 3500,
  conservatory: 4000,
  balcony: 2500,
  utility: 2500,
});

export const EOT_SCOPE_CREDITS_P = freezeRecord({
  oven: 1500,
  fridge_freezer: 1000,
  cupboards: 1000,
  internal_windows: 1000,
});

export const EOT_SCOPE_CREDIT_MAX_P = 3000;
export const EOT_SCOPE_CREDIT_MAX_PERCENT = 10;

export const EOT_CARPET_ADDON_PRICES_P = freezeRecord({
  bedroom: 4000,
  living_room: 5500,
  large_lounge: 7500,
  hallway: 2000,
  landing: 1200,
  stairs_first: 4500,
  stairs_extra: 3500,
});

export const MOVEIN_BASE_PRICES_P = freezeRecord({
  studio: 17900,
  bed1: 21900,
  bed2: 26900,
  bed3: 32900,
  bed4: 42900,
});

export const MOVEIN_EXTRA_BATH_P = 4000;

export const AFTER_BUILDERS_FROM_PRICES_P = freezeRecord({
  small: 24900,
  studio: 27900,
  bed1: 32900,
  bed2: 39900,
  bed3: 49900,
  bed4: 62500,
});

export const AFTER_BUILDERS_START_FROM_P = AFTER_BUILDERS_FROM_PRICES_P.small;

export const COMMERCIAL_REGULAR_HOURLY_P = 2750;
export const COMMERCIAL_REGULAR_MIN_HOURS = 2;
export const COMMERCIAL_REGULAR_MIN_CHARGE_P = 5500;
export const COMMERCIAL_ONCEOFF_HOURLY_P = 3500;
export const COMMERCIAL_ONCEOFF_MIN_HOURS = 6;
export const COMMERCIAL_ONCEOFF_MIN_CHARGE_P = 21000;
export const COMMERCIAL_SHOP_CAFE_FROM_P = 6500;
export const COMMERCIAL_COMMUNAL_FROM_P = 7500;
export const COMMERCIAL_CARPET_PER_SQM_P = 450;
export const COMMERCIAL_CARPET_MIN_P = 12000;
export const COMMERCIAL_EOL_FROM_P = 29900;
export const COMMERCIAL_AFTER_BUILDERS_FROM_P = 34900;

export const ADDON_PRICES_P = freezeRecord({
  oven: 3500,
  fridge: 2000,
  ext_windows: 3500,
  wall_marks: 2500,
  key_collect: 1000,
  rubbish: 4000,
});

export const EOT_CARPET_BUNDLE_P = freezeRecord({
  studio: 6000,
  bed1: 6000,
  bed2: 10000,
  bed3: 15000,
  bed4: 19500,
});

export const DEPOSIT_P = 3000;
export const PARKING_ESTIMATE_P = 1500;
export const CONGESTION_CHARGE_P = 1800;

// Legacy calculator values still accepted by server validation. They remain
// explicit until the legacy request shapes are retired; centralising them here
// prevents a hidden fourth price source in api/servicePrices.js.
export const LEGACY_CARPET_BASE_PRICES_P = freezeRecord({
  studio: 9000,
  bed1: 15000,
  bed2: 21000,
  bed3: 27000,
  bed4: 33000,
});

export const LEGACY_DEEP_ADDON_PRICES_P = freezeRecord({
  sofa: 4000,
  mattress: 2500,
});

export const WINDOW_PRICES_P = freezeRecord({
  small: 3500,
  medium: 4500,
  large: 5500,
});

export const GUTTER_PRICES_P = freezeRecord({
  terraced: 7500,
  semi_detached: 11000,
  detached: 16000,
});

export const GENERAL_MIN_BOOKING_P = 9000;

