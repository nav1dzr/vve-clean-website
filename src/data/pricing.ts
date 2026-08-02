// VVE Clean pricing facade for the public TypeScript application.
//
// ALL approved monetary values now live in one cross-runtime catalogue:
//   admin/shared/pricingCatalogue.js
//
// This file intentionally contains no price literals. It provides typed
// re-exports plus the small calculation/display helpers used by the website.
// The checkout API and CRM catalogue import the same JavaScript catalogue
// directly, so a price change no longer requires hand-maintained mirrors.

import {
  CARPET_MIN_BOOKING_P,
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  CARPET_BUNDLE_TIERS,
  EOT_BASE_PRICES_P,
  EOT_TAILORED_QUOTE_SIZE,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_EXTRA_AREAS_P,
  EOT_SCOPE_CREDITS_P,
  EOT_SCOPE_CREDIT_MAX_P,
  EOT_SCOPE_CREDIT_MAX_PERCENT,
  EOT_CARPET_ADDON_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_HOURS,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_ONCEOFF_HOURLY_P,
  COMMERCIAL_ONCEOFF_MIN_HOURS,
  COMMERCIAL_ONCEOFF_MIN_CHARGE_P,
  COMMERCIAL_SHOP_CAFE_FROM_P,
  COMMERCIAL_COMMUNAL_FROM_P,
  COMMERCIAL_CARPET_PER_SQM_P,
  COMMERCIAL_CARPET_MIN_P,
  COMMERCIAL_EOL_FROM_P,
  COMMERCIAL_AFTER_BUILDERS_FROM_P,
  ADDON_PRICES_P,
  EOT_CARPET_BUNDLE_P,
  DEPOSIT_P,
  PARKING_ESTIMATE_P,
  CONGESTION_CHARGE_P,
  LEGACY_CARPET_BASE_PRICES_P,
  LEGACY_DEEP_ADDON_PRICES_P,
  WINDOW_PRICES_P,
  GUTTER_PRICES_P,
  GENERAL_MIN_BOOKING_P,
} from '../../admin/shared/pricingCatalogue.js';

export {
  CARPET_MIN_BOOKING_P,
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  CARPET_BUNDLE_TIERS,
  EOT_BASE_PRICES_P,
  EOT_TAILORED_QUOTE_SIZE,
  EOT_HOUSE_ADJUSTMENT_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_EXTRA_AREAS_P,
  EOT_SCOPE_CREDITS_P,
  EOT_SCOPE_CREDIT_MAX_P,
  EOT_SCOPE_CREDIT_MAX_PERCENT,
  EOT_CARPET_ADDON_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_HOURS,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_ONCEOFF_HOURLY_P,
  COMMERCIAL_ONCEOFF_MIN_HOURS,
  COMMERCIAL_ONCEOFF_MIN_CHARGE_P,
  COMMERCIAL_SHOP_CAFE_FROM_P,
  COMMERCIAL_COMMUNAL_FROM_P,
  COMMERCIAL_CARPET_PER_SQM_P,
  COMMERCIAL_CARPET_MIN_P,
  COMMERCIAL_EOL_FROM_P,
  COMMERCIAL_AFTER_BUILDERS_FROM_P,
  ADDON_PRICES_P,
  EOT_CARPET_BUNDLE_P,
  DEPOSIT_P,
  PARKING_ESTIMATE_P,
  CONGESTION_CHARGE_P,
  LEGACY_CARPET_BASE_PRICES_P,
  LEGACY_DEEP_ADDON_PRICES_P,
  WINDOW_PRICES_P,
  GUTTER_PRICES_P,
  GENERAL_MIN_BOOKING_P,
};

export type { BundleTier } from '../../admin/shared/pricingCatalogue.js';

export function stairsLinePricePence(flights: number): number {
  if (flights <= 0) return 0;
  return STAIRS_FIRST_P + (flights - 1) * STAIRS_EXTRA_P;
}

export function eotScopeCreditPence(
  basePricePence: number,
  excludedItems: string[] = [],
): number {
  const uniqueItems = [...new Set(excludedItems)];
  const requested = uniqueItems.reduce(
    (sum, key) => sum + (EOT_SCOPE_CREDITS_P[key] ?? 0),
    0,
  );
  const percentageCap = Math.floor(
    (basePricePence * EOT_SCOPE_CREDIT_MAX_PERCENT) / 100 / 100,
  ) * 100;
  return Math.min(requested, EOT_SCOPE_CREDIT_MAX_P, percentageCap);
}

export const PARKING_CHARGED_AT_ACTUAL_COST_NOTE =
  'Parking is charged at the actual cost. The final balance will be adjusted if it costs less or more.';

export const SAME_DAY_POLICY_SHORT =
  'Same-day and next-day appointments may be available at the normal price. Contact us to check availability.';

export function penceToDisplay(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}
