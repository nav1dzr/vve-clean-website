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

export async function loadWebsitePricebook(): Promise<WebsitePricebookSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/website-pricebook', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('The current price list is temporarily unavailable.');
    return validatePricebookSnapshot(await response.json());
  } catch (error) {
    // A plain Vite preview has no API. Production never silently substitutes old prices.
    if (import.meta.env.DEV) return validatePricebookSnapshot(buildSnapshot);
    throw error;
  } finally { window.clearTimeout(timeout); }
}
