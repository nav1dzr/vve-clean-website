import { MEDIA_ASSETS_TABLE } from './mediaTables.js';

const muxIdentifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,255}$/.test(value);

// A shared conditional transition for polling and signed Mux notifications.
// A late/duplicate event must never resurrect archived media or downgrade ready
// media. The stored provider ID cannot be replaced by another provider asset.
export async function applyMuxVideoState(db, asset, mux) {
  // An authenticated GET of an already-bound provider ID can legitimately
  // omit this optional metadata. New bindings and webhook lookup still require
  // an exact passthrough; a conflicting value is never accepted.
  const knownProviderWithoutMetadata = asset.mux_asset_id === mux?.id
    && (mux?.passthrough == null || mux.passthrough === '');
  if (asset.media_type !== 'video' || asset.status !== 'processing'
      || !muxIdentifier(mux?.id) || (mux.passthrough !== asset.id && !knownProviderWithoutMetadata)
      || (asset.mux_asset_id && asset.mux_asset_id !== mux.id)) return asset;
  const patch = { mux_asset_id: mux.id, processing_error: '' };
  if (mux.status === 'ready') {
    const playback = mux.playback_ids?.find((entry) => entry.policy === 'public' && muxIdentifier(entry.id));
    if (!playback) throw new Error('Ready video is missing its playback ID');
    Object.assign(patch, { status: 'ready', mux_playback_id: playback.id, ready_at: new Date().toISOString() });
  } else if (mux.status === 'errored') {
    Object.assign(patch, { status: 'failed', processing_error: 'Video processing failed. The original is safely stored; check the video format before uploading a replacement.' });
  } else if (mux.status !== 'preparing') return asset;
  // Avoid repeated writes/updated timestamps for ordinary pending polls.
  if (!patch.status && asset.mux_asset_id === mux.id && !asset.processing_error) return asset;
  patch.updated_at = new Date().toISOString();
  let query = db.from(MEDIA_ASSETS_TABLE).update(patch).eq('id', asset.id).eq('status', 'processing');
  query = asset.mux_asset_id ? query.eq('mux_asset_id', asset.mux_asset_id) : query.is('mux_asset_id', null);
  const result = await query.select('*').maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return result.data;
  const latest = await db.from(MEDIA_ASSETS_TABLE).select('*').eq('id', asset.id).maybeSingle();
  if (latest.error) throw latest.error;
  return latest.data || asset;
}

// Recovery only reads Mux. A missing result never authorises another create:
// a timed-out POST may still have been accepted by the provider.
export async function findMuxVideoByPassthrough(config, assetId, authHeader, fetcher = fetch) {
  const signal = AbortSignal.timeout(10000);
  let cursor;
  const seen = new Set();
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL('https://api.mux.com/video/v1/assets');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    else if (page > 1) url.searchParams.set('page', String(page));
    const response = await fetcher(url.toString(), { headers: { Authorization: authHeader(config) }, signal });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.data)) throw new Error('Could not check video processing');
    const matches = payload.data.filter((entry) => entry.passthrough === assetId && muxIdentifier(entry.id));
    if (matches.length > 1) throw new Error('Multiple provider videos require review');
    if (matches.length) return matches[0];
    if (payload.next_cursor) {
      if (typeof payload.next_cursor !== 'string' || seen.has(payload.next_cursor)) throw new Error('Invalid provider pagination');
      cursor = payload.next_cursor;
      seen.add(cursor);
    } else {
      if (cursor || payload.data.length < 100) return null;
    }
  }
  return null;
}
