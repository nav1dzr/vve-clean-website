import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './api/_lib/fakeSupabase.js';
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getMediaServiceClient: mocks.client }));
import { mediaMuxWebhookHandler, verifyMuxSignature } from '../api/_lib/mediaMuxWebhook.js';
const ID = '11111111-2222-3333-4444-555555555555';
const SECRET = 'synthetic-test-signing-secret';
const now = 1794916800;
const signed = (raw, timestamp = now) => `t=${timestamp},v1=${createHmac('sha256', SECRET).update(`${timestamp}.`).update(raw).digest('hex')}`;
const ready = () => ({ type: 'video.asset.ready', environment: { id: 'testEnv' }, data: { id: 'muxTest', passthrough: ID, status: 'ready', playback_ids: [{ id: 'playTest', policy: 'public' }] } });
let db;
async function call(event = ready(), options = {}) {
  const raw = options.raw || Buffer.from(JSON.stringify(event));
  const req = { method: options.method || 'POST', headers: { 'mux-signature': options.signature ?? signed(raw) }, on(name, cb) {
    if (name === 'data') cb(raw);
    if (name === 'end') cb();
  } };
  const res = { writeHead(code) { this.code = code; }, end(body) { this.body = JSON.parse(body); } };
  await mediaMuxWebhookHandler(req, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
  vi.stubEnv('MUX_WEBHOOK_SIGNING_SECRET', SECRET);
  vi.stubEnv('MUX_WEBHOOK_ENVIRONMENT_ID', 'testEnv');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  db = createFakeSupabase({ media_assets: [{ id: ID, media_type: 'video', status: 'processing', mux_asset_id: null, updated_at: 'old' }] });
  mocks.client.mockReturnValue(db);
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('signed Mux video notifications', () => {
  it('updates a pending video without an open CRM session and never publishes it', async () => {
    expect((await call()).code).toBe(200);
    expect(db._tables.media_assets[0]).toMatchObject({ status: 'ready', mux_asset_id: 'muxTest', mux_playback_id: 'playTest' });
    expect(db._tables.media_assignments).toBeUndefined();
    expect(db._tables.media_assets[0].website_visible).toBeUndefined();
  });
  it('duplicate and out-of-order notifications keep the terminal ready state', async () => {
    await call();
    const saved = { ...db._tables.media_assets[0] };
    vi.setSystemTime((now + 50) * 1000);
    await call();
    await call({ ...ready(), type: 'video.asset.created', data: { ...ready().data, status: 'preparing' } });
    expect(db._tables.media_assets[0]).toEqual(saved);
  });
  it.each(['missing', 't=123,v1=bad'])('rejects %s signature before database access', async (signature) => {
    expect((await call(ready(), { signature })).code).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('rejects tampering and replayed/future signatures', () => {
    const raw = Buffer.from('{"example":"original"}');
    expect(verifyMuxSignature(Buffer.from('{}'), signed(raw), SECRET, now)).toBe(false);
    expect(verifyMuxSignature(raw, signed(raw, now - 301), SECRET, now)).toBe(false);
    expect(verifyMuxSignature(raw, signed(raw, now + 301), SECRET, now)).toBe(false);
    expect(verifyMuxSignature(raw, signed(raw), SECRET, now)).toBe(true);
  });
  it('requires the configured provider environment', async () => {
    expect((await call({ ...ready(), environment: { id: 'differentEnv' } })).code).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('ignores other provider assets and events', async () => {
    expect((await call({ ...ready(), type: 'video.asset.deleted' })).code).toBe(200);
    expect((await call({ ...ready(), data: { ...ready().data, passthrough: 'unrelated' } })).code).toBe(200);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('cannot resurrect archived media or replace its bound Mux asset', async () => {
    db._tables.media_assets[0].status = 'archived';
    await call();
    expect(db._tables.media_assets[0].status).toBe('archived');
    Object.assign(db._tables.media_assets[0], { status: 'processing', mux_asset_id: 'differentMux' });
    await call();
    expect(db._tables.media_assets[0].status).toBe('processing');
  });
  it('fails closed when configuration is missing', async () => {
    vi.stubEnv('MUX_WEBHOOK_SIGNING_SECRET', '');
    expect((await call()).code).toBe(503);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('rejects inherited production settings in a hosted preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await call()).code).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('requires an explicit provider binding even with an approved isolated database', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VVE_PREVIEW_ISOLATION_APPROVED', 'true');
    vi.stubEnv('VVE_PREVIEW_TEST_EMAIL', 'synthetic@example.test');
    vi.stubEnv('VVE_PREVIEW_SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('BOOKING_JOURNEY_MODE', '');
    vi.stubEnv('VVE_PREVIEW_MUX_WEBHOOK_ENVIRONMENT_ID', '');
    expect((await call()).code).toBe(403);
    vi.stubEnv('VVE_PREVIEW_MUX_WEBHOOK_ENVIRONMENT_ID', 'testEnv');
    expect((await call()).code).toBe(200);
    expect(db._tables.media_assets[0].status).toBe('ready');
  });
  it('returns a retryable response for a database write failure', async () => {
    mocks.client.mockReturnValue({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ error: new Error('synthetic database outage') }) }) });
    expect((await call()).code).toBe(503);
  });
  it('rejects signed malformed JSON without accessing records', async () => {
    expect((await call(ready(), { raw: Buffer.from('{') })).code).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('returns a retryable failure when storage is unavailable', async () => {
    mocks.client.mockReturnValue(null);
    expect((await call()).code).toBe(503);
  });
  it('rejects oversized bodies and non-POST requests', async () => {
    expect((await call(ready(), { raw: Buffer.alloc(128 * 1024 + 1) })).code).toBe(400);
    expect((await call(ready(), { method: 'GET' })).code).toBe(405);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
