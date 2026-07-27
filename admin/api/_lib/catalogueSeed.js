// Explicit, opt-in starter catalogue for the Products & Services feature.
// POSTed only when an admin clicks "Import standard price list" in the CRM
// (admin/api/catalogue.js ?action=seed) — nothing here ever runs
// automatically, and no migration inserts these rows.
//
// Every price below is transcribed from the repository's own verified
// pricing constants — api/servicePrices.js (BASE_PRICES, ADDON_PRICES,
// CARPET_ITEM_PRICES, STAIR_PRICES, WINDOW_PRICES, GUTTER_PRICES,
// HOURLY_RATE) and src/data/carpetPricing.ts (CARPET_ITEM_DEFS), converted
// pounds → pence. NOTHING is invented: if a price changes on the website,
// change it in those constants first, then update this list to match.
//
// All items are item_type 'service' — VVE sells services; 'product' exists
// in the schema for ad-hoc admin-created items (e.g. cleaning products sold
// on a visit), none of which have verified repo prices to seed from.

const seed = (name, pounds, category, description = null) => ({
  name,
  description,
  default_price_pence: Math.round(pounds * 100),
  item_type: 'service',
  category,
});

export const CATALOGUE_SEED_ITEMS = [
  // ── End of tenancy (api/servicePrices.js BASE_PRICES.end_of_tenancy) ──
  seed('End of tenancy clean — studio', 159, 'End of tenancy', 'Fixed price, oven clean included.'),
  seed('End of tenancy clean — 1 bedroom', 199, 'End of tenancy', 'Fixed price, oven clean included.'),
  seed('End of tenancy clean — 2 bedroom', 249, 'End of tenancy', 'Fixed price, oven clean included.'),
  seed('End of tenancy clean — 3 bedroom', 329, 'End of tenancy', 'Fixed price, oven clean included.'),
  seed('End of tenancy clean — 4 bedroom', 419, 'End of tenancy', 'Fixed price, oven clean included.'),

  // ── Move-in (BASE_PRICES.move_in) ────────────────────────────────────
  seed('Move-in clean — studio', 139, 'Move-in / move-out'),
  seed('Move-in clean — 1 bedroom', 169, 'Move-in / move-out'),
  seed('Move-in clean — 2 bedroom', 219, 'Move-in / move-out'),
  seed('Move-in clean — 3 bedroom', 269, 'Move-in / move-out'),
  seed('Move-in clean — 4 bedroom', 329, 'Move-in / move-out'),

  // ── After builders (BASE_PRICES.after_builders) ──────────────────────
  seed('After builders clean — studio', 199, 'After builders'),
  seed('After builders clean — 1 bedroom', 239, 'After builders'),
  seed('After builders clean — 2 bedroom', 299, 'After builders'),
  seed('After builders clean — 3 bedroom', 369, 'After builders'),
  seed('After builders clean — 4 bedroom', 449, 'After builders'),

  // ── Carpets (src/data/carpetPricing.ts CARPET_ITEM_DEFS) ─────────────
  seed('Bedroom carpet clean', 50, 'Carpets'),
  seed('Living / dining room carpet clean', 70, 'Carpets'),
  seed('Large or through lounge carpet clean', 90, 'Carpets'),
  seed('Hallway carpet clean', 25, 'Carpets'),
  seed('Landing carpet clean', 15, 'Carpets'),
  seed('Stairs carpet clean — first flight', 55, 'Carpets'),
  seed('Stairs carpet clean — each additional flight', 40, 'Carpets'),
  seed('Rug clean (standard)', 40, 'Carpets', 'Large or wool rugs need a photo quote first.'),

  // ── Upholstery (CARPET_ITEM_DEFS — Sofas & Upholstery group) ─────────
  seed('Armchair clean', 50, 'Upholstery'),
  seed('2-seater sofa clean', 75, 'Upholstery'),
  seed('3-seater sofa clean', 95, 'Upholstery'),
  seed('Corner / L-shaped sofa clean', 130, 'Upholstery'),
  seed('Mattress clean (single)', 45, 'Upholstery'),
  seed('Mattress clean (double/king)', 65, 'Upholstery'),

  // ── Add-ons (api/servicePrices.js ADDON_PRICES / STAIR_PRICES) ───────
  seed('Oven clean (standalone)', 35, 'Add-ons', 'Free when booked with an end of tenancy clean.'),
  seed('Fridge/freezer clean (add-on)', 20, 'Add-ons'),
  seed('External windows (add-on)', 35, 'Add-ons'),
  seed('Wall marks / spot cleaning (add-on)', 25, 'Add-ons'),
  seed('Key collection / drop-off (add-on)', 10, 'Add-ons'),
  seed('Rubbish removal (add-on)', 40, 'Add-ons'),
  seed('Internal staircase (add-on)', 45, 'Add-ons', 'First staircase price; additional staircases £35 each per STAIR_PRICES.'),

  // ── Windows (WINDOW_PRICES) ──────────────────────────────────────────
  seed('Window cleaning — small property', 35, 'Windows'),
  seed('Window cleaning — medium property', 45, 'Windows'),
  seed('Window cleaning — large property', 55, 'Windows'),

  // ── Gutters (GUTTER_PRICES) ──────────────────────────────────────────
  seed('Gutter cleaning — terraced', 75, 'Gutters'),
  seed('Gutter cleaning — semi-detached', 110, 'Gutters'),
  seed('Gutter cleaning — detached', 160, 'Gutters'),

  // ── Commercial (HOURLY_RATE / MIN_OFFICE_HOURS) ──────────────────────
  seed('Commercial / office cleaning (per hour)', 22.5, 'Commercial', 'Minimum 4 hours per visit.'),
];
