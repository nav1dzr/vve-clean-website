// Explicit, opt-in starter catalogue for the Products & Services feature.
// POSTed only when an admin clicks "Import standard price list" in the CRM
// (admin/api/catalogue.js ?action=seed) — nothing here ever runs
// automatically, and no migration inserts these rows.
//
// Every price below is transcribed from src/data/pricing.ts (the canonical
// pricing source) converted to pounds for the seed() helper which multiplies
// by 100 → pence. If a price changes, update pricing.ts first, then
// update api/servicePrices.js and this file to match.
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
  // ── End of tenancy (EOT_BASE_PRICES_P / 100) ──────────────────────────
  seed('End of tenancy clean — studio',     229, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 1 bedroom',  299, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 2 bedroom',  369, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 3 bedroom',  449, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 4 bedroom',  549, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),

  // ── EOT bath surcharges (EOT_EXTRA_BATH_P, EOT_EXTRA_WC_P) ───────────
  seed('EOT — additional full bathroom',    50,  'End of tenancy', 'Per extra bathroom beyond the first.'),
  seed('EOT — additional WC',               25,  'End of tenancy', 'Per additional WC / half bathroom.'),

  // ── Move-in (MOVEIN_BASE_PRICES_P / 100) ─────────────────────────────
  seed('Move-in clean — studio',            179, 'Move-in / move-out'),
  seed('Move-in clean — 1 bedroom',         219, 'Move-in / move-out'),
  seed('Move-in clean — 2 bedroom',         269, 'Move-in / move-out'),
  seed('Move-in clean — 3 bedroom',         329, 'Move-in / move-out'),
  seed('Move-in clean — 4 bedroom',         429, 'Move-in / move-out'),

  // ── Move-in bath surcharge (MOVEIN_EXTRA_BATH_P) ─────────────────────
  seed('Move-in — additional bathroom',      40, 'Move-in / move-out', 'Per extra bathroom beyond the first.'),

  // ── After builders (AFTER_BUILDERS_FROM_PRICES_P / 100) ─────────────
  seed('After builders clean — small area',  249, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — studio',      279, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 1 bedroom',   329, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 2 bedroom',   399, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 3 bedroom',   499, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 4 bedroom',   625, 'After builders', 'Estimated by photo before work starts.'),

  // ── EOT carpet add-ons (EOT_CARPET_ADDON_PRICES_P / 100) ─────────────
  seed('EOT carpet add-on — bedroom',        40,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — living room',    55,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — large lounge',   75,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — hallway',        20,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — landing',        12,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — stairs (first)', 45,  'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — stairs (extra)', 35,  'EOT carpet add-ons', 'Per additional flight beyond the first.'),

  // ── Carpets (CARPET_ITEM_PRICES_P / 100, STAIRS_FIRST_P, STAIRS_EXTRA_P)
  seed('Bedroom carpet clean',                    50,  'Carpets'),
  seed('Living / dining room carpet clean',       70,  'Carpets'),
  seed('Large or through lounge carpet clean',    90,  'Carpets'),
  seed('Hallway carpet clean',                    25,  'Carpets'),
  seed('Landing carpet clean',                    15,  'Carpets'),
  seed('Stairs carpet clean — first flight',      55,  'Carpets'),
  seed('Stairs carpet clean — each additional',   40,  'Carpets'),
  seed('Rug clean (standard)',                     40,  'Carpets', 'Large or wool rugs need a photo quote first.'),

  // ── Upholstery (CARPET_ITEM_PRICES_P / 100) ──────────────────────────
  seed('Armchair clean',                     50,  'Upholstery'),
  seed('2-seater sofa clean',                75,  'Upholstery'),
  seed('3-seater sofa clean',                95,  'Upholstery'),
  seed('Corner / L-shaped sofa clean',      130,  'Upholstery'),
  seed('Mattress clean (single)',             45,  'Upholstery'),
  seed('Mattress clean (double/king)',        65,  'Upholstery'),

  // ── Add-ons (ADDON_PRICES_P / 100) ───────────────────────────────────
  seed('Oven clean (standalone)',             35,  'Add-ons', 'Free when booked with an end of tenancy clean.'),
  seed('Fridge/freezer clean (add-on)',       20,  'Add-ons'),
  seed('External windows (add-on)',           35,  'Add-ons'),
  seed('Wall marks / spot cleaning (add-on)', 25,  'Add-ons'),
  seed('Key collection / drop-off (add-on)',  10,  'Add-ons'),
  seed('Rubbish removal (add-on)',            40,  'Add-ons'),
  seed('Internal staircase (add-on)',         45,  'Add-ons', 'First staircase; additional flights £35 each.'),

  // ── Windows (WINDOW_PRICES) ───────────────────────────────────────────
  seed('Window cleaning — small property',   35,  'Windows'),
  seed('Window cleaning — medium property',  45,  'Windows'),
  seed('Window cleaning — large property',   55,  'Windows'),

  // ── Gutters (GUTTER_PRICES) ───────────────────────────────────────────
  seed('Gutter cleaning — terraced',         75,  'Gutters'),
  seed('Gutter cleaning — semi-detached',   110,  'Gutters'),
  seed('Gutter cleaning — detached',        160,  'Gutters'),

  // ── Commercial (COMMERCIAL_* constants) ──────────────────────────────
  seed('Commercial cleaning — regular contract (per hour)', 27.5, 'Commercial', 'Minimum 2 hours (£55) per visit.'),
  seed('Commercial cleaning — one-off deep (per hour)',     35,   'Commercial', 'Minimum 6 hours (£210) per visit.'),
  seed('Commercial — shop / café clean',                    65,   'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial — communal area clean',                  75,   'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial end of lease clean',                    299,   'Commercial', 'From price; confirmed by photo.'),
  seed('Commercial after builders clean',                  349,   'Commercial', 'From price; confirmed by photo.'),
];
