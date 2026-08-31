const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
export const CATEGORY_VALUES = ['end-of-tenancy', 'carpet', 'sofa-upholstery'];
export const BEFORE_AFTER_VALUES = ['before', 'after', 'none'];
export const PLACEMENT_VALUES = ['main-home', 'gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa', 'carpet-page', 'sofa-page', 'end-of-tenancy-page'];
const PLACEMENT_DEFAULTS = {
  'main-home': { category: 'end-of-tenancy', service: 'VVE Clean' },
  'gallery-end-of-tenancy': { category: 'end-of-tenancy', service: 'End of tenancy cleaning' },
  'gallery-carpet': { category: 'carpet', service: 'Carpet cleaning' },
  'gallery-sofa': { category: 'sofa-upholstery', service: 'Sofa & upholstery cleaning' },
  'carpet-page': { category: 'carpet', service: 'Carpet cleaning' },
  'sofa-page': { category: 'sofa-upholstery', service: 'Sofa & upholstery cleaning' },
  'end-of-tenancy-page': { category: 'end-of-tenancy', service: 'End of tenancy cleaning' },
};
const MAX_TITLE = 120;
const MAX_TEXT = 300;
const MAX_PAIR_KEY = 64;
const MAX_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // R2 and Mux ingest can handle long 4K source files.

function text(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateNewAsset(body) {
  const filename = text(body.filename, 180);
  const contentType = text(body.contentType, 100).toLowerCase();
  const size = Number(body.size);
  const mediaType = IMAGE_TYPES.has(contentType) ? 'image' : VIDEO_TYPES.has(contentType) ? 'video' : '';
  if (!filename || !mediaType || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE_BYTES) {
    return { ok: false, error: 'Choose a supported photo or video under 5 GB.' };
  }
  return { ok: true, value: { filename, contentType, size, mediaType, ...normaliseMetadata(body) } };
}

export function normaliseMetadata(body) {
  const placement = PLACEMENT_VALUES.includes(body.placement) ? body.placement : 'gallery-end-of-tenancy';
  const defaults = PLACEMENT_DEFAULTS[placement];
  const category = CATEGORY_VALUES.includes(body.category) ? body.category : defaults.category;
  const beforeAfter = BEFORE_AFTER_VALUES.includes(body.beforeAfter) ? body.beforeAfter : 'none';
  const slotKey = text(body.slotKey, 100);
  const requestedSlotKey = slotKey.startsWith(`${placement}-`) ? slotKey : null;
  return {
    title: text(body.title, MAX_TITLE),
    altText: text(body.altText, MAX_TEXT),
    service: text(body.service, 100) || defaults.service,
    category,
    placement,
    beforeAfter,
    pairKey: text(body.pairKey, MAX_PAIR_KEY).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
    locationLabel: text(body.locationLabel, 100),
    websiteVisible: body.websiteVisible === true,
    googleEnabled: body.googleEnabled === true,
    socialEnabled: body.socialEnabled === true,
    requestedSlotKey,
  };
}

export function toMediaSummary(row, slotMap) {
  return {
    id: row.id,
    mediaType: row.media_type,
    status: row.status,
    title: row.title,
    altText: row.alt_text,
    service: row.service,
    category: row.category,
    placement: row.placement,
    beforeAfter: row.before_after,
    pairKey: row.pair_key,
    locationLabel: row.location_label,
    websiteVisible: row.website_visible,
    googleEnabled: row.google_enabled,
    socialEnabled: row.social_enabled,
    requestedSlotKey: row.requested_slot_key,
    activeSlotKey: slotMap.get(row.id) || null,
    imageUrl: row.cloudflare_image_id ? `https://imagedelivery.net/${process.env.CLOUDFLARE_IMAGES_DELIVERY_HASH}/${row.cloudflare_image_id}/public` : null,
    muxPlaybackId: row.mux_playback_id || null,
    processingError: row.processing_error || '',
    createdAt: row.created_at,
  };
}
