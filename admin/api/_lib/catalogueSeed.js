// Explicit, opt-in starter catalogue for the Products & Services feature.
// POSTed only when an admin clicks "Import standard price list" in the CRM
// (admin/api/catalogue.js ?action=seed) — nothing here ever runs
// automatically, and no migration inserts these rows.
//
// DO NOT ADD OR EDIT PRICES IN THIS FILE.
//
// CATALOGUE_SEED_ITEMS is computed directly from the canonical pricing
// source (shared/pricingCatalogue.js at the repository root) via a
// mechanically synced, verified-identical local copy — see
// ./pricingCatalogue.generated.js and scripts/sync-admin-pricing.mjs for why
// admin/ uses a synced copy rather than a direct cross-directory import.

export { CATALOGUE_SEED_ITEMS } from './pricingCatalogue.generated.js';
