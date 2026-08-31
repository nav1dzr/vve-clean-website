import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { readJsonBody } from '../_lib/body.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { createDownloadUrl, getMediaConfig, muxAuthHeader } from '../_lib/mediaConfig.js';
import { normaliseMetadata, toMediaSummary } from '../_lib/mediaFields.js';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 16 * 1024;

export default async function handler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }
  if (!['POST', 'PATCH'].includes(req.method)) {
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
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid media item.' }));
  }
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'The request details were invalid.' }));
  }
  try {
    const { data: asset, error } = await supabase.from('media_assets').select('*').eq('id', id).maybeSingle();
    if (error || !asset) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Media item not found.' }));
    }
    if (req.method === 'PATCH') return await updateMetadata(res, headers, supabase, asset, body, auth.admin.id);
    if (body.action === 'complete') return await completeUpload(res, headers, supabase, asset, auth.admin.id);
    if (body.action === 'sync') return await syncVideo(res, headers, supabase, asset, auth.admin.id);
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Unknown media action.' }));
  } catch (error) {
    console.error('[admin/media] item route failed:', error?.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not update that media item.' }));
  }
}

async function updateMetadata(res, headers, supabase, asset, body, adminId) {
  const fields = normaliseMetadata(body);
  const { data: updated, error } = await supabase.from('media_assets').update({
    title: fields.title, alt_text: fields.altText, service: fields.service, category: fields.category,
    before_after: fields.beforeAfter, pair_key: fields.pairKey, location_label: fields.locationLabel,
    website_visible: fields.websiteVisible, google_enabled: fields.googleEnabled, social_enabled: fields.socialEnabled,
    requested_slot_key: fields.requestedSlotKey, updated_at: new Date().toISOString(),
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  if (updated.status === 'ready' && fields.requestedSlotKey) await assignSlot(supabase, fields.requestedSlotKey, updated.id, adminId);
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, new Map()) }));
}

async function completeUpload(res, headers, supabase, asset, adminId) {
  if (asset.status !== 'uploading') {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'This upload has already been handed off for processing.' }));
  }
  const mediaConfig = getMediaConfig();
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(JSON.stringify({ error: 'Media hosting is not configured yet.' }));
  }
  const sourceUrl = await createDownloadUrl(mediaConfig, asset.r2_key);
  if (asset.media_type === 'image') {
    const form = new FormData();
    form.set('url', sourceUrl);
    form.set('requireSignedURLs', 'false');
    form.set('metadata', JSON.stringify({ vveAssetId: asset.id }));
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${mediaConfig.accountId}/images/v1`, {
      method: 'POST', headers: { Authorization: `Bearer ${mediaConfig.cloudflareToken}` }, body: form,
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.result?.id) {
      await markFailed(supabase, asset.id, 'Cloudflare Images could not process this photo.');
      res.writeHead(422, headers);
      return res.end(JSON.stringify({ error: 'Cloudflare Images could not process this photo. Try a JPEG, PNG, WebP or AVIF file.' }));
    }
    const { data: updated, error } = await supabase.from('media_assets').update({
      status: 'ready', cloudflare_image_id: payload.result.id,
      delivery_url: `https://imagedelivery.net/${mediaConfig.imagesDeliveryHash}/${payload.result.id}/public`,
      ready_at: new Date().toISOString(), updated_at: new Date().toISOString(), processing_error: '',
    }).eq('id', asset.id).select('*').single();
    if (error) throw error;
    if (updated.requested_slot_key) await assignSlot(supabase, updated.requested_slot_key, updated.id, adminId);
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ asset: toMediaSummary(updated, new Map()) }));
  }

  const response = await fetch('https://api.mux.com/video/v1/assets', {
    method: 'POST',
    headers: { Authorization: muxAuthHeader(mediaConfig), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: [{ url: sourceUrl }],
      playback_policies: ['public'],
      video_quality: 'plus',
      passthrough: asset.id,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.data?.id) {
    await markFailed(supabase, asset.id, 'Mux could not start processing this video.');
    res.writeHead(422, headers);
    return res.end(JSON.stringify({ error: 'Mux could not start processing this video. Check the video format and try again.' }));
  }
  const { data: updated, error } = await supabase.from('media_assets').update({
    status: 'processing', mux_asset_id: payload.data.id, updated_at: new Date().toISOString(), processing_error: '',
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  res.writeHead(202, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, new Map()) }));
}

async function syncVideo(res, headers, supabase, asset, adminId) {
  if (asset.media_type !== 'video' || asset.status !== 'processing' || !asset.mux_asset_id) {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'This item is not waiting for video processing.' }));
  }
  const mediaConfig = getMediaConfig();
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(JSON.stringify({ error: 'Media hosting is not configured yet.' }));
  }
  const response = await fetch(`https://api.mux.com/video/v1/assets/${asset.mux_asset_id}`, {
    headers: { Authorization: muxAuthHeader(mediaConfig) },
  });
  const payload = await response.json();
  if (!response.ok || !payload.data) throw new Error('Mux asset lookup failed');
  if (payload.data.status === 'errored') {
    await markFailed(supabase, asset.id, 'Mux could not process this video.');
    res.writeHead(422, headers);
    return res.end(JSON.stringify({ error: 'Mux could not process this video. The original remains safely stored in R2.' }));
  }
  if (payload.data.status !== 'ready') {
    res.writeHead(202, headers);
    return res.end(JSON.stringify({ status: 'processing' }));
  }
  const playbackId = payload.data.playback_ids?.find((entry) => entry.policy === 'public')?.id;
  if (!playbackId) throw new Error('Mux ready asset has no public playback ID');
  const { data: updated, error } = await supabase.from('media_assets').update({
    status: 'ready', mux_playback_id: playbackId, ready_at: new Date().toISOString(), updated_at: new Date().toISOString(), processing_error: '',
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  if (updated.requested_slot_key) await assignSlot(supabase, updated.requested_slot_key, updated.id, adminId);
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, new Map()) }));
}

async function assignSlot(supabase, slotKey, assetId, adminId) {
  const { data: current, error: readError } = await supabase.from('media_slots').select('asset_id').eq('slot_key', slotKey).single();
  if (readError) throw readError;
  const { error: slotError } = await supabase.from('media_slots').update({ asset_id: assetId, updated_at: new Date().toISOString(), updated_by: adminId }).eq('slot_key', slotKey);
  if (slotError) throw slotError;
  if (current.asset_id && current.asset_id !== assetId) {
    const { error: linkError } = await supabase.from('media_assets').update({ replaced_by_asset_id: assetId, updated_at: new Date().toISOString() }).eq('id', current.asset_id);
    if (linkError) throw linkError;
  }
}

async function markFailed(supabase, assetId, message) {
  const { error } = await supabase.from('media_assets').update({ status: 'failed', processing_error: message, updated_at: new Date().toISOString() }).eq('id', assetId);
  if (error) console.error('[admin/media] failed status write failed:', error.code);
}
