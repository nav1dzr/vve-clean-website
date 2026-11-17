import { createHmac, timingSafeEqual } from 'node:crypto';
import { getMediaServiceClient } from './supabaseAdmin.js';
import { previewIsolation, isHostedPreview } from './previewIsolation.js';
import { validMediaUuid } from './mediaFields.js';
import { MEDIA_ASSETS_TABLE } from './mediaTables.js';
import { applyMuxVideoState } from './mediaVideoState.js';

const MAX_BYTES = 128 * 1024;
const EVENTS = new Map([
  ['video.asset.created', 'preparing'],
  ['video.asset.ready', 'ready'],
  ['video.asset.errored', 'errored'],
]);

export function verifyMuxSignature(raw, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(raw) || typeof header !== 'string' || header.length > 2048 || !secret) return false;
  const parts = header.split(',').map((entry) => entry.trim().split('='));
  const timestamps = parts.filter(([key]) => key === 't');
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0][1])) return false;
  const timestamp = timestamps[0][1];
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  return parts.some(([key, signature]) => key === 'v1' && /^[a-fA-F0-9]{64}$/.test(signature || '')
    && timingSafeEqual(expected, Buffer.from(signature, 'hex')));
}

async function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BYTES) { reject(new Error('Payload too large')); return; }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Request interrupted')));
  });
}

function respond(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  return res.end(JSON.stringify(payload));
}

// Only this narrow resource bypasses browser admin authentication. Authentication
// is instead Mux's timestamped HMAC over the exact request bytes, with an explicit
// environment binding. No event publishes media or changes any assignment.
export async function mediaMuxWebhookHandler(req, res) {
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed' });
  const isolation = previewIsolation();
  if (!isolation.ok || (isHostedPreview() && (!process.env.VVE_PREVIEW_MUX_WEBHOOK_ENVIRONMENT_ID
    || process.env.VVE_PREVIEW_MUX_WEBHOOK_ENVIRONMENT_ID !== process.env.MUX_WEBHOOK_ENVIRONMENT_ID))) {
    return respond(res, 403, { error: 'Webhook environment is not enabled.' });
  }
  const secret = process.env.MUX_WEBHOOK_SIGNING_SECRET;
  const environmentId = process.env.MUX_WEBHOOK_ENVIRONMENT_ID;
  if (!secret || !environmentId) return respond(res, 503, { error: 'Video notifications are not configured.' });
  let raw;
  try { raw = await rawBody(req); } catch { return respond(res, 400, { error: 'Invalid webhook body.' }); }
  if (!verifyMuxSignature(raw, req.headers['mux-signature'], secret)) return respond(res, 401, { error: 'Invalid webhook signature.' });
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return respond(res, 400, { error: 'Invalid webhook body.' }); }
  if (event?.environment?.id !== environmentId) return respond(res, 403, { error: 'Webhook environment does not match.' });
  const expectedStatus = EVENTS.get(event.type);
  if (!expectedStatus) return respond(res, 200, { received: true, ignored: true });
  if (!event.data || event.data.status !== expectedStatus || !validMediaUuid(event.data.passthrough)
    || typeof event.data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,255}$/.test(event.data.id)) {
    return respond(res, 200, { received: true, ignored: true });
  }
  const db = getMediaServiceClient();
  if (!db) return respond(res, 503, { error: 'Video notifications are temporarily unavailable.' });
  try {
    const result = await db.from(MEDIA_ASSETS_TABLE).select('*').eq('id', event.data.passthrough).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) await applyMuxVideoState(db, result.data, event.data);
    return respond(res, 200, { received: true });
  } catch {
    // A non-2xx response makes Mux retry; never log payloads or signed URLs.
    return respond(res, 503, { error: 'Could not save video processing status.' });
  }
}
