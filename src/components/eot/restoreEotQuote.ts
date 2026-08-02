// Rebuilds End of Tenancy quote selections from a booking the customer already
// started, so "Back to quote" on BookingPage reopens the premium journey where
// they left it rather than an empty form.
//
// Reads only. It never prices anything: every figure still comes from
// computeEotQuote once the restored selections are back in useEotQuote. Each
// field is validated independently and dropped if it does not fit the premium
// quote's shape, so a stale or hand-edited payload degrades to a blank quote
// instead of throwing or silently mispricing.

import { EOT_SIZES, type EotPropertyType, type EotSizeKey } from '../../lib/eotPricing';
import type { EotQuoteState } from './useEotQuote';
import type { BookingSelection } from '../QuoteCalculator';

type QuoteConfig = NonNullable<BookingSelection['quoteConfig']>;

/** Marks a stored quote as one the premium End of Tenancy UI should reopen. */
export function isEotQuoteConfig(config: QuoteConfig | null | undefined): boolean {
  return config?.deepService === 'end_of_tenancy';
}

/**
 * Reads the pending "Back to quote" payload without consuming the flag.
 * Returns null unless BookingPage actually set the flag and the stored quote is
 * an End of Tenancy one.
 */
export function peekEotRestore(): QuoteConfig | null {
  try {
    if (!sessionStorage.getItem('vve_restore_quote')) return null;
    const raw = sessionStorage.getItem('vve_booking');
    if (!raw) return null;
    const config = (JSON.parse(raw) as BookingSelection).quoteConfig ?? null;
    return isEotQuoteConfig(config) ? config : null;
  } catch {
    return null;
  }
}

/** Maps a stored quoteConfig onto the premium quote's state shape. */
export function eotStateFromConfig(config: QuoteConfig): Partial<EotQuoteState> {
  const restored: Partial<EotQuoteState> = {};

  if (config.propertyType === 'flat' || config.propertyType === 'house') {
    restored.propertyType = config.propertyType as EotPropertyType;
  }

  // Only sizes the premium quote actually offers. bed5 is the tailored bucket
  // and is never bookable, so it can never appear in a stored booking, but
  // checking membership keeps an unexpected value from selecting nothing.
  const size = config.deepSize as EotSizeKey | undefined;
  if (size && EOT_SIZES.some((s) => s.key === size)) restored.size = size;

  const baths = config.deepBaths;
  if (typeof baths === 'number' && Number.isFinite(baths) && baths >= 1) {
    restored.bathrooms = baths;
  }

  // carpet_bundle is a flag in the premium UI, not a counted upgrade, so it is
  // lifted out of addOnCounts rather than restored as a line item.
  if (config.addOnCounts && typeof config.addOnCounts === 'object') {
    const { carpet_bundle: bundle, ...counts } = config.addOnCounts;
    restored.counts = Object.fromEntries(
      Object.entries(counts).filter(([, qty]) => typeof qty === 'number' && qty > 0),
    );
    restored.carpetWholeHome = typeof bundle === 'number' && bundle > 0;
  }

  if (Array.isArray(config.eotScopeExclusions)) {
    restored.scopeExclusions = config.eotScopeExclusions.filter((k) => typeof k === 'string');
  }

  return restored;
}
