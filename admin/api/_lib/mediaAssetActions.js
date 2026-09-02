import { verifyMediaAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { readJsonBody } from '../_lib/body.js';
import { getMediaServiceClient } from '../_lib/supabaseAdmin.js';
import { createDownloadUrl, createImageDeliveryTemplate, getMediaConfig, muxAuthHeader, originalExists } from '../_lib/mediaConfig.js';
import { normaliseMetadata, toMediaSummary } from '../_lib/mediaFields.js';
import {
  MEDIA_ASSETS_TABLE,
  MEDIA_ASSIGNMENTS_TABLE,
  MEDIA_GALLERY_SLOTS_TABLE,
  MEDIA_REFERENCES_TABLE,
  MEDIA_WEBSITE_SLOTS_TABLE,
} from '../_lib/mediaTables.js';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 16 * 1024;

export async function mediaAssetHandler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }
  if (!['POST', 'PATCH'].includes(req.method)) {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const auth = await verifyMediaAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }
  const supabase = getMediaServiceClient();
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
    const { data: asset, error } = await supabase.from(MEDIA_ASSETS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error || !asset) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Media item not found.' }));
    }
    if (req.method === 'PATCH') return await updateMetadata(res, headers, supabase, asset, body);
    if (body.action === 'complete') return await completeUpload(res, headers, supabase, asset);
    if (body.action === 'sync') return await syncVideo(res, headers, supabase, asset);
    if (body.action === 'assign') return await assignMedia(res, headers, supabase, asset, body, auth.admin.id);
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Unknown media action.' }));
  } catch (error) {
    console.error('[admin/media] item route failed:', error?.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not update that media item.' }));
  }
}

