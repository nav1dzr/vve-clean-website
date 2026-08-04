// WARNING: AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
//
// This is a mechanically synced, verified-identical copy of
// shared/pricingCatalogue.js (the single canonical pricing source for the
// whole repository), produced by scripts/sync-admin-pricing.mjs.
//
// WHY A COPY, NOT AN IMPORT: admin/ is deployed as a separate Vercel project
// and cannot be guaranteed to have build-time access to files outside its
// own directory tree — see that script's header comment for the full
// explanation.
//
// To change a price: edit shared/pricingCatalogue.js at the repository
// root, NOT this file. Then run 'npm run sync-admin-pricing' from the
// repository root (this also runs automatically before 'npm run build' in
// both the root and admin/ projects). This file is committed to the repo so
// admin's isolated build always has it — a test
// (tests/api/pricingSource.test.js) fails loudly if it is ever out of date.
//
// ─────────────────────────────────────────────────────────────────────────

// ─── VVE Clean Canonical Pricing Catalogue ───────────────────────────────────
//
// THE single authoritative source for every customer-facing price, discount
// rule, package definition and pure calculation function used anywhere in
// this repository — the public website (src/), the payment-authority server
// endpoint (api/), and the admin CRM (admin/api/).
//
// Written as plain ES module JavaScript (not TypeScript) specifically so it
// can be imported, unmodified, by all three runtimes without a build step:
//   - Vite (frontend, via src/data/pricing.ts — a thin re-export shim)
//   - Vercel serverless functions (api/servicePrices.js — a thin re-export shim)
//   - Vercel serverless functions in the separate admin/ deployment, which
//     (because it may be deployed with its own Vercel "Root Directory" set
//     to admin/, unable to reach files outside that root at build time) uses
//     a MECHANICALLY SYNCED, verified-identical copy — see
//     admin/api/_lib/pricingCatalogue.generated.js and scripts/sync-admin-pricing.mjs.
//     Everywhere else, this file is imported directly — no copy, no drift possible.
//
// UPDATING PRICES
// 1. Change the value here — this is the ONLY place prices are edited.
// 2. Run: npm run typecheck && npm test (root) — sync + mirror tests fail
//    loudly if admin's generated copy is stale.
// 3. If admin/api/_lib/pricingCatalogue.generated.js is stale, run:
//    npm run sync-admin-pricing
// 4. Run the full suite in both root and admin/, then `npm run build` in both.
//
// See PRICING_SYSTEM.md for the full policy and discount rules.

// ─── Types (JSDoc only — erased at runtime, read by TypeScript consumers) ───

/** @typedef {'studio'|'bed1'|'bed2'|'bed3'|'bed4'} SizeKey */
/** @typedef {'fixed'|'from'|'quote_required'} PricingMode */

export const SIZE_KEYS = ['studio', 'bed1', 'bed2', 'bed3', 'bed4'];

/** @type {Record<string, string>} */
export const SIZE_LABELS = {
  studio: 'Studio',
  bed1:   '1 Bedroom',
  bed2:   '2 Bedrooms',
  bed3:   '3 Bedrooms',
  bed4:   '4 Bedrooms',
};

// ─── Carpet & upholstery ─────────────────────────────────────────────────────

export const CARPET_MIN_BOOKING_P = 8500; // £85.00 minimum booking (carpet & upholstery)

/** @type {Record<string, number>} */
export const CARPET_ITEM_PRICES_P = {
  bedroom:         5000,  // £50
  living_room:     6000,  // £60
  large_lounge:    8000,  // £80
  hallway:         2500,  // £25
  landing:         2000,  // £20
  // stairs: non-linear — see stairsLinePricePence()
  rug:             4000,  // £40  — large/wool/delicate/specialist: photo quote
  armchair:        4500,  // £45
  sofa_2:          7000,  // £70
  sofa_3:          9500,  // £95
  sofa_corner:    13000,  // £130 — from price; large/modular may need review
  mattress_single: 4500,  // £45
  mattress_double: 5500,  // £55
  mattress_king:   6500,  // £65
};

// Single source of truth for how each carpet/upholstery item is displayed —
// reused by the frontend calculator (src/data/carpetPricing.ts) and by the
// server-side itemised description builder (api/_lib/formatBookingItems.js),
// eliminating what used to be two separately-maintained label maps.
/** @type {Record<string, string>} */
export const CARPET_ITEM_LABELS = {
  bedroom:         'Bedroom',
  living_room:     'Living / dining room',
  large_lounge:    'Large or through lounge',
  hallway:         'Hallway',
  landing:         'Landing',
  stairs:          'Stairs',
  rug:             'Rug',
  armchair:        'Armchair',
  sofa_2:          '2-seater sofa',
  sofa_3:          '3-seater sofa',
  sofa_corner:     'Corner / L-shaped sofa',
  mattress_single: 'Mattress (single)',
  mattress_double: 'Mattress (double)',
  mattress_king:   'Mattress (king-size)',
};

// Rendering / iteration order — Carpets, then Sofas & Upholstery.
export const CARPET_ITEM_ORDER = [
  'bedroom', 'living_room', 'large_lounge', 'hallway', 'landing', 'stairs', 'rug',
  'armchair', 'sofa_2', 'sofa_3', 'sofa_corner', 'mattress_single', 'mattress_double', 'mattress_king',
];

// Leather upholstery is not offered through the instant calculator —
// VVE does not currently operationally support it.
export const LEATHER_UPHOLSTERY_SUPPORTED = false;

// Stairs are non-linear: £50 first flight, £40 each additional.
export const STAIRS_FIRST_P = 5000;  // £50
export const STAIRS_EXTRA_P = 4000;  // £40

/** @param {number} flights */
export function stairsLinePricePence(flights) {
  if (flights <= 0) return 0;
  return STAIRS_FIRST_P + (flights - 1) * STAIRS_EXTRA_P;
}

// ─── Carpet & upholstery bundle discount — item-count bands ─────────────────
//
// Flat £ discount bands keyed to item COUNT, not subtotal — monotonic by
// construction: adding an item can only move the band up, never reduce the
// total. Replaces the old 5%/7.5%/10% percentage cliff tiers, which could
// make the total DROP when a customer added £1-2 of extra work.
//
// Applied to the eligible carpet/upholstery item subtotal only. Does NOT
// apply to: EOT, move-in, after-builders, commercial, EOT carpet add-ons
// (already discounted for being bundled with a property clean), parking/
// congestion/access charges, or manually agreed supplements.

/** @typedef {{minItems: number, amountP: number, display: string}} BundleBand */

/** @type {BundleBand[]} Ordered highest-first so the first match (by item count) is used. */
export const CARPET_BUNDLE_BANDS = [
  { minItems: 7, amountP: 3500, display: '£35 off' }, // 7+ items
  { minItems: 5, amountP: 2000, display: '£20 off' }, // 5–6 items
  { minItems: 3, amountP: 1000, display: '£10 off' }, // 3–4 items
  { minItems: 1, amountP: 0,    display: 'No discount yet' }, // 1–2 items
];

