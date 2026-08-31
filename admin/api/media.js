import { randomUUID } from 'node:crypto';
import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';
import { readJsonBody } from './_lib/body.js';
import { getServiceClient } from './_lib/supabaseAdmin.js';
import { createR2Key, createUploadUrl, getMediaConfig } from './_lib/mediaConfig.js';
import { toMediaSummary, validateNewAsset } from './_lib/mediaFields.js';
import mediaAssetHandler from './_lib/mediaAssetActions.js';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 16 * 1024;

async function collectionHandler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }
  if (!['GET', 'POST'].includes(req.method)) {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }
  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }
  try {
    if (req.method === 'GET') return await listMedia(res, headers, supabase);
    return await createUploadPlan(req, res, headers, supabase, auth.admin.id);
  } catch (error) {
    console.error('[admin/media] index route failed:', error?.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not complete that media request.' }));
  }
}

// Kept as one Vercel function so the existing Hobby-plan CRM project remains
// under its function limit. The ID stays explicit and validated by the item
// handler; it is never used to build a filesystem path or database query.
export default function handler(req, res) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  return id ? mediaAssetHandler(req, res) : collectionHandler(req, res);
}

async function listMedia(res, headers, supabase) {
  const [{ data: assets, error: assetsError }, { data: slots, error: slotsError }] = await Promise.all([
    supabase.from('media_assets').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('media_slots').select('slot_key, label, asset_id').order('slot_key'),
  ]);
  if (assetsError || slotsError) {
    console.error('[admin/media] list failed:', assetsError?.code || slotsError?.code);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not load the media library.' }));
  }
  const slotMap = new Map((slots || []).filter((slot) => slot.asset_id).map((slot) => [slot.asset_id, slot.slot_key]));
  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    assets: (assets || []).map((asset) => toMediaSummary(asset, slotMap)),
    slots: (slots || []).map((slot) => ({ key: slot.slot_key, label: slot.label, assetId: slot.asset_id })),
  }));
}

async function createUploadPlan(req, res, headers, supabase, adminId) {
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'The upload details were invalid.' }));
  }
  const parsed = validateNewAsset(body);
  if (!parsed.ok) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: parsed.error }));
  }
  const mediaConfig = getMediaConfig();
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(JSON.stringify({ error: 'Media hosting is not configured yet. Add the media environment variables first.' }));
  }
  const assetId = randomUUID();
  const r2Key = createR2Key(assetId, parsed.value.filename);
  const { error } = await supabase.from('media_assets').insert({
    id: assetId,
    media_type: parsed.value.mediaType,
    original_filename: parsed.value.filename,
    original_content_type: parsed.value.contentType,
    original_size_bytes: parsed.value.size,
    r2_key: r2Key,
    title: parsed.value.title,
    alt_text: parsed.value.altText,
    service: parsed.value.service,
    category: parsed.value.category,
    before_after: parsed.value.beforeAfter,
    pair_key: parsed.value.pairKey,
    location_label: parsed.value.locationLabel,
    website_visible: parsed.value.websiteVisible,
    google_enabled: parsed.value.googleEnabled,
    social_enabled: parsed.value.socialEnabled,
    requested_slot_key: parsed.value.requestedSlotKey,
    created_by: adminId,
  });
  if (error) {
    console.error('[admin/media] asset create failed:', error.code, error.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not create the media record.' }));
  }
  const uploadUrl = await createUploadUrl(mediaConfig, r2Key, parsed.value.contentType);
  res.writeHead(201, headers);
  return res.end(JSON.stringify({ id: assetId, uploadUrl, expiresInSeconds: 900 }));
}
