// Static content for the premium EOT quote.
//
// Kept out of the component modules so those files export components only —
// otherwise every import triggers a react-refresh/only-export-components lint
// warning and breaks Fast Refresh during development.

export const QUOTE_STEPS = ['Property', 'Bathrooms', 'Upgrades', 'Review', 'Book'] as const;

/** Short, checkable promises shown beside the live price. */
export const WHAT_YOU_GET = [
  '67-point inventory-standard clean',
  '48-hour free re-clean if your agent flags anything',
  'Photographic cleaning receipt on completion',
  'All products and equipment included',
] as const;

export const INCLUDED_ITEMS = [
  'Oven, hob, grill and extractor',
  'Inside an emptied fridge and defrosted freezer',
  'Dishwasher and washing-machine accessible compartments',
  'Cupboards, drawers and wardrobes inside and outside',
  'Internal windows, frames and sills',
  'Kitchen and bathroom descaling',
  'Skirting, doors, handles, switches and sockets',
  'Vacuuming, mopping, products and equipment',
] as const;

export const WA_BASE = 'https://wa.me/447845451111';

export const DEPOSIT_REASSURANCE =
  '£30 secures your preferred date and is included in your total';

/**
 * Rooms covered by the base package.
 *
 * Only rooms explicitly named by the canonical scope statement in
 * EndOfTenancyPage (`pricingIntro`) appear here: "The base price covers one
 * kitchen, one living/reception room and one bathroom". Bedrooms follow from
 * the selected size tier.
 *
 * A flat's HALLWAY is deliberately NOT claimed. Hallways appear in the pricing
 * source only as part of the house/maisonette adjustment and as a paid carpet
 * add-on, so claiming them for a flat would not be supported. Do not add it
 * here unless the canonical scope is updated and the owner confirms it.
 */
export const SCOPE_REASSURANCE =
  'Your complete clean covers the kitchen, living/reception room, bathroom and every bedroom — in a normally maintained, vacant property.';