/** @param {number} itemCount */
export function calculateBundleDiscount(itemCount) {
  const band = CARPET_BUNDLE_BANDS.find((b) => itemCount >= b.minItems) ?? CARPET_BUNDLE_BANDS[CARPET_BUNDLE_BANDS.length - 1];
  return { itemCount, amountP: band.amountP, display: band.display };
}

// Promo codes: key → discount percentage. Marketing infrastructure (e.g. the
// /leaflet page's LEAFLET20), not part of the public price book.
const PROMO_CODES = { LEAFLET20: 20 };

/**
 * Full carpet/upholstery pricing engine — the single implementation used by
 * BOTH the frontend calculator (for live display, with itemised `lines`) and
 * the server (which reads only `.finalTotal` to validate/recompute the price
 * independently of anything the browser submits).
 *
 * @param {Record<string, number>} counts - map of item key → quantity
 * @param {'normal'|'heavy'|'delicate'} condition
 * @param {number} [multiplier] - price multiplier (default 1); e.g. 0.9 for 10% off on /leaflet
 * @param {string} [promoCode]
 */
export function computeCarpetPrice(counts, condition, multiplier = 1, promoCode) {
  const isPhotoQuote = condition === 'delicate';

  const lines = [];
  let subtotal = 0;
  let totalItems = 0;

  for (const key of CARPET_ITEM_ORDER) {
    const qty = Number((counts || {})[key]) || 0;
    if (qty <= 0) continue;
    totalItems += qty;
    const raw = key === 'stairs' ? stairsLinePricePence(qty) / 100 : (CARPET_ITEM_PRICES_P[key] / 100) * qty;
    const lineTotal = Math.round(raw * multiplier);
    subtotal += lineTotal;
    lines.push({ key, label: CARPET_ITEM_LABELS[key] ?? key, qty, lineTotal });
  }

  // Heavy condition: transparently disclosed +20% estimate, always confirmed
  // before work starts (never a silent/undisclosed multiplier).
  const heavySurcharge = condition === 'heavy' ? Math.round(subtotal * 0.2) : 0;
  const adjustedSubtotal = subtotal + heavySurcharge;

  const promoPct = promoCode ? (PROMO_CODES[String(promoCode).toUpperCase()] ?? 0) : 0;
  const bandResult = calculateBundleDiscount(totalItems);
  const bundleSave = Math.round((bandResult.amountP / 100) * multiplier);
  const promoSave = promoPct > 0 ? Math.round(adjustedSubtotal * promoPct / 100) : 0;
  const finalSaving = Math.max(bundleSave, promoSave);
  const bundleSource = finalSaving === 0 ? 'none' : promoSave > bundleSave ? 'promo' : 'bundle';

  const bandsAsc = [...CARPET_BUNDLE_BANDS].reverse();
  const nextBand = bandsAsc.find((b) => b.minItems > totalItems) ?? null;
  const toNextBand = nextBand ? nextBand.minItems - totalItems : 0;

  const bundle = {
    saving: finalSaving,
    source: bundleSource,
    preDiscount: adjustedSubtotal,
    itemCount: totalItems,
    display: bundleSource === 'promo' ? `${promoPct}% off` : bandResult.display,
    nextBandItems: nextBand ? nextBand.minItems : null,
    toNextBand,
    nextBandSaving: nextBand ? nextBand.amountP / 100 : 0,
  };

  const discountedSubtotal = adjustedSubtotal - finalSaving;
  const minApplied = !isPhotoQuote && discountedSubtotal > 0 && discountedSubtotal < CARPET_MIN_BOOKING_P / 100;
  const minAdjustment = minApplied ? (CARPET_MIN_BOOKING_P / 100) - discountedSubtotal : 0;
  const finalTotal = isPhotoQuote
    ? 0
    : discountedSubtotal > 0
      ? Math.max(discountedSubtotal, CARPET_MIN_BOOKING_P / 100)
      : 0;
  const showSaving = finalSaving > 0 && !minApplied;

  return {
    lines, subtotal, heavySurcharge, adjustedSubtotal,
    bundle, discountedSubtotal, minAdjustment, finalTotal, minApplied, showSaving,
    totalItems, isPhotoQuote,
  };
}

// ─── End of tenancy — two packages ───────────────────────────────────────────
//
// "Complete Agency-Ready Clean" — the highlighted, recommended, whole-property
// package. Guarantee covers the full agency-ready checklist.
//
// "Tailored Checklist Clean" — a lower starting price covering the core
// property clean; the customer adds back only the internal tasks they need
// (fridge/freezer, cupboards, dishwasher, washer). The guarantee applies only
// to the tasks actually included in the confirmed quote.
//
// Both assume the property is vacant, in normal used condition, with
// reasonable access. Heavy soiling, mould, biohazard, hoarding-type or
// extreme conditions always require a photo review and confirmed quote —
// never an automatic multiplier.

/** @type {Record<string, number>} */
export const EOT_COMPLETE_PRICES_P = {
  studio: 19900,  // £199
  bed1:   24900,  // £249
  bed2:   31900,  // £319
  bed3:   37900,  // £379
  bed4:   49900,  // £499
};

// Backward/forward-compatible alias — "the" EOT price shown wherever a single
// headline figure is needed (service cards, structured data, SEO copy). This
// IS the Complete package price: it is VVE's flagship, guaranteed-complete
// product and the one that should anchor comparisons.
export const EOT_BASE_PRICES_P = EOT_COMPLETE_PRICES_P;

/** @type {Record<string, number>} */
export const EOT_TAILORED_START_PRICES_P = {
  studio: 15900,  // £159
  bed1:   19900,  // £199
  bed2:   25900,  // £259
  bed3:   31900,  // £319
  bed4:   41900,  // £419
};

// Per additional bathroom beyond the first (integer pence).
export const EOT_EXTRA_BATH_P = 4000;  // £40
// Per additional separate WC beyond the first.
export const EOT_EXTRA_WC_P = 2000;  // £20
// House or maisonette adjustment (applies to both packages).
export const EOT_HOUSE_ADJUSTMENT_P = 3000;  // £30

// Re-clean guarantee window, in hours. Shared by both packages — only the
// SCOPE differs (Complete = full checklist; Tailored = selected tasks only).
// 72 hours (raised from the previously-live 48-hour window) and the
// Complete/Tailored scope split are both owner-approved.
export const EOT_GUARANTEE_HOURS = 72;
export const EOT_GUARANTEE_APPROVED = true;

// Tailored internal add-ons — priced individually so the customer can build
// back only what they need. Never added silently; always shown before
// selection.
/** @type {Record<string, number>} */
export const EOT_TAILORED_ADDON_PRICES_P = {
  fridge_freezer_inside:  2500,  // £25 — inside standard fridge/freezer
  extra_fridge_freezer:   1500,  // £15 each — additional separate fridge or freezer
  dishwasher_inside:      1000,  // £10 — inside dishwasher compartments
  washing_machine_inside: 1000,  // £10 — inside washing-machine compartments
};

