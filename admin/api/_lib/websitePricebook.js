import {
  createPricingCatalogue,
  getWebsitePricebookFields,
  validateWebsitePricebook,
  PRICEBOOK_PRICE_KEYS,
} from './pricingCatalogue.generated.js';
import { isHostedPreview } from './previewIsolation.js';

export const PRICEBOOK_VERSIONS_TABLE = 'website_pricebook_versions';
export const PRICEBOOK_PUBLICATIONS_TABLE = 'website_pricebook_publications';

export function validatePricebookDraft(body) {
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > 120) return { ok: false, error: 'Give this price list a name of 1–120 characters.' };
  if (!body.overrides || typeof body.overrides !== 'object' || Array.isArray(body.overrides)) return { ok: false, error: 'Supply a valid price list.' };
  const validation = validateWebsitePricebook(body.overrides);
  if (!validation.ok) return { ok: false, error: validation.errors[0] };
  const catalogue = createPricingCatalogue(body.overrides);
  // Persist every editable amount, including unchanged values, so a later code
  // baseline cannot alter the meaning of an already saved version.
  const overrides = Object.fromEntries(PRICEBOOK_PRICE_KEYS.map(key => [key, structuredClone(catalogue[key])]));
  return { ok: true, value: { label, overrides } };
}

/** Representative totals are calculated by the same engine used to accept requests. */
export function previewWebsitePricebook(overrides = {}) {
  const catalogue = createPricingCatalogue(overrides);
  const carpet = catalogue.computeCarpetPrice({ bedroom: 2 }, 'normal');
  const sofa = catalogue.computeCarpetPrice({ sofa_2: 1 }, 'normal');
  const complete = catalogue.calculateEotQuote({ size: 'bed1', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
  const tailored = catalogue.calculateEotQuote({ size: 'bed1', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
  return {
    fields: getWebsitePricebookFields(overrides),
    examples: [
      { label: 'Two bedroom carpets', pence: Math.round(carpet.finalTotal * 100) },
      { label: 'One 2-seater sofa, including minimum', pence: Math.round(sofa.finalTotal * 100) },
      { label: '1-bedroom flat · Complete EOT', pence: complete.totalP },
      { label: '1-bedroom flat · Tailored EOT', pence: tailored.totalP },
    ],
  };
}

export function pricebookRefreshConfigured(env = process.env) {
  if (isHostedPreview(env) && (!env.VVE_PREVIEW_PRICEBOOK_REFRESH_URL || env.VVE_PREVIEW_PRICEBOOK_REFRESH_URL !== env.WEBSITE_PRICEBOOK_REFRESH_URL)) return false;
  return env.WEBSITE_PRICEBOOK_ENABLED === 'true' && typeof env.WEBSITE_PRICEBOOK_REFRESH_URL === 'string' && /^https:\/\//.test(env.WEBSITE_PRICEBOOK_REFRESH_URL);
}

export async function requestPricebookRefresh(publicationId, supabase, env = process.env) {
  if (!pricebookRefreshConfigured(env)) return { status: 'failed', recorded: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let status = 'failed';
  try {
    const response = await fetch(env.WEBSITE_PRICEBOOK_REFRESH_URL, { method: 'POST', signal: controller.signal });
    if (response.ok) status = 'requested';
  } catch { /* Publication is recorded; a failed build request can be retried. */ }
  finally { clearTimeout(timer); }
  const { error } = await supabase.from(PRICEBOOK_PUBLICATIONS_TABLE).update({ refresh_status: status }).eq('id', publicationId);
  return { status, recorded: !error };
}
