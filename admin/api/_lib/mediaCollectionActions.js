import { randomUUID } from 'node:crypto';
import { verifyMediaAdminRequest } from './adminAuth.js';
import { corsHeaders } from './cors.js';
import { readJsonBody } from './body.js';
import { getMediaServiceClient } from './supabaseAdmin.js';
import { createR2Key, createUploadUrl, getMediaConfig } from './mediaConfig.js';
import { toMediaSummary, validateNewAsset } from './mediaFields.js';
import {
  MEDIA_ASSETS_TABLE,
  MEDIA_ASSIGNMENTS_TABLE,
  MEDIA_GALLERY_SLOTS_TABLE,
  MEDIA_GALLERY_TOPICS_TABLE,
  MEDIA_REFERENCES_TABLE,
  MEDIA_WEBSITE_SLOTS_TABLE,
} from './mediaTables.js';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 16 * 1024;

export async function mediaCollectionHandler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }
  if (!['GET', 'POST'].includes(req.method)) {
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
  try {
    if (req.method === 'GET') return await listMedia(res, headers, supabase);
    return await createUploadPlan(req, res, headers, supabase, auth.admin.id);
  } catch (error) {
    console.error('[admin/media] index route failed:', error?.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not complete that media request.' }));
  }
}


async function listMedia(res, headers, supabase) {
  const [
    { data: assets, error: assetsError },
    { data: topics, error: topicsError },
    { data: gallerySlots, error: gallerySlotsError },
    { data: websiteSlots, error: websiteSlotsError },
    { data: assignments, error: assignmentsError },
    { data: references, error: referencesError },
  ] = await Promise.all([
    supabase.from(MEDIA_ASSETS_TABLE).select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from(MEDIA_GALLERY_TOPICS_TABLE).select('topic_key, label, description, sort_order').eq('active', true).order('sort_order'),
    supabase.from(MEDIA_GALLERY_SLOTS_TABLE).select('id, topic_key, slot_code, slot_kind, label, sort_order').order('topic_key').order('sort_order'),
    supabase.from(MEDIA_WEBSITE_SLOTS_TABLE).select('id, slot_key, page_label, purpose_label, description, sort_order').order('sort_order'),
    supabase.from(MEDIA_ASSIGNMENTS_TABLE).select('id, gallery_slot_id, website_slot_id, asset_id, media_role, updated_at'),
    supabase.from(MEDIA_REFERENCES_TABLE).select('id, reference_key, page_key, page_label, component_label, gallery_slot_id, website_slot_id, sort_order, active').eq('active', true).order('page_key').order('sort_order'),
  ]);
  if (assetsError || topicsError || gallerySlotsError || websiteSlotsError || assignmentsError || referencesError) {
    console.error('[admin/media] list failed:', assetsError?.code || topicsError?.code || gallerySlotsError?.code || websiteSlotsError?.code || assignmentsError?.code || referencesError?.code);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Could not load the two-part media manager. Make sure the latest Preview media migration is applied.' }));
  }
  const referencesByTarget = new Map();
  for (const reference of references || []) {
    const target = reference.gallery_slot_id || reference.website_slot_id;
    const current = referencesByTarget.get(target) || [];
    current.push({ key: reference.reference_key, pageKey: reference.page_key, pageLabel: reference.page_label, componentLabel: reference.component_label });
    referencesByTarget.set(target, current);
  }
  const assignmentsByTarget = new Map();
  const usagesByAsset = new Map();
  for (const assignment of assignments || []) {
    const target = assignment.gallery_slot_id || assignment.website_slot_id;
    const current = assignmentsByTarget.get(target) || [];
    current.push(assignment);
    assignmentsByTarget.set(target, current);
    const usages = usagesByAsset.get(assignment.asset_id) || [];
    usages.push(...(referencesByTarget.get(target) || []));
    usagesByAsset.set(assignment.asset_id, usages);
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    assets: (assets || []).map((asset) => toMediaSummary(asset, usagesByAsset.get(asset.id) || [])),
    topics: (topics || []).map((topic) => ({ key: topic.topic_key, label: topic.label, description: topic.description, sortOrder: topic.sort_order })),
    gallerySlots: (gallerySlots || []).map((slot) => ({
      id: slot.id, topicKey: slot.topic_key, code: slot.slot_code, kind: slot.slot_kind, label: slot.label, sortOrder: slot.sort_order,
      assignments: (assignmentsByTarget.get(slot.id) || []).map((assignment) => ({ assetId: assignment.asset_id, role: assignment.media_role })),
      usages: referencesByTarget.get(slot.id) || [],
    })),
    websiteSlots: (websiteSlots || []).map((slot) => ({
      id: slot.id, key: slot.slot_key, pageLabel: slot.page_label, purposeLabel: slot.purpose_label, description: slot.description, sortOrder: slot.sort_order,
      assignments: (assignmentsByTarget.get(slot.id) || []).map((assignment) => ({ assetId: assignment.asset_id, role: assignment.media_role })),
      usages: referencesByTarget.get(slot.id) || [],
    })),
    references: (references || []).map((reference) => ({
      id: reference.id, key: reference.reference_key, pageKey: reference.page_key, pageLabel: reference.page_label, componentLabel: reference.component_label,
      gallerySlotId: reference.gallery_slot_id, websiteSlotId: reference.website_slot_id, sortOrder: reference.sort_order,
    })),
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
  const { error } = await supabase.from(MEDIA_ASSETS_TABLE).insert({
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
    placement: parsed.value.placement,
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