/** @type {Record<string, string>} */
export const EOT_TAILORED_ADDON_LABELS = {
  fridgeFreezerInside:  'Inside fridge/freezer',
  extraFridgeFreezers:  'Additional fridge/freezer',
  dishwasherInside:     'Inside dishwasher',
  washingMachineInside: 'Inside washing machine',
  cupboards:            'Cupboards, drawers & wardrobes',
};

// Cupboards/drawers/wardrobes add-on scales with property size.
/** @type {Record<string, number>} */
export const EOT_TAILORED_CUPBOARDS_PRICES_P = {
  studio: 2500,  // £25
  bed1:   2500,  // £25
  bed2:   3500,  // £35
  bed3:   4500,  // £45
  bed4:   5500,  // £55
};

/**
 * The full price of building every Tailored add-on manually for a given
 * size (used to prove Complete stays better value and to compute the
 * "switch to Complete" nudge). Assumes 1 fridge/freezer, no extra units.
 * @param {SizeKey} size
 */
export function tailoredFullAddonTotalP(size) {
  return (
    EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside +
    EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside +
    EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside +
    EOT_TAILORED_CUPBOARDS_PRICES_P[size]
  );
}

// Additional areas (charged on top of the base EOT price, either package):
/** @type {Record<string, number>} */
export const EOT_EXTRA_AREAS_P = {
  reception:    3500,  // £35 — additional reception room
  conservatory: 4000,  // £40
  balcony:      2500,  // £25 from
  utility:      2500,  // £25
};

// EOT/move-in carpet add-on prices — discounted vs. standalone carpet
// cleaning because travel/setup is already covered by the property clean.
// These do NOT receive the CARPET_BUNDLE_BANDS discount a second time.
/** @type {Record<string, number>} */
export const EOT_CARPET_ADDON_PRICES_P = {
  bedroom:      4000,  // £40
  living_room:  5500,  // £55
  large_lounge: 7000,  // £70
  hallway:      2000,  // £20
  landing:      1500,  // £15
  stairs_first: 4500,  // £45 first flight
  stairs_extra: 3500,  // £35 each additional flight
};

// Whole-home carpet bundle add-on to EOT/move-in, at EOT reduced rates —
// derived from EOT_CARPET_ADDON_PRICES_P for typical room counts. Exact
// itemised per-room pricing is what Step 5 of the EOT wizard actually
// charges; this whole-home shortcut is used by the flat "add carpets"
// toggle. Does not receive CARPET_BUNDLE_BANDS on top (see comment above).
/** @type {Record<string, number>} */
export const EOT_CARPET_BUNDLE_P = {
  studio: EOT_CARPET_ADDON_PRICES_P.hallway + EOT_CARPET_ADDON_PRICES_P.bedroom,                                                    // £60
  bed1:   EOT_CARPET_ADDON_PRICES_P.hallway + EOT_CARPET_ADDON_PRICES_P.bedroom,                                                    // £60
  bed2:   EOT_CARPET_ADDON_PRICES_P.hallway + EOT_CARPET_ADDON_PRICES_P.bedroom * 2,                                                // £100
  bed3:   EOT_CARPET_ADDON_PRICES_P.hallway + EOT_CARPET_ADDON_PRICES_P.landing + EOT_CARPET_ADDON_PRICES_P.bedroom * 3,            // £155
  bed4:   EOT_CARPET_ADDON_PRICES_P.hallway + EOT_CARPET_ADDON_PRICES_P.landing + EOT_CARPET_ADDON_PRICES_P.bedroom * 4,            // £195
};

/**
 * Default bedroom/reception/hallway/landing/stairs room list for the EOT
 * floor-care step, generated from property type + size. Purely a sensible
 * starting point — every room can be added/removed/re-typed by the customer.
 * @param {SizeKey} size
 * @param {'flat'|'house'|'maisonette'} propertyType
 */
export function generateDefaultRooms(size, propertyType) {
  const bedroomCount = { studio: 0, bed1: 1, bed2: 2, bed3: 3, bed4: 4 }[size] ?? 1;
  /** @type {{id: string, label: string, addonKey: keyof typeof EOT_CARPET_ADDON_PRICES_P | 'stairs', floor: 'unset'|'carpet'|'hard'|'na', removable: boolean}[]} */
  const rooms = [];

  if (size === 'studio') {
    rooms.push({ id: 'main', label: 'Studio / main room', addonKey: 'bedroom', floor: 'unset', removable: false });
  } else {
    for (let i = 1; i <= bedroomCount; i++) {
      rooms.push({ id: `bedroom-${i}`, label: bedroomCount > 1 ? `Bedroom ${i}` : 'Bedroom', addonKey: 'bedroom', floor: 'unset', removable: i > 1 });
    }
  }

  rooms.push({ id: 'reception', label: 'Living / reception room', addonKey: 'living_room', floor: 'unset', removable: false });
  rooms.push({ id: 'hallway', label: 'Hallway', addonKey: 'hallway', floor: 'unset', removable: true });

  // Houses/maisonettes are more likely to have a landing and stairs; flats
  // (especially studios/1-beds) usually don't — still fully removable/addable.
  const isMultiFloor = propertyType === 'house' || propertyType === 'maisonette' || ['bed3', 'bed4'].includes(size);
  rooms.push({ id: 'landing', label: 'Landing', addonKey: 'landing', floor: 'unset', removable: !isMultiFloor });
  rooms.push({ id: 'stairs', label: 'Stairs', addonKey: 'stairs', floor: 'unset', removable: !isMultiFloor });

  return rooms;
}

/**
 * Price of adding professional carpet steam cleaning to one room in the EOT
 * floor-care step, at the discounted property-clean add-on rate.
 * @param {string} addonKey
 * @param {number} [stairFlights]
 */
export function eotCarpetAddonPriceP(addonKey, stairFlights = 1) {
  if (addonKey === 'stairs') {
    if (stairFlights <= 0) return 0;
    return EOT_CARPET_ADDON_PRICES_P.stairs_first + (stairFlights - 1) * EOT_CARPET_ADDON_PRICES_P.stairs_extra;
  }
  return EOT_CARPET_ADDON_PRICES_P[addonKey] ?? 0;
}

// ─── EOT quote calculation ────────────────────────────────────────────────────

/**
 * @typedef {Object} EotQuoteInput
 * @property {SizeKey} size
 * @property {'complete'|'tailored'} package
 * @property {boolean} isHouse
 * @property {number} extraBathrooms
 * @property {number} extraWcs
 * @property {{fridgeFreezerInside?: boolean, extraFridgeFreezers?: number, dishwasherInside?: boolean, washingMachineInside?: boolean, cupboards?: boolean}} [tailoredAddOns]
 * @property {Record<string, number>} [carpetRoomsAddonKeys] - room id → stair flight count (only meaningful for stairs); other rooms just need to be present in carpetRoomIds
 * @property {string[]} [carpetRoomIds] - ids of rooms (from generateDefaultRooms) with carpet steam cleaning added
 * @property {{id: string, addonKey: string, floor: string}[]} [rooms] - full room list, used to look up addonKey/stairFlights for carpetRoomIds
 */