async function updateMetadata(res, headers, supabase, asset, body) {
  const fields = normaliseMetadata(body);
  const { data: updated, error } = await supabase.from(MEDIA_ASSETS_TABLE).update({
    title: fields.title, alt_text: fields.altText, service: fields.service, category: fields.category, placement: fields.placement,
    before_after: fields.beforeAfter, pair_key: fields.pairKey, location_label: fields.locationLabel,
    website_visible: fields.websiteVisible, google_enabled: fields.googleEnabled, social_enabled: fields.socialEnabled,
    requested_slot_key: fields.requestedSlotKey, updated_at: new Date().toISOString(),
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
}

async function completeUpload(res, headers, supabase, asset) {
  if (asset.status !== 'uploading') {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'This upload has already been handed off for processing.' }));
  }
  const mediaConfig = getMediaConfig();
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(JSON.stringify({ error: 'Media hosting is not configured yet.' }));
  }
  if (asset.media_type === 'image') {
    if (!await originalExists(mediaConfig, asset.r2_key)) {
      await markFailed(supabase, asset.id, 'The private R2 original was not found after upload.');
      res.writeHead(422, headers);
      return res.end(JSON.stringify({ error: 'The private original was not found after upload. Please upload the photo again.' }));
    }
    const { data: updated, error } = await supabase.from(MEDIA_ASSETS_TABLE).update({
      status: 'ready',
      // The immutable R2 key is reconstructed only inside the Cloudflare
      // Worker. A new upload never overwrites a live image, so a slot swap
      // remains an atomic metadata change and cached old imagery cannot win.
      delivery_url: createImageDeliveryTemplate(mediaConfig, asset.id, asset.r2_key),
      ready_at: new Date().toISOString(), updated_at: new Date().toISOString(), processing_error: '',
    }).eq('id', asset.id).select('*').single();
    if (error) throw error;
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
  }

  const sourceUrl = await createDownloadUrl(mediaConfig, asset.r2_key);
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
  const { data: updated, error } = await supabase.from(MEDIA_ASSETS_TABLE).update({
    status: 'processing', mux_asset_id: payload.data.id, updated_at: new Date().toISOString(), processing_error: '',
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  res.writeHead(202, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
}

async function syncVideo(res, headers, supabase, asset) {
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
  const { data: updated, error } = await supabase.from(MEDIA_ASSETS_TABLE).update({
    status: 'ready', mux_playback_id: playbackId, ready_at: new Date().toISOString(), updated_at: new Date().toISOString(), processing_error: '',
  }).eq('id', asset.id).select('*').single();
  if (error) throw error;
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

async function assignMedia(res, headers, supabase, asset, body, adminId) {
  if (asset.status !== 'ready') {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'Wait until this media has finished processing before assigning it.' }));
  }
  const targetType = body.targetType === 'gallery' || body.targetType === 'website' ? body.targetType : '';
  const targetId = validUuid(body.targetId) ? body.targetId : '';
  if (!targetType || !targetId) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Choose a valid Gallery or Website position.' }));
  }
  const targetTable = targetType === 'gallery' ? MEDIA_GALLERY_SLOTS_TABLE : MEDIA_WEBSITE_SLOTS_TABLE;
  const { data: target, error: targetError } = await supabase.from(targetTable).select('*').eq('id', targetId).maybeSingle();
  if (targetError || !target) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'That media position no longer exists.' }));
  }
  const role = targetType === 'gallery' && target.slot_kind === 'before_after'
    ? (body.role === 'before' || body.role === 'after' ? body.role : '')
    : 'primary';
  if (!role) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Choose whether this is the before or after image.' }));
  }
  if (targetType === 'gallery' && target.slot_kind === 'before_after' && asset.media_type !== 'image') {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Before/after positions accept photos only.' }));
  }
  if (targetType === 'gallery' && target.slot_kind === 'video' && asset.media_type !== 'video') {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Video positions accept videos only.' }));
  }
  if (targetType === 'gallery' && target.slot_kind === 'photo' && asset.media_type !== 'image') {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Grid-photo positions accept photos only.' }));
  }
  const targetColumn = targetType === 'gallery' ? 'gallery_slot_id' : 'website_slot_id';
  const { data: current, error: currentError } = await supabase
    .from(MEDIA_ASSIGNMENTS_TABLE).select('id, asset_id').eq(targetColumn, targetId).eq('media_role', role).maybeSingle();
  if (currentError) throw currentError;
  const { data: references, error: referencesError } = await supabase
    .from(MEDIA_REFERENCES_TABLE).select('reference_key, page_label, component_label').eq(targetColumn, targetId).eq('active', true).order('sort_order');
  if (referencesError) throw referencesError;
  const impact = (references || []).map((reference) => ({ key: reference.reference_key, pageLabel: reference.page_label, componentLabel: reference.component_label }));
  const replacement = current?.asset_id && current.asset_id !== asset.id;
  if (body.preview === true) {
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ preview: true, replacement: Boolean(replacement), impact }));
  }
  if (replacement && body.confirm !== true) {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ requiresConfirmation: true, impact, error: 'Review the pages using this position, then confirm the replacement.' }));
  }
  const now = new Date().toISOString();
  if (current) {
    const { error: updateError } = await supabase.from(MEDIA_ASSIGNMENTS_TABLE)
      .update({ asset_id: asset.id, updated_at: now, updated_by: adminId }).eq('id', current.id);
    if (updateError) throw updateError;
  } else {
    const row = { asset_id: asset.id, media_role: role, updated_at: now, updated_by: adminId, [targetColumn]: targetId };
    const { error: insertError } = await supabase.from(MEDIA_ASSIGNMENTS_TABLE).insert(row);
    if (insertError) throw insertError;
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ assigned: true, replaced: Boolean(replacement), impact }));
}

async function markFailed(supabase, assetId, message) {
  const { error } = await supabase.from(MEDIA_ASSETS_TABLE).update({ status: 'failed', processing_error: message, updated_at: new Date().toISOString() }).eq('id', assetId);
  if (error) console.error('[admin/media] failed status write failed:', error.code);
}
