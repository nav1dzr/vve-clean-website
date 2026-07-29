// ─── VVE Clean Canonical Pricing ─────────────────────────────────────────────
//
// Single source of truth for all customer-facing prices on the public website.
// All amounts are in integer pence to avoid floating-point error.
//
// UPDATING PRICES
// 1. Change the value here.
// 2. Run: npm run typecheck && npx vitest run src/data/pricing.test.ts
// 3. Update api/servicePrices.js to match (backend validator — must stay in sync).
// 4. Update admin/api/_lib/catalogueSeed.js catalogue prices to match.
// 5. Run the full suite: npx vitest run && npm run build
// 6. Commit with message: "pricing: <what changed>"
//
// See PRICING_SYSTEM.md for the full policy, discount rules and manual steps.

// ─── Carpet & upholstery ─────────────────────────────────────────────────────

export const CARPET_MIN_BOOKING_P = 8500; // £85.00

export const CARPET_ITEM_PRICES_P: Record<string, number> = {
  bedroom:         5000,  // £50
  living_room:     7000,  // £70
  large_lounge:    9000,  // £90
  hallway:         2500,  // £25
  landing:         1500,  // £15
  // stairs: non-linear — see stairsLinePricePence()
  rug:             4000,  // £40  — large/wool: photo quote
  armchair:        5000,  // £50
  sofa_2:          7500,  // £75
  sofa_3:          9500,  // £95
  sofa_corner:    13000,  // £130 — from price; large/modular may need review
  mattress_single: 4500,  // £45
  mattress_double: 6500,  // £65
};

// Stairs are non-linear: £55 first flight, £40 each additional.
export const STAIRS_FIRST_P  = 5500;  // £55
export const STAIRS_EXTRA_P  = 4000;  // £40

export function stairsLinePricePence(flights: number): number {
  if (flights <= 0) return 0;
  return STAIRS_FIRST_P + (flights - 1) * STAIRS_EXTRA_P;
}

// ─── Carpet bundle discount tiers ────────────────────────────────────────────
//
// Applied to the eligible carpet/upholstery subtotal only.
// Does NOT apply to: EOT, move-in, after-builders, commercial, EOT carpet
// add-ons, parking/congestion/access charges, or manually agreed supplements.
// Same-day and next-day bookings remain fully eligible.

export interface BundleTier {
  minP:    number;  // minimum eligible subtotal in pence to qualify
  pct:     number;  // discount percentage (may be fractional, e.g. 7.5)
  display: string;  // human-readable label
}

// Ordered highest-first so the first match is the best eligible tier.
export const CARPET_BUNDLE_TIERS: BundleTier[] = [
  { minP: 60000, pct: 10,  display: '10%'  },  // £600+ → 10%
  { minP: 40000, pct: 7.5, display: '7.5%' },  // £400–£599 → 7.5%
  { minP: 25000, pct: 5,   display: '5%'   },  // £250–£399 → 5%
];

// ─── End of tenancy ──────────────────────────────────────────────────────────
//
// Prices assume the property is vacant, in normal condition, with reasonable
// access. Heavy soiling, mould, biohazard, pet accidents or extreme conditions
// require a photo/video review and customer approval before work starts.
// Complete package: oven/hob/extractor, emptied fridge/defrosted freezer,
// accessible appliance compartments, cupboards, internal windows, descaling,
// standard rooms and floors, products and equipment included as standard.
// 48-hour re-clean guarantee included.

export const EOT_BASE_PRICES_P: Record<string, number> = {
  studio: 22900,  // £229
  bed1:   29900,  // £299
  bed2:   36900,  // £369 (1 bathroom)
  bed3:   44900,  // £449 (1 bathroom)
  bed4:   54900,  // £549 (1 bathroom)
};

// Per additional bathroom beyond the first (integer pence).
export const EOT_EXTRA_BATH_P = 5000;  // £50
// Per additional WC (half-bathroom) beyond the first.
export const EOT_EXTRA_WC_P   = 2500;  // £25

// Additional areas (charged on top of the base EOT price):
export const EOT_EXTRA_AREAS_P: Record<string, number> = {
  reception:   3500,  // £35 — additional reception room
  conservatory:4000,  // £40
  balcony:     2500,  // £25 from
  utility:     2500,  // £25
};

// Optional scope reductions for customers who have already completed a
// verifiable inspection item. Core cleaning cannot be removed. Selecting any
// reduction changes the product to a Custom EOT clean and removes that item
// from the 48-hour re-clean guarantee.
export const EOT_SCOPE_CREDITS_P: Record<string, number> = {
  oven:             1500,  // −£15
  fridge_freezer:   1000,  // −£10
  cupboards:        1000,  // −£10
  internal_windows: 1000,  // −£10
};

export const EOT_SCOPE_CREDIT_MAX_P = 3000; // never reduce by more than £30
export const EOT_SCOPE_CREDIT_MAX_PERCENT = 10;

export function eotScopeCreditPence(basePricePence: number, excludedItems: string[] = []): number {
  const uniqueItems = [...new Set(excludedItems)];
  const requested = uniqueItems.reduce(
    (sum, key) => sum + (EOT_SCOPE_CREDITS_P[key] ?? 0),
    0,
  );
  // Whole-pound cap keeps the displayed total simple and never exceeds 10%.
  const percentageCap = Math.floor(
    (basePricePence * EOT_SCOPE_CREDIT_MAX_PERCENT) / 100 / 100,
  ) * 100;
  return Math.min(requested, EOT_SCOPE_CREDIT_MAX_P, percentageCap);
}