/** @param {EotQuoteInput} input */
export function calculateEotQuote(input) {
  const { size, isHouse, extraBathrooms, extraWcs } = input;
  const houseAdjP = isHouse ? EOT_HOUSE_ADJUSTMENT_P : 0;
  const bathroomsAddP = Math.max(0, extraBathrooms) * EOT_EXTRA_BATH_P;
  const wcsAddP = Math.max(0, extraWcs) * EOT_EXTRA_WC_P;

  const completeEquivalentP = EOT_COMPLETE_PRICES_P[size] + houseAdjP + bathroomsAddP + wcsAddP;

  // Floor-care carpet add-ons apply identically to either package — Complete
  // never automatically includes carpet steam cleaning.
  const carpetAddonP = calculateEotCarpetAddonsTotalP(input.rooms, input.carpetRoomIds);

  if (input.package === 'complete') {
    return {
      basePriceP: EOT_COMPLETE_PRICES_P[size],
      houseAdjP, bathroomsAddP, wcsAddP,
      tailoredAddOnsP: 0,
      carpetAddonP,
      totalP: completeEquivalentP + carpetAddonP,
      guaranteeHours: EOT_GUARANTEE_HOURS,
      guaranteeScope: 'complete',
      shouldOfferComplete: false,
      completeEquivalentP,
    };
  }

  const t = input.tailoredAddOns ?? {};
  let tailoredAddOnsP = 0;
  if (t.fridgeFreezerInside) tailoredAddOnsP += EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside;
  if (t.dishwasherInside) tailoredAddOnsP += EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside;
  if (t.washingMachineInside) tailoredAddOnsP += EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside;
  if (t.cupboards) tailoredAddOnsP += EOT_TAILORED_CUPBOARDS_PRICES_P[size];
  tailoredAddOnsP += Math.max(0, t.extraFridgeFreezers ?? 0) * EOT_TAILORED_ADDON_PRICES_P.extra_fridge_freezer;

  const basePriceP = EOT_TAILORED_START_PRICES_P[size];
  const totalP = basePriceP + houseAdjP + bathroomsAddP + wcsAddP + tailoredAddOnsP + carpetAddonP;

  return {
    basePriceP, houseAdjP, bathroomsAddP, wcsAddP, tailoredAddOnsP, carpetAddonP,
    totalP,
    guaranteeHours: EOT_GUARANTEE_HOURS,
    guaranteeScope: 'selected-tasks',
    shouldOfferComplete: (basePriceP + houseAdjP + bathroomsAddP + wcsAddP + tailoredAddOnsP) >= completeEquivalentP,
    completeEquivalentP,
  };
}

/**
 * @param {{id: string, addonKey: string}[]|undefined} rooms
 * @param {string[]|undefined} carpetRoomIds
 * @param {Record<string, number>} [stairFlightsByRoomId]
 */
export function calculateEotCarpetAddonsTotalP(rooms, carpetRoomIds, stairFlightsByRoomId = {}) {
  if (!rooms || !carpetRoomIds || carpetRoomIds.length === 0) return 0;
  let total = 0;
  for (const roomId of carpetRoomIds) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) continue;
    const flights = stairFlightsByRoomId[roomId] ?? 1;
    total += eotCarpetAddonPriceP(room.addonKey, flights);
  }
  return total;
}

// ─── Move-in deep clean ──────────────────────────────────────────────────────
//
// Prices assume the property is vacant and in normal condition.
// Occupied or heavily furnished properties require manual confirmation
// (may cost approx 15% more, but never added automatically).

/** @type {Record<string, number>} */
export const MOVEIN_BASE_PRICES_P = {
  studio: 15900,  // £159
  bed1:   19900,  // £199
  bed2:   24900,  // £249
  bed3:   30900,  // £309
  bed4:   38900,  // £389
};

export const MOVEIN_EXTRA_BATH_P = 3000;  // £30 per extra bathroom
export const MOVEIN_EXTRA_WC_P = 1500;  // £15 per extra WC

/** @param {{size: SizeKey, extraBathrooms: number, extraWcs: number}} input */
export function calculateMoveInQuote(input) {
  const basePriceP = MOVEIN_BASE_PRICES_P[input.size];
  const bathroomsAddP = Math.max(0, input.extraBathrooms) * MOVEIN_EXTRA_BATH_P;
  const wcsAddP = Math.max(0, input.extraWcs) * MOVEIN_EXTRA_WC_P;
  return { basePriceP, bathroomsAddP, wcsAddP, totalP: basePriceP + bathroomsAddP + wcsAddP };
}

// ─── After-builders ──────────────────────────────────────────────────────────
//
// Always "from" / estimated prices. Final fixed written price confirmed
// after reviewing photos, plans, or a site visit — never presented as final
// before that review. Heavy paint/plaster/adhesive/cement, rubble, waste or
// specialist equipment may add approx 25%–50% — never automatically; always
// agreed with the customer. Unchanged from the existing live ladder — the
// audit found it competitively priced and more transparent than most
// competitors.

