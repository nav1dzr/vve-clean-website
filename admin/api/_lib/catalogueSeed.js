// Explicit, opt-in starter catalogue for the Products & Services feature.
// Nothing here runs automatically: an admin must click "Import standard price
// list" in the CRM. Every value is read from the shared canonical catalogue;
// this file owns only catalogue names, categories and descriptions.
import {
  ADDON_PRICES_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  CARPET_ITEM_PRICES_P,
  COMMERCIAL_AFTER_BUILDERS_FROM_P,
  COMMERCIAL_COMMUNAL_FROM_P,
  COMMERCIAL_EOL_FROM_P,
  COMMERCIAL_ONCEOFF_HOURLY_P,
  COMMERCIAL_ONCEOFF_MIN_CHARGE_P,
  COMMERCIAL_ONCEOFF_MIN_HOURS,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_REGULAR_MIN_HOURS,
  COMMERCIAL_SHOP_CAFE_FROM_P,
  CONGESTION_CHARGE_P,
  EOT_BASE_PRICES_P,
  EOT_CARPET_ADDON_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_HOUSE_ADJUSTMENT_P,
  GUTTER_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  PARKING_ESTIMATE_P,
  STAIRS_EXTRA_P,
  STAIRS_FIRST_P,
  WINDOW_PRICES_P,
} from '../../shared/pricingCatalogue.js';

const seed = (name, defaultPricePence, category, description = null) => ({
  name,
  description,
  default_price_pence: defaultPricePence,
  item_type: 'service',
  category,
});

const pounds = (pence) => pence / 100;

