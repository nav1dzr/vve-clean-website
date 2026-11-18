import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './api/_lib/fakeSupabase.js';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), mediaAdmin: vi.fn(), client: vi.fn() }));
vi.mock('../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: mocks.admin, verifyMediaAdminRequest: mocks.mediaAdmin }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: mocks.client, getMediaServiceClient: mocks.client }));
import handler from '../api/search.js';

const ID = '11111111-2222-3333-4444-555555555555';
const SECRET = 'route-test-secret-only';
const event = { type: 'video.asset.ready', environment: { id: 'routeTest' }, data: { id: 'muxRouteTest', passthrough: ID, status: 'ready', playback_ids: [{ id: 'routePlayback', policy: 'public' }] } };
let db;
async function call(url, signed = false) {
  const raw = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `t=${timestamp},v1=${createHmac('sha256', SECRET).update(`${timestamp}.`).update(raw).digest('hex')}`;
  const req = { url, method: 'POST', headers: signed ? { 'mux-signature': signature } : {}, query: { id: ID }, on(name, callback) {
    if (name === 'data') callback(raw);
    if (name === 'end') callback();
  } };
  const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
  await handler(req, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('MUX_WEBHOOK_SIGNING_SECRET', SECRET);
  vi.stubEnv('MUX_WEBHOOK_ENVIRONMENT_ID', 'routeTest');
  mocks.admin.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
  mocks.mediaAdmin.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
  db = createFakeSupabase({ media_assets: [{ id: ID, media_type: 'video', status: 'processing', mux_asset_id: null }] });
  mocks.client.mockReturnValue(db);
});
afterEach(() => vi.unstubAllEnvs());

describe('shared media webhook route authentication', () => {
  it('unsigned callback requests cannot reach or write the database', async () => {
    expect((await call('/api/search?resource=media-mux-webhook')).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(db._tables.media_assets[0].status).toBe('processing');
  });
  it('only a valid signature reaches the narrow provider transition', async () => {
    expect((await call('/api/search?resource=media-mux-webhook', true)).status).toBe(200);
    expect(db._tables.media_assets[0].status).toBe('ready');
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.mediaAdmin).not.toHaveBeenCalled();
  });
  it.each(['/api/search?resource=media', `/api/search?resource=media&id=${ID}`])('normal media route still requires staff authentication: %s', async (url) => {
    expect((await call(url, true)).status).toBe(401);
    expect(mocks.mediaAdmin).toHaveBeenCalledOnce();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('normal booking search still requires staff authentication', async () => {
    expect((await call('/api/search', true)).status).toBe(401);
    expect(mocks.admin).toHaveBeenCalledOnce();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('an unconfigured callback fails closed without affecting other routes', async () => {
    vi.stubEnv('MUX_WEBHOOK_SIGNING_SECRET', '');
    expect((await call('/api/search?resource=media-mux-webhook', true)).status).toBe(503);
    expect((await call('/api/search?resource=media', true)).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
