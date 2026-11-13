import { validateWebsitePricebook } from '../../shared/pricingCatalogue.js';
import buildSnapshot from '../../shared/publishedPricebookSnapshot.js';

export interface WebsitePricebookSnapshot {
  id: string;
  version: string;
  overrides: Record<string, unknown>;
  publishedAt?: string | null;
}

export function validatePricebookSnapshot(value: unknown): WebsitePricebookSnapshot {
  if (!value || typeof value !== 'object') throw new Error('The price list response is invalid.');
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : row.version;
  if (typeof id !== 'string' || !id || !row.overrides || typeof row.overrides !== 'object') throw new Error('The price list response is invalid.');
  const validation = validateWebsitePricebook(row.overrides);
  if (!validation.ok) throw new Error('The published price list could not be verified.');
  return { id, version: typeof row.version === 'string' ? row.version : id, overrides: row.overrides as Record<string, unknown>, publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : null };
}

/** How long a page waits for live prices before using the list it was built with. */
export const PRICEBOOK_TIMEOUT_MS = 4000;

/**
 * The published price list for this page view.
 *
 * A public page must never depend on this request succeeding. It used to: one
 * failed or slow call replaced the whole prerendered page — content, prices and
 * contact links — with an error screen.
 *
 * The list this build was made from is always available, and is what the
 * prerendered HTML already shows:
 *  - Managed prices off (`bundled`): the API can only return that same list, so
 *    no request is made at all.
 *  - Managed prices on: the live list is preferred, because a newer version may
 *    have been published since the build. If it cannot be loaded or verified in
 *    time, the build's own published list is used instead.
 *
 * This is safe because the browser's figure is never the price of record. The
 * request endpoint recalculates every total from the current published list and
 * answers `price_changed` when a quote was built on an older version, so the
 * customer reviews the new price before anything is saved.
 */
export async function loadWebsitePricebook(): Promise<WebsitePricebookSnapshot> {
  const built = validatePricebookSnapshot(buildSnapshot);
  if (built.id === 'bundled') return built;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PRICEBOOK_TIMEOUT_MS);
  try {
    const response = await fetch('/api/website-pricebook', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('The current price list is temporarily unavailable.');
    return validatePricebookSnapshot(await response.json());
  } catch {
    return built;
  } finally { window.clearTimeout(timeout); }
}