/** @type {Record<string, number>} */
export const AFTER_BUILDERS_FROM_PRICES_P = {
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

/** @param {'small'|SizeKey} size */
export function calculateAfterBuildersEstimate(size) {
  return {
    fromP: AFTER_BUILDERS_FROM_PRICES_P[size] ?? AFTER_BUILDERS_START_FROM_P,
    pricingMode: 'from',
    note: 'Starting price only — the final fixed written price is confirmed after we review photos, plans, or complete a site visit.',
  };
}

// ─── Commercial pricing ──────────────────────────────────────────────────────

// Regular contract cleaning
export const COMMERCIAL_REGULAR_HOURLY_P = 2750;  // £27.50 per cleaner-hour
export const COMMERCIAL_REGULAR_MIN_HOURS = 2;     // minimum hours per visit
export const COMMERCIAL_REGULAR_MIN_CHARGE_P = 5500; // £55

// One-off commercial deep clean
export const COMMERCIAL_ONCEOFF_HOURLY_P = 3500;  // £35 per cleaner-hour
export const COMMERCIAL_ONCEOFF_MIN_HOURS = 6;     // minimum hours
export const COMMERCIAL_ONCEOFF_MIN_CHARGE_P = 21000; // £210

// Other commercial services
export const COMMERCIAL_SHOP_CAFE_FROM_P = 6500;  // £65 per visit
export const COMMERCIAL_COMMUNAL_FROM_P = 7500;  // £75 per visit
export const COMMERCIAL_EOL_FROM_P = 29900; // £299 end-of-lease
export const COMMERCIAL_AFTER_BUILDERS_FROM_P = 34900; // £349 after-builders

// ── BUSINESS DECISION — REQUIRES OWNER APPROVAL BEFORE DEPLOYMENT ──────────
// Commercial carpet: a per-sqm rate and minimum visit charge already existed
// in the repository before this pricing revision (introduced during the
// earlier `feature/pricing-system-overhaul` branch, commit
// "feat: sync commercial and catalogue pricing", 2026-07-28) — this task did
// not invent it. However, the repository has no record of how the £4.50/sqm
// figure was derived (no job-costing note, no comparison to actual visit
// durations) — it cannot be confirmed as operationally approved from the
// repository alone. Kept live (not converted to quote-only) to preserve
// existing working functionality, but flagged explicitly here rather than
// silently treated as approved. Confirm the rate with the business owner,
// then set COMMERCIAL_CARPET_RATE_APPROVED to true.
export const COMMERCIAL_CARPET_PER_SQM_P = 450;   // £4.50 per sqm
export const COMMERCIAL_CARPET_MIN_P = 12000; // £120 minimum
export const COMMERCIAL_CARPET_RATE_APPROVED = false; // set true once the business owner confirms

// ─── Window, garden & pressure washing ───────────────────────────────────────
//
// "From" prices must be genuinely achievable. Both window cleaning and
// garden services previously advertised "from £45" against a £75 minimum
// call-out — a misleading price indication (ASA pattern). Both now quote the
// true floor.

export const WINDOW_CLEANING_FROM_P = 7500;  // £75
export const WINDOW_CLEANING_MIN_P = 7500;  // £75 minimum call-out on standalone visits
export const WINDOW_CLEANING_SCOPE = 'Exterior windows, streak-free. Ground and first-floor reach.';

export const GARDEN_SERVICES_FROM_P = 7500;  // £75
export const GARDEN_SERVICES_MIN_P = 7500;  // £75 minimum call-out

export const PRESSURE_WASHING_FROM_P = 12000; // £120

// Quick-quote ladder used by the standalone window/gutter "get a rough price"
// tool in the calculator. Every tier is now at or above the true £75 floor so
// "from £75" is always achievable.
/** @type {Record<string, number>} */
export const WINDOW_QUICK_PRICES_P = {
  small:  7500,  // £75 — 1–2 bed
  medium: 8500,  // £85 — 3 bed
  large:  9500,  // £95 — 4+ bed
};
/** @type {Record<string, number>} */
export const GUTTER_QUICK_PRICES_P = {
  terraced:      7500,  // £75
  semi_detached: 11000, // £110
  detached:      16000, // £160
};
export const QUICK_QUOTE_MIN_CHARGE_P = 7500; // £75 — shared floor for window/gutter/office quick quotes

// ─── Optional add-on extras ───────────────────────────────────────────────────

/** @type {Record<string, number>} */
export const ADDON_PRICES_P = {
  oven:        3500,  // £35 (FREE when booked with EOT)
  fridge:      2500,  // £25 (aligned with EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside)
  ext_windows: 3500,  // £35
  balcony:     3500,  // £35
  wall_marks:  2500,  // £25 per wall, subject to assessment
  key_collect: 1000,  // £10
  rubbish:     4000,  // £40 (small load)
};

// ─── Booking constants ────────────────────────────────────────────────────────

export const DEPOSIT_P = 3000;  // £30 — deducted from final balance. Never removed, never changed here casually.

/** @param {number} totalP */
export function calculateDepositAndBalance(totalP) {
  const depositP = Math.min(DEPOSIT_P, Math.max(0, totalP));
  const balanceP = Math.max(0, totalP - depositP);
  return { depositP, balanceP };
}

// ─── Access charges — parking / Congestion Charge ────────────────────────────
//
// BookingPage asks these as two required questions for every booking,
// regardless of service, and shows them as a clearly-labelled ESTIMATE added
// on top of the quoted cleaning price — never folded silently into it, and
// always reconciled to the actual cost afterwards. Kept out of every
// per-service quote calculator's own running total (including the EOT
// wizard) for the same reason: the wizard price is a quote for the cleaning
// itself, this is a separate, itemised pass-through applied once at booking.
export const PARKING_ESTIMATE_P = 1500;   // £15 estimate — parking not available or unsure, charged at actual cost
export const CONGESTION_CHARGE_P = 1800;  // £18 — Congestion Charge zone pass-through
export const PARKING_CHARGED_AT_ACTUAL_COST_NOTE =
  'Parking is charged at the actual cost. The final balance will be adjusted if it costs less or more.';

/** @param {{parkingAvailable?: string, congestionZone?: string}} quoteConfig */
export function accessSurchargeP(quoteConfig) {
  let addP = 0;
  if (quoteConfig.parkingAvailable === 'no' || quoteConfig.parkingAvailable === 'not_sure') {
    addP += PARKING_ESTIMATE_P;
  }
  if (quoteConfig.congestionZone === 'yes' || quoteConfig.congestionZone === 'not_sure') {
    addP += CONGESTION_CHARGE_P;
  }
  return addP;
}

// ─── Same-day / next-day policy (no surcharge) ───────────────────────────────

export const SAME_DAY_POLICY_SHORT =
  'Same-day and next-day appointments may be available at the normal price. Contact us to check availability.';

// ─── Coverage area — single canonical list ───────────────────────────────────

export const COVERAGE_POSTCODES = [
  'E1', 'E2', 'E3', 'E5', 'E8', 'E9', 'E10', 'E14', 'E15', 'E17', 'E20',
  'N1', 'N4', 'N5', 'N7', 'N8', 'N10', 'N15', 'N16', 'N17', 'N19', 'N22',
  'NW1', 'NW5',
];
export const COVERAGE_SUMMARY = 'East & North London';
export const COVERAGE_POSTCODE_LIST = COVERAGE_POSTCODES.join(', ');

// ─── Helper: pounds display ───────────────────────────────────────────────────

/** @param {number} pence */
export function penceToDisplay(pence) {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}
export const formatPrice = penceToDisplay;

/** @param {ServiceStartingPriceKey} key */
export function getServiceStartingPrice(key) {
  switch (key) {
    case 'eot_complete':      return { pricingMode: 'fixed', fromP: EOT_COMPLETE_PRICES_P.studio,      label: `From ${penceToDisplay(EOT_COMPLETE_PRICES_P.studio)}` };
    case 'eot_tailored':      return { pricingMode: 'fixed', fromP: EOT_TAILORED_START_PRICES_P.studio, label: `From ${penceToDisplay(EOT_TAILORED_START_PRICES_P.studio)}` };
    case 'move_in':           return { pricingMode: 'fixed', fromP: MOVEIN_BASE_PRICES_P.studio,        label: `From ${penceToDisplay(MOVEIN_BASE_PRICES_P.studio)}` };
    case 'after_builders':    return { pricingMode: 'from',  fromP: AFTER_BUILDERS_START_FROM_P,        label: `From ${penceToDisplay(AFTER_BUILDERS_START_FROM_P)}` };
    case 'carpet':            return { pricingMode: 'fixed', fromP: CARPET_MIN_BOOKING_P,               label: `From ${penceToDisplay(CARPET_MIN_BOOKING_P)}` };
    case 'upholstery':        return { pricingMode: 'fixed', fromP: CARPET_MIN_BOOKING_P,               label: `From ${penceToDisplay(CARPET_MIN_BOOKING_P)}` };
    case 'window':            return { pricingMode: 'from',  fromP: WINDOW_CLEANING_FROM_P,              label: `From ${penceToDisplay(WINDOW_CLEANING_FROM_P)}` };
    case 'garden':            return { pricingMode: 'from',  fromP: GARDEN_SERVICES_FROM_P,              label: `From ${penceToDisplay(GARDEN_SERVICES_FROM_P)}` };
    case 'pressure_washing':  return { pricingMode: 'from',  fromP: PRESSURE_WASHING_FROM_P,             label: `From ${penceToDisplay(PRESSURE_WASHING_FROM_P)}` };
    case 'commercial':        return { pricingMode: 'quote_required', fromP: null,                        label: 'Quote required' };
    // Kept quote-required regardless of COMMERCIAL_CARPET_RATE_APPROVED: the
    // £4.50/sqm rate has no documented operational sign-off (see that flag's
    // comment above), so no instant "from" price is shown for this service
    // even though the constant exists for internal/admin reference.
    case 'commercial_carpet': return { pricingMode: 'quote_required', fromP: null,                        label: 'Quote required' };
    default:
      throw new Error(`Unknown starting-price key: ${key}`);
  }
}
/** @typedef {'eot_complete'|'eot_tailored'|'move_in'|'after_builders'|'carpet'|'upholstery'|'window'|'garden'|'pressure_washing'|'commercial'|'commercial_carpet'} ServiceStartingPriceKey */

// ═══════════════════════════════════════════════════════════════════════════
// Server-side price authority — the ONLY function that turns a browser-
// submitted quoteConfig into a validated price. Never trusts a client total.
// ═══════════════════════════════════════════════════════════════════════════

const STAIR_ADDON_PRICES_LEGACY = [0, EOT_CARPET_ADDON_PRICES_P.stairs_first, EOT_CARPET_ADDON_PRICES_P.stairs_first + EOT_CARPET_ADDON_PRICES_P.stairs_extra, EOT_CARPET_ADDON_PRICES_P.stairs_first + 2 * EOT_CARPET_ADDON_PRICES_P.stairs_extra];

function computeEotPriceServer(deepSize, deepBaths, deepWcs, isHouse, eotPackage, tailoredAddOns, rooms, carpetRoomIds) {
  if (!EOT_COMPLETE_PRICES_P[deepSize]) return null;
  const result = calculateEotQuote({
    size: deepSize,
    package: eotPackage === 'tailored' ? 'tailored' : 'complete',
    isHouse: Boolean(isHouse),
    extraBathrooms: Math.max(0, (Number(deepBaths) || 1) - 1),
    extraWcs: Math.max(0, Number(deepWcs) || 0),
    tailoredAddOns: tailoredAddOns || {},
    rooms, carpetRoomIds,
  });
  return result.totalP / 100;
}

/**
 * Recompute the total price from a quoteConfig object sent by the frontend.
 * Returns null if config is missing or unrecognised (caller should fall through).
 * Every value returned is in POUNDS (not pence) to match this function's
 * pre-existing public contract with api/create-checkout-session.js.
 */
function computeBasePrice(quoteConfig) {
  if (!quoteConfig || !quoteConfig.service) return null;

  const {
    service, deepService, deepSize, deepBaths, deepWcs, isHouse, eotPackage, tailoredAddOns,
    rooms, carpetRoomIds,
    addOnCounts, windowSize, gutterType, officeHours,
    carpetCounts, carpetCondition,
  } = quoteConfig;

  if (service === 'deep') {
    if (deepService === 'carpet_upholstery' && carpetCounts) {
      if (carpetCondition === 'delicate') return null; // photo quote — no fixed price
      const r = computeCarpetPrice(carpetCounts, carpetCondition || 'normal');
      return r.finalTotal > 0 ? r.finalTotal : null;
    }

    if (deepService === 'end_of_tenancy') {
      const eotTotal = computeEotPriceServer(deepSize, deepBaths, deepWcs, isHouse, eotPackage, tailoredAddOns, rooms, carpetRoomIds);
      if (eotTotal === null) return null;

      let addons = 0;
      if (addOnCounts && typeof addOnCounts === 'object') {
        for (const [key, count] of Object.entries(addOnCounts)) {
          const n = Number(count) || 0;
          if (n <= 0) continue;
          if (key === 'oven' || key === 'fridge') continue; // free with EOT / handled by tailoredAddOns
          if (key === 'carpet_bundle') addons += ((EOT_CARPET_BUNDLE_P[deepSize] ?? 0) / 100) * n;
          else addons += ((ADDON_PRICES_P[key] ?? 0) / 100) * n;
        }
      }
      return eotTotal + addons;
    }

    const BASE_PRICES_OTHER = { move_in: MOVEIN_BASE_PRICES_P, after_builders: AFTER_BUILDERS_FROM_PRICES_P };
    const BATH_SURCHARGE_OTHER = { move_in: MOVEIN_EXTRA_BATH_P, after_builders: 0 };
    const WC_SURCHARGE_OTHER = { move_in: MOVEIN_EXTRA_WC_P, after_builders: 0 };

    const bp = BASE_PRICES_OTHER[deepService];
    if (!bp) return null;
    const base = bp[deepSize];
    if (!base) return null;

    const bathExtra = (Math.max(0, (deepBaths || 1) - 1) * (BATH_SURCHARGE_OTHER[deepService] || 0)) / 100;
    const wcExtra = (Math.max(0, Number(deepWcs) || 0) * (WC_SURCHARGE_OTHER[deepService] || 0)) / 100;

    let addons = 0;
    if (addOnCounts && typeof addOnCounts === 'object') {
      for (const [key, count] of Object.entries(addOnCounts)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        if (key === 'staircase') {
          addons += (STAIR_ADDON_PRICES_LEGACY[Math.min(n, 3)] ?? 0) / 100;
        } else if (key === 'carpet_bundle') {
          addons += ((EOT_CARPET_BUNDLE_P[deepSize] ?? 0) / 100) * n;
        } else {
          addons += ((ADDON_PRICES_P[key] ?? 0) / 100) * n;
        }
      }
    }
    return base / 100 + bathExtra + wcExtra + addons;
  }

  if (service === 'window') {
    return Math.max((WINDOW_QUICK_PRICES_P[windowSize] ?? WINDOW_QUICK_PRICES_P.small) / 100, QUICK_QUOTE_MIN_CHARGE_P / 100);
  }
  if (service === 'gutter') {
    return Math.max((GUTTER_QUICK_PRICES_P[gutterType] ?? GUTTER_QUICK_PRICES_P.terraced) / 100, QUICK_QUOTE_MIN_CHARGE_P / 100);
  }
  if (service === 'office') {
    const h = Math.max(Number(officeHours) || COMMERCIAL_REGULAR_MIN_HOURS, COMMERCIAL_REGULAR_MIN_HOURS);
    return Math.max(h * (COMMERCIAL_REGULAR_HOURLY_P / 100), COMMERCIAL_REGULAR_MIN_CHARGE_P / 100);
  }

  return null;
}

/**
 * Public entry point: the quoted cleaning price plus BookingPage's two
 * required, itemised access-charge questions (parking / Congestion Charge),
 * which apply once per booking regardless of service — see accessSurchargeP.
 * @param {Record<string, unknown>} quoteConfig
 */
export function computePrice(quoteConfig) {
  const base = computeBasePrice(quoteConfig);
  if (base === null) return null;
  return base + accessSurchargeP(quoteConfig) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin CRM catalogue seed — explicit, opt-in starter list for the Products &
// Services feature (admin/api/catalogue.js ?action=seed). Nothing here ever
// runs automatically, and no migration inserts these rows. Computed directly
// from the constants above so it can never drift out of sync with them.
// ═══════════════════════════════════════════════════════════════════════════

const seed = (name, pence, category, description = null) => ({
  name, description, default_price_pence: pence, item_type: 'service', category,
});

export const CATALOGUE_SEED_ITEMS = [
  // ── End of tenancy — Complete Agency-Ready Clean ──────────────────────
  seed('End of tenancy clean (Complete) — studio',    EOT_COMPLETE_PRICES_P.studio, 'End of tenancy', 'Fixed price, full agency-ready checklist, oven clean included. 1 bathroom.'),
  seed('End of tenancy clean (Complete) — 1 bedroom', EOT_COMPLETE_PRICES_P.bed1,   'End of tenancy', 'Fixed price, full agency-ready checklist, oven clean included. 1 bathroom.'),
  seed('End of tenancy clean (Complete) — 2 bedroom', EOT_COMPLETE_PRICES_P.bed2,   'End of tenancy', 'Fixed price, full agency-ready checklist, oven clean included. 1 bathroom.'),
  seed('End of tenancy clean (Complete) — 3 bedroom', EOT_COMPLETE_PRICES_P.bed3,   'End of tenancy', 'Fixed price, full agency-ready checklist, oven clean included. 1 bathroom.'),
  seed('End of tenancy clean (Complete) — 4 bedroom', EOT_COMPLETE_PRICES_P.bed4,   'End of tenancy', 'Fixed price, full agency-ready checklist, oven clean included. 1 bathroom.'),

  // ── End of tenancy — Tailored Checklist Clean ─────────────────────────
  seed('End of tenancy clean (Tailored) — studio',    EOT_TAILORED_START_PRICES_P.studio, 'End of tenancy', 'Starting price — core clean; add internal tasks separately. Guarantee covers selected tasks only.'),
  seed('End of tenancy clean (Tailored) — 1 bedroom', EOT_TAILORED_START_PRICES_P.bed1,   'End of tenancy', 'Starting price — core clean; add internal tasks separately. Guarantee covers selected tasks only.'),
  seed('End of tenancy clean (Tailored) — 2 bedroom', EOT_TAILORED_START_PRICES_P.bed2,   'End of tenancy', 'Starting price — core clean; add internal tasks separately. Guarantee covers selected tasks only.'),
  seed('End of tenancy clean (Tailored) — 3 bedroom', EOT_TAILORED_START_PRICES_P.bed3,   'End of tenancy', 'Starting price — core clean; add internal tasks separately. Guarantee covers selected tasks only.'),
  seed('End of tenancy clean (Tailored) — 4 bedroom', EOT_TAILORED_START_PRICES_P.bed4,   'End of tenancy', 'Starting price — core clean; add internal tasks separately. Guarantee covers selected tasks only.'),

  // ── EOT bath/WC/house surcharges ───────────────────────────────────────
  seed('EOT — additional full bathroom',      EOT_EXTRA_BATH_P,       'End of tenancy', 'Per extra bathroom beyond the first.'),
  seed('EOT — additional WC',                 EOT_EXTRA_WC_P,         'End of tenancy', 'Per additional separate WC beyond the first.'),
  seed('EOT — house / maisonette adjustment', EOT_HOUSE_ADJUSTMENT_P, 'End of tenancy', 'Applies to houses and maisonettes (not flats).'),

  // ── EOT Tailored internal add-ons ──────────────────────────────────────
  seed('EOT Tailored — inside fridge/freezer',     EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside, 'End of tenancy', 'Inside one standard fridge/freezer.'),
  seed('EOT Tailored — additional fridge/freezer', EOT_TAILORED_ADDON_PRICES_P.extra_fridge_freezer,  'End of tenancy', 'Per additional separate unit.'),
  seed('EOT Tailored — inside dishwasher',         EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside,      'End of tenancy'),
  seed('EOT Tailored — inside washing machine',    EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside, 'End of tenancy'),
  seed('EOT Tailored — cupboards/drawers/wardrobes — studio/1 bed', EOT_TAILORED_CUPBOARDS_PRICES_P.bed1, 'End of tenancy'),
  seed('EOT Tailored — cupboards/drawers/wardrobes — 2 bed',        EOT_TAILORED_CUPBOARDS_PRICES_P.bed2, 'End of tenancy'),
  seed('EOT Tailored — cupboards/drawers/wardrobes — 3 bed',        EOT_TAILORED_CUPBOARDS_PRICES_P.bed3, 'End of tenancy'),
  seed('EOT Tailored — cupboards/drawers/wardrobes — 4 bed',        EOT_TAILORED_CUPBOARDS_PRICES_P.bed4, 'End of tenancy'),

  // ── Move-in ─────────────────────────────────────────────────────────────
  seed('Move-in clean — studio',    MOVEIN_BASE_PRICES_P.studio, 'Move-in / move-out'),
  seed('Move-in clean — 1 bedroom', MOVEIN_BASE_PRICES_P.bed1,   'Move-in / move-out'),
  seed('Move-in clean — 2 bedroom', MOVEIN_BASE_PRICES_P.bed2,   'Move-in / move-out'),
  seed('Move-in clean — 3 bedroom', MOVEIN_BASE_PRICES_P.bed3,   'Move-in / move-out'),
  seed('Move-in clean — 4 bedroom', MOVEIN_BASE_PRICES_P.bed4,   'Move-in / move-out'),
  seed('Move-in — additional bathroom', MOVEIN_EXTRA_BATH_P, 'Move-in / move-out', 'Per extra bathroom beyond the first.'),
  seed('Move-in — additional WC',       MOVEIN_EXTRA_WC_P,   'Move-in / move-out', 'Per additional separate WC beyond the first.'),

  // ── After builders ────────────────────────────────────────────────────
  seed('After builders clean — small area',  AFTER_BUILDERS_FROM_PRICES_P.small,  'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — studio',      AFTER_BUILDERS_FROM_PRICES_P.studio, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 1 bedroom',   AFTER_BUILDERS_FROM_PRICES_P.bed1,   'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 2 bedroom',   AFTER_BUILDERS_FROM_PRICES_P.bed2,   'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 3 bedroom',   AFTER_BUILDERS_FROM_PRICES_P.bed3,   'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 4 bedroom',   AFTER_BUILDERS_FROM_PRICES_P.bed4,   'After builders', 'Estimated by photo before work starts.'),

  // ── EOT/move-in carpet add-ons ────────────────────────────────────────
  seed('EOT carpet add-on — bedroom',        EOT_CARPET_ADDON_PRICES_P.bedroom,      'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — living room',    EOT_CARPET_ADDON_PRICES_P.living_room,  'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — large lounge',   EOT_CARPET_ADDON_PRICES_P.large_lounge, 'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — hallway',        EOT_CARPET_ADDON_PRICES_P.hallway,      'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — landing',        EOT_CARPET_ADDON_PRICES_P.landing,      'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — stairs (first)', EOT_CARPET_ADDON_PRICES_P.stairs_first, 'EOT carpet add-ons', 'Reduced rate when added to a property clean.'),
  seed('EOT carpet add-on — stairs (extra)', EOT_CARPET_ADDON_PRICES_P.stairs_extra, 'EOT carpet add-ons', 'Per additional flight beyond the first.'),

  // ── Carpets ──────────────────────────────────────────────────────────
  seed('Bedroom carpet clean',                  CARPET_ITEM_PRICES_P.bedroom,      'Carpets'),
  seed('Living / dining room carpet clean',     CARPET_ITEM_PRICES_P.living_room,  'Carpets'),
  seed('Large or through lounge carpet clean',  CARPET_ITEM_PRICES_P.large_lounge, 'Carpets'),
  seed('Hallway carpet clean',                  CARPET_ITEM_PRICES_P.hallway,      'Carpets'),
  seed('Landing carpet clean',                  CARPET_ITEM_PRICES_P.landing,      'Carpets'),
  seed('Stairs carpet clean — first flight',    STAIRS_FIRST_P, 'Carpets'),
  seed('Stairs carpet clean — each additional', STAIRS_EXTRA_P, 'Carpets'),
  seed('Rug clean (standard)',                  CARPET_ITEM_PRICES_P.rug, 'Carpets', 'Large, wool, silk or specialist rugs need a photo quote first.'),
  seed('Carpet & upholstery minimum booking',   CARPET_MIN_BOOKING_P, 'Carpets', 'Minimum charge per visit.'),

  // ── Upholstery ─────────────────────────────────────────────────────────
  seed('Armchair clean',                CARPET_ITEM_PRICES_P.armchair,        'Upholstery'),
  seed('2-seater sofa clean',           CARPET_ITEM_PRICES_P.sofa_2,          'Upholstery'),
  seed('3-seater sofa clean',           CARPET_ITEM_PRICES_P.sofa_3,          'Upholstery'),
  seed('Corner / L-shaped sofa clean',  CARPET_ITEM_PRICES_P.sofa_corner,     'Upholstery'),
  seed('Mattress clean (single)',       CARPET_ITEM_PRICES_P.mattress_single, 'Upholstery'),
  seed('Mattress clean (double)',       CARPET_ITEM_PRICES_P.mattress_double, 'Upholstery'),
  seed('Mattress clean (king-size)',    CARPET_ITEM_PRICES_P.mattress_king,   'Upholstery'),

  // ── Add-ons ────────────────────────────────────────────────────────────
  seed('Oven clean (standalone)',             ADDON_PRICES_P.oven,        'Add-ons', 'Free when booked with an end of tenancy clean.'),
  seed('Fridge/freezer clean (add-on)',       ADDON_PRICES_P.fridge,      'Add-ons'),
  seed('External windows (add-on)',           ADDON_PRICES_P.ext_windows, 'Add-ons'),
  seed('Balcony clean (add-on)',              ADDON_PRICES_P.balcony,     'Add-ons'),
  seed('Wall marks / spot cleaning (add-on)', ADDON_PRICES_P.wall_marks,  'Add-ons', 'From price per wall, subject to assessment.'),
  seed('Key collection / drop-off (add-on)',  ADDON_PRICES_P.key_collect, 'Add-ons'),
  seed('Rubbish removal (add-on)',            ADDON_PRICES_P.rubbish,     'Add-ons', 'Small load.'),
  seed('Internal staircase (add-on)',         EOT_CARPET_ADDON_PRICES_P.stairs_first, 'Add-ons', `First staircase; additional flights ${penceToDisplay(EOT_CARPET_ADDON_PRICES_P.stairs_extra)} each.`),

  // ── Windows — quick quote ladder ──────────────────────────────────────
  seed('Window cleaning — small property',  WINDOW_QUICK_PRICES_P.small,  'Windows', 'Exterior windows, streak-free. From price; £75 minimum call-out.'),
  seed('Window cleaning — medium property', WINDOW_QUICK_PRICES_P.medium, 'Windows', 'Exterior windows, streak-free. From price; £75 minimum call-out.'),
  seed('Window cleaning — large property',  WINDOW_QUICK_PRICES_P.large,  'Windows', 'Exterior windows, streak-free. From price; £75 minimum call-out.'),

  // ── Gutters ─────────────────────────────────────────────────────────────
  seed('Gutter cleaning — terraced',      GUTTER_QUICK_PRICES_P.terraced,      'Gutters'),
  seed('Gutter cleaning — semi-detached', GUTTER_QUICK_PRICES_P.semi_detached, 'Gutters'),
  seed('Gutter cleaning — detached',      GUTTER_QUICK_PRICES_P.detached,      'Gutters'),

  // ── Commercial ─────────────────────────────────────────────────────────
  seed('Commercial cleaning — regular contract (per hour)', COMMERCIAL_REGULAR_HOURLY_P, 'Commercial', 'Minimum 2 hours (£55) per visit.'),
  seed('Commercial cleaning — one-off deep (per hour)',     COMMERCIAL_ONCEOFF_HOURLY_P, 'Commercial', 'Minimum 6 hours (£210) per visit.'),
  seed('Commercial — shop / café clean',   COMMERCIAL_SHOP_CAFE_FROM_P, 'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial — communal area clean', COMMERCIAL_COMMUNAL_FROM_P, 'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial end of lease clean',    COMMERCIAL_EOL_FROM_P, 'Commercial', 'From price; confirmed by photo.'),
  seed('Commercial after builders clean',  COMMERCIAL_AFTER_BUILDERS_FROM_P, 'Commercial', 'From price; confirmed by photo.'),
  seed('Commercial carpet cleaning (per sqm)', COMMERCIAL_CARPET_PER_SQM_P, 'Commercial', 'From price; £120 minimum visit charge. Rate pending owner approval — see COMMERCIAL_CARPET_RATE_APPROVED.'),

  // ── Other quote-led services ──────────────────────────────────────────
  seed('Pressure washing', PRESSURE_WASHING_FROM_P, 'Outdoor', 'From price; driveways, patios & paths.'),
  seed('Garden services',  GARDEN_SERVICES_FROM_P,  'Outdoor', 'From price; £75 minimum call-out.'),
];