// EOT carpet add-on prices (reduced because travel/setup already covered).
// These do NOT receive an automatic carpet bundle discount.
export const EOT_CARPET_ADDON_PRICES_P: Record<string, number> = {
  bedroom:     4000,  // £40
  living_room: 5500,  // £55
  large_lounge:7500,  // £75
  hallway:     2000,  // £20
  landing:     1200,  // £12
  stairs_first:4500,  // £45 first flight
  stairs_extra:3500,  // £35 each additional flight
};

// ─── Move-in deep clean ──────────────────────────────────────────────────────
//
// Prices assume the property is vacant and in normal condition.
// Occupied or heavily furnished properties require manual confirmation
// (may cost approx 15% more, but never added automatically).

export const MOVEIN_BASE_PRICES_P: Record<string, number> = {
  studio: 17900,  // £179
  bed1:   21900,  // £219
  bed2:   26900,  // £269 (1 bathroom)
  bed3:   32900,  // £329 (1 bathroom)
  bed4:   42900,  // £429 (1 bathroom)
};

export const MOVEIN_EXTRA_BATH_P = 4000;  // £40 per extra bathroom

// ─── After-builders ──────────────────────────────────────────────────────────
//
// Always "from" / estimated prices. Final price confirmed by photo before work.
// Heavy paint/plaster/adhesive/cement, rubble, waste or specialist equipment
// may add approx 25%–50% — never automatically; always agreed with customer.

export const AFTER_BUILDERS_FROM_PRICES_P: Record<string, number> = {
  small:  24900,  // £249 — small renovation or one main area
  studio: 27900,  // £279
  bed1:   32900,  // £329
  bed2:   39900,  // £399
  bed3:   49900,  // £499
  bed4:   62500,  // £625
  // 5+ bedrooms or large/commercial construction: manual site survey quote
};

// Lowest displayed starting price (used for "from £X" wording).
export const AFTER_BUILDERS_START_FROM_P = 24900;  // £249

// ─── Commercial pricing ──────────────────────────────────────────────────────

// Regular contract cleaning
export const COMMERCIAL_REGULAR_HOURLY_P   = 2750;  // £27.50 per cleaner-hour
export const COMMERCIAL_REGULAR_MIN_HOURS  = 2;     // minimum hours per visit
export const COMMERCIAL_REGULAR_MIN_CHARGE_P = 5500; // £55

// One-off commercial deep clean
export const COMMERCIAL_ONCEOFF_HOURLY_P   = 3500;  // £35 per cleaner-hour
export const COMMERCIAL_ONCEOFF_MIN_HOURS  = 6;     // minimum hours
export const COMMERCIAL_ONCEOFF_MIN_CHARGE_P = 21000; // £210

// Other commercial services
export const COMMERCIAL_SHOP_CAFE_FROM_P      = 6500;  // £65 per visit
export const COMMERCIAL_COMMUNAL_FROM_P       = 7500;  // £75 per visit
export const COMMERCIAL_CARPET_PER_SQM_P      = 450;   // £4.50 per sqm
export const COMMERCIAL_CARPET_MIN_P          = 12000; // £120 minimum
export const COMMERCIAL_EOL_FROM_P            = 29900; // £299 end-of-lease
export const COMMERCIAL_AFTER_BUILDERS_FROM_P = 34900; // £349 after-builders

// ─── Optional add-on extras ───────────────────────────────────────────────────

export const ADDON_PRICES_P: Record<string, number> = {
  oven:        3500,  // £35 (FREE when booked with EOT)
  fridge:      2000,  // £20
  ext_windows: 3500,  // £35
  wall_marks:  2500,  // £25
  key_collect: 1000,  // £10
  rubbish:     4000,  // £40 (small load)
};

// Carpet bundle add-on to EOT/move-in (whole-home, at EOT reduced rates).
// Approximate based on typical room counts; exact itemised pricing on /pricing.
export const EOT_CARPET_BUNDLE_P: Record<string, number> = {
  studio: 6000,  // £60 — hallway + bedroom
  bed1:   6000,  // £60 — hallway + bedroom
  bed2:  10000,  // £100 — hallway + 2 bedrooms
  bed3:  15000,  // £150 — hallway + landing + 3 bedrooms
  bed4:  19500,  // £195 — hallway + landing + 4 bedrooms
};

// ─── Booking constants ────────────────────────────────────────────────────────

export const DEPOSIT_P = 3000;  // £30 — deducted from final balance

// ─── Same-day / next-day policy (no surcharge) ───────────────────────────────
//
// Same-day and next-day appointments use the exact same prices and discounts
// as any other booking. No automatic surcharge, priority fee or discount
// removal applies. Availability is subject to operational capacity only.
// Contact us to check availability.
//
// Only genuinely exceptional out-of-hours or specially arranged emergency work
// may receive a manually agreed additional charge — never calculated automatically.

export const SAME_DAY_POLICY_SHORT =
  'Same-day and next-day appointments may be available at the normal price. Contact us to check availability.';

// ─── Helper: pounds display ───────────────────────────────────────────────────

export function penceToDisplay(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}
