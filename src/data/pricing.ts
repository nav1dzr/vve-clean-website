// ─── VVE Clean Pricing — thin re-export shim ─────────────────────────────────
//
// DO NOT ADD OR EDIT PRICES IN THIS FILE.
//
// The single canonical pricing source is ../../shared/pricingCatalogue.js —
// plain ESM JavaScript so it can be imported unmodified by the frontend
// (here), the payment-authority server (api/servicePrices.js), and the admin
// CRM (admin/api/_lib/catalogueSeed.js, via a mechanically synced copy — see
// scripts/sync-admin-pricing.mjs). This file exists only so the ~20 existing
// call sites across src/ can keep writing `import { X } from '../data/pricing'`
// unchanged, and to attach TypeScript types to the shared module's values.
//
// To change a price: edit shared/pricingCatalogue.js, then run
// `npm run typecheck && npm test` (root) — tests/api/pricingSource.test.js
// fails loudly if admin's synced copy goes stale.

export * from '../../shared/pricingCatalogue.js';
import {
  calculateEotQuote as _calculateEotQuote,
  calculateMoveInQuote as _calculateMoveInQuote,
} from '../../shared/pricingCatalogue.js';

// Type-only declarations (compile-time only, erased at runtime — not price
// data, so not a "duplicated calculation logic" concern). Mirrors the JSDoc
// @typedef comments of the same name in pricingCatalogue.js; kept here as
// plain TS because importing types back out of a JSDoc-annotated .js module
// without `checkJs` is unreliable across TS versions.
export type SizeKey = 'studio' | 'bed1' | 'bed2' | 'bed3' | 'bed4';
export type PricingMode = 'fixed' | 'from' | 'quote_required';
export type ServiceStartingPriceKey =
  | 'eot_complete' | 'eot_tailored' | 'move_in' | 'after_builders'
  | 'carpet' | 'upholstery' | 'window' | 'garden' | 'pressure_washing'
  | 'commercial' | 'commercial_carpet';

export interface EotQuoteInput {
  size:            SizeKey;
  package:         'complete' | 'tailored';
  isHouse:         boolean;
  extraBathrooms:  number;
  extraWcs:        number;
  tailoredAddOns?: {
    fridgeFreezerInside?:  boolean;
    extraFridgeFreezers?:  number;
    dishwasherInside?:     boolean;
    washingMachineInside?: boolean;
    cupboards?:            boolean;
  };
  rooms?:          { id: string; addonKey: string; floor: string; stairFlights?: number }[];
  carpetRoomIds?:  string[];
}

export interface EotCarpetPackageResult {
  standaloneSubtotalP: number;
  itemCount:           number;
  eligible:            boolean;
  chargedP:            number;
  savingP:             number;
}

export interface EotQuoteResult {
  basePriceP:          number;
  houseAdjP:            number;
  bathroomsAddP:        number;
  wcsAddP:              number;
  tailoredAddOnsP:      number;
  carpetAddonP:         number;
  carpetPackage:        EotCarpetPackageResult;
  totalP:               number;
  guaranteeHours:       number;
  guaranteeScope:       'complete' | 'selected-tasks';
  shouldOfferComplete:  boolean;
  completeEquivalentP:  number;
}

/** Typed wrapper — runtime implementation lives in shared/pricingCatalogue.js. */
export function calculateEotQuote(input: EotQuoteInput): EotQuoteResult {
  return _calculateEotQuote(input) as EotQuoteResult;
}

export interface MoveInQuoteInput {
  size:           SizeKey;
  extraBathrooms: number;
  extraWcs:       number;
}
export interface MoveInQuoteResult {
  basePriceP:    number;
  bathroomsAddP: number;
  wcsAddP:       number;
  totalP:        number;
}

/** Typed wrapper — runtime implementation lives in shared/pricingCatalogue.js. */
export function calculateMoveInQuote(input: MoveInQuoteInput): MoveInQuoteResult {
  return _calculateMoveInQuote(input) as MoveInQuoteResult;
}
