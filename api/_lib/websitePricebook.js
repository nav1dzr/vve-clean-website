import { createClient } from '@supabase/supabase-js';
import { createPricingCatalogue } from '../../shared/pricingCatalogue.js';
import PUBLISHED_PRICEBOOK_SNAPSHOT from '../../shared/publishedPricebookSnapshot.js';

export async function loadWebsitePricebook(client = null) {
  if (process.env.WEBSITE_PRICEBOOK_ENABLED !== 'true') {
    const snapshot = PUBLISHED_PRICEBOOK_SNAPSHOT;
    return { ...snapshot, catalogue: createPricingCatalogue(snapshot.overrides || {}) };
  }
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!client && (!url || !key)) throw new Error('Website prices are temporarily unavailable. Please contact the team.');
  const db = client || createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('get_published_website_pricebook');
  if (error || !data || typeof data.version !== 'string' || !data.overrides) throw new Error('Website prices are temporarily unavailable. Please contact the team.');
  return { ...data, catalogue: createPricingCatalogue(data.overrides) };
}