export const CATALOGUE_SEED_ITEMS = [
  seed('End of tenancy clean — studio', EOT_BASE_PRICES_P.studio, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 1 bedroom', EOT_BASE_PRICES_P.bed1, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 2 bedroom', EOT_BASE_PRICES_P.bed2, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 3 bedroom', EOT_BASE_PRICES_P.bed3, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('End of tenancy clean — 4 bedroom', EOT_BASE_PRICES_P.bed4, 'End of tenancy', 'Complete fixed-price package. Appliances, cupboards and internal windows included. 1 bathroom.'),
  seed('EOT — additional full bathroom', EOT_EXTRA_BATH_P, 'End of tenancy', 'Per extra bathroom beyond the first.'),
  seed('EOT — additional WC', EOT_EXTRA_WC_P, 'End of tenancy', 'Per additional WC / half bathroom.'),
  seed('EOT — house/maisonette adjustment', EOT_HOUSE_ADJUSTMENT_P, 'End of tenancy', 'Covers normal additional hallways, landing, internal staircase cleaning and movement between floors. Stair carpet steam cleaning remains a separate upgrade.'),

  seed('Move-in clean — studio', MOVEIN_BASE_PRICES_P.studio, 'Move-in / move-out'),
  seed('Move-in clean — 1 bedroom', MOVEIN_BASE_PRICES_P.bed1, 'Move-in / move-out'),
  seed('Move-in clean — 2 bedroom', MOVEIN_BASE_PRICES_P.bed2, 'Move-in / move-out'),
  seed('Move-in clean — 3 bedroom', MOVEIN_BASE_PRICES_P.bed3, 'Move-in / move-out'),
  seed('Move-in clean — 4 bedroom', MOVEIN_BASE_PRICES_P.bed4, 'Move-in / move-out'),
  seed('Move-in — additional bathroom', MOVEIN_EXTRA_BATH_P, 'Move-in / move-out', 'Per extra bathroom beyond the first.'),

  seed('After builders clean — small area', AFTER_BUILDERS_FROM_PRICES_P.small, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — studio', AFTER_BUILDERS_FROM_PRICES_P.studio, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 1 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed1, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 2 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed2, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 3 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed3, 'After builders', 'Estimated by photo before work starts.'),
  seed('After builders clean — 4 bedroom', AFTER_BUILDERS_FROM_PRICES_P.bed4, 'After builders', 'Estimated by photo before work starts.'),

  seed('EOT carpet add-on — bedroom', EOT_CARPET_ADDON_PRICES_P.bedroom, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — living room', EOT_CARPET_ADDON_PRICES_P.living_room, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — large lounge', EOT_CARPET_ADDON_PRICES_P.large_lounge, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — hallway', EOT_CARPET_ADDON_PRICES_P.hallway, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — landing', EOT_CARPET_ADDON_PRICES_P.landing, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — stairs (first)', EOT_CARPET_ADDON_PRICES_P.stairs_first, 'EOT carpet add-ons', 'Reduced rate when added to an EOT clean.'),
  seed('EOT carpet add-on — stairs (extra)', EOT_CARPET_ADDON_PRICES_P.stairs_extra, 'EOT carpet add-ons', 'Per additional flight beyond the first.'),

  seed('Bedroom carpet clean', CARPET_ITEM_PRICES_P.bedroom, 'Carpets'),
  seed('Living / dining room carpet clean', CARPET_ITEM_PRICES_P.living_room, 'Carpets'),
  seed('Large or through lounge carpet clean', CARPET_ITEM_PRICES_P.large_lounge, 'Carpets'),
  seed('Hallway carpet clean', CARPET_ITEM_PRICES_P.hallway, 'Carpets'),
  seed('Landing carpet clean', CARPET_ITEM_PRICES_P.landing, 'Carpets'),
  seed('Stairs carpet clean — first flight', STAIRS_FIRST_P, 'Carpets'),
  seed('Stairs carpet clean — each additional', STAIRS_EXTRA_P, 'Carpets'),
  seed('Rug clean (standard)', CARPET_ITEM_PRICES_P.rug, 'Carpets', 'Large or wool rugs need a photo quote first.'),

  seed('Armchair clean', CARPET_ITEM_PRICES_P.armchair, 'Upholstery'),
  seed('2-seater sofa clean', CARPET_ITEM_PRICES_P.sofa_2, 'Upholstery'),
  seed('3-seater sofa clean', CARPET_ITEM_PRICES_P.sofa_3, 'Upholstery'),
  seed('Corner / L-shaped sofa clean', CARPET_ITEM_PRICES_P.sofa_corner, 'Upholstery'),
  seed('Mattress clean (single)', CARPET_ITEM_PRICES_P.mattress_single, 'Upholstery'),
  seed('Mattress clean (double/king)', CARPET_ITEM_PRICES_P.mattress_double, 'Upholstery'),

  seed('Oven clean (standalone)', ADDON_PRICES_P.oven, 'Add-ons', 'Free when booked with an end of tenancy clean.'),
  seed('Fridge/freezer clean (add-on)', ADDON_PRICES_P.fridge, 'Add-ons'),
  seed('External windows (add-on)', ADDON_PRICES_P.ext_windows, 'Add-ons'),
  seed('Wall marks / spot cleaning (add-on)', ADDON_PRICES_P.wall_marks, 'Add-ons'),
  seed('Key collection / drop-off (add-on)', ADDON_PRICES_P.key_collect, 'Add-ons'),
  seed('Rubbish removal (add-on)', ADDON_PRICES_P.rubbish, 'Add-ons'),
  seed('Internal staircase (add-on)', EOT_CARPET_ADDON_PRICES_P.stairs_first, 'Add-ons', `First staircase; additional flights £${pounds(EOT_CARPET_ADDON_PRICES_P.stairs_extra)} each.`),

  seed('Window cleaning — small property', WINDOW_PRICES_P.small, 'Windows'),
  seed('Window cleaning — medium property', WINDOW_PRICES_P.medium, 'Windows'),
  seed('Window cleaning — large property', WINDOW_PRICES_P.large, 'Windows'),
  seed('Gutter cleaning — terraced', GUTTER_PRICES_P.terraced, 'Gutters'),
  seed('Gutter cleaning — semi-detached', GUTTER_PRICES_P.semi_detached, 'Gutters'),
  seed('Gutter cleaning — detached', GUTTER_PRICES_P.detached, 'Gutters'),

  seed('Parking allowance (estimated)', PARKING_ESTIMATE_P, 'Access charges', 'Charged at actual cost. Adjusted on the final balance if it costs less or more.'),
  seed('Congestion Charge (pass-through)', CONGESTION_CHARGE_P, 'Access charges', 'Pass-through of the Congestion Charge — never a cleaning-service fee.'),

  seed('Commercial cleaning — regular contract (per hour)', COMMERCIAL_REGULAR_HOURLY_P, 'Commercial', `Minimum ${COMMERCIAL_REGULAR_MIN_HOURS} hours (£${pounds(COMMERCIAL_REGULAR_MIN_CHARGE_P)}) per visit.`),
  seed('Commercial cleaning — one-off deep (per hour)', COMMERCIAL_ONCEOFF_HOURLY_P, 'Commercial', `Minimum ${COMMERCIAL_ONCEOFF_MIN_HOURS} hours (£${pounds(COMMERCIAL_ONCEOFF_MIN_CHARGE_P)}) per visit.`),
  seed('Commercial — shop / café clean', COMMERCIAL_SHOP_CAFE_FROM_P, 'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial — communal area clean', COMMERCIAL_COMMUNAL_FROM_P, 'Commercial', 'From price; confirmed on site visit.'),
  seed('Commercial end of lease clean', COMMERCIAL_EOL_FROM_P, 'Commercial', 'From price; confirmed by photo.'),
  seed('Commercial after builders clean', COMMERCIAL_AFTER_BUILDERS_FROM_P, 'Commercial', 'From price; confirmed by photo.'),
];
