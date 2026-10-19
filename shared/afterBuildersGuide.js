/**
 * Public, non-binding budget ranges. The user explicitly approved these exact
 * twelve ranges with "Approve these exact guide ranges" on 14 October 2026.
 * Display only: never use for booking totals, invoices or checkout.
 * Historical/runtime prices remain in pricingCatalogue.js.
 * Reference: https://afterbuilderscleaning.com/blog/after-builders-cleaning-cost-london/
 */

/** @typedef {{ minP: number, maxP: number, openEnded?: boolean }} BuildersRange */
/** @typedef {'light' | 'standard' | 'deep'} BuildersLevel */

export const BUILDERS_GUIDE_HREF = '/after-builders-cleaning-london#builders-prices';
export const BUILDERS_QUOTE_HREF = '/after-builders-cleaning-london#builders-quote';
export const BUILDERS_GUIDE_NOTICE = 'Indicative budget ranges, not a fixed price or checkout total. We assess the selected rooms, condition, finishes and access, then agree the cleaning list and final written quote before booking.';

/** @type {ReadonlyArray<{ key: BuildersLevel, label: string, description: string }>} */
export const BUILDERS_LEVELS = [
  { key: 'light', label: 'Light clean', description: 'For lighter settled dust after limited works. We assess the rooms and tasks required.' },
  { key: 'standard', label: 'Standard clean', description: 'For a more detailed post-work clean of the agreed rooms and reachable surfaces.' },
  { key: 'deep', label: 'Deep sparkle clean', description: 'For more detailed finishing work before move-in or handover. Extra visits and specialist tasks are agreed separately.' },
];

/** @type {ReadonlyArray<{ key: string, label: string, note: string, light: BuildersRange, standard: BuildersRange, deep: BuildersRange }>} */
export const BUILDERS_BUDGET_GUIDE = [
  {
    key: 'flat_1_2', label: '1–2 bedroom flat',
    note: 'The size, bathrooms and extent of the works affect your assessed quote.',
    light: { minP: 30000, maxP: 45000 },
    standard: { minP: 45000, maxP: 65000 },
    deep: { minP: 65000, maxP: 90000 },
  },
  {
    key: 'house_3_4', label: '3–4 bedroom house',
    note: 'Include stairs, extra living areas and any rooms affected by spreading dust.',
    light: { minP: 50000, maxP: 75000 },
    standard: { minP: 75000, maxP: 110000 },
    deep: { minP: 110000, maxP: 150000 },
  },
  {
    key: 'property_5_plus', label: '5+ bedroom property',
    note: 'Large or complex projects may exceed these guide ranges and need a site assessment.',
    light: { minP: 80000, maxP: 120000 },
    standard: { minP: 120000, maxP: 180000 },
    deep: { minP: 180000, maxP: 250000, openEnded: true },
  },
  {
    key: 'new_build', label: 'New build — per unit',
    note: 'One unit only; size, finish, condition and handover requirements must be assessed.',
    light: { minP: 25000, maxP: 40000 },
    standard: { minP: 40000, maxP: 60000 },
    deep: { minP: 60000, maxP: 85000 },
  },
];

const pounds = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
});

/** @param {BuildersRange} range */
export function formatBuildersRange(range) {
  return `${pounds.format(range.minP / 100)}–${pounds.format(range.maxP / 100)}${range.openEnded ? '+' : ''}`;
}
