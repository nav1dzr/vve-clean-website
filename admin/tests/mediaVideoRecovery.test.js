import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './api/_lib/fakeSupabase.js';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), config: vi.fn(), exists: vi.fn(), download: vi.fn(), upload: vi.fn() }));
vi.mock('../api/_lib/adminAuth.js', () => ({ verifyMediaAdminRequest: mocks.auth }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getMediaServiceClient: mocks.client }));
vi.mock('../api/_lib/mediaConfig.js', () => ({
  getMediaConfig: mocks.config, originalExists: mocks.exists, createDownloadUrl: mocks.download,
  inspectOriginal: async (...args) => ({ status: await mocks.exists(...args) ? 'verified' : 'missing' }),
  muxAuthHeader: () => 'Basic synthetic', createUploadUrl: mocks.upload, createImageDeliveryTemplate: vi.fn(),
}));
import { mediaAssetHandler } from '../api/_lib/mediaAssetActions.js';
import { applyMuxVideoState, findMuxVideoByPassthrough } from '../api/_lib/mediaVideoState.js';

const ID = '11111111-2222-3333-4444-555555555555';
const base = () => ({ id: ID, status: 'uploading', media_type: 'video', mux_asset_id: null, r2_key: 'originals/test.mp4', title: 'TEST ONLY', updated_at: '2026-11-17T10:00:00Z' });
const ready = () => ({ id: 'muxTest', passthrough: ID, status: 'ready', playback_ids: [{ id: 'playTest', policy: 'public' }] });
const response = (data, status = 200) => ({ ok: status < 300, status, json: async () => ({ data }) });
let db, fetcher;
async function call(action) {
  const req = { method: 'POST', query: { id: ID }, headers: {}, on(name, cb) {
    if (name === 'data') cb(Buffer.from(JSON.stringify({ action })));
    if (name === 'end') cb();
  } };
  const res = { writeHead(code) { this.code = code; }, end(body) { this.body = JSON.parse(body); } };
  await mediaAssetHandler(req, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  db = createFakeSupabase({ media_assets: [base()] });
  mocks.auth.mockResolvedValue({ ok: true, admin: { id: ID } });
  mocks.client.mockReturnValue(db);
  mocks.config.mockReturnValue({});
  mocks.exists.mockResolvedValue(true);
  mocks.download.mockResolvedValue('https://example.test/synthetic-original');
  mocks.upload.mockResolvedValue('https://example.test/synthetic-retry');
  fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe('video processing recovery', () => {
  it('leaves a signing failure retryable before any claim or provider POST', async () => {
    mocks.download.mockRejectedValueOnce(new Error('synthetic signing failure'));
    expect((await call('complete')).code).toBe(500);
    expect(db._tables.media_assets[0].status).toBe('uploading');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps an uncertain POST pending and a repeated Complete only searches for its existing asset', async () => {
    fetcher.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(response([ready()]));
    expect((await call('complete')).code).toBe(202);
    expect(db._tables.media_assets[0].status).toBe('processing');
    expect((await call('complete')).code).toBe(200);
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
    expect(db._tables.media_assets[0].mux_playback_id).toBe('playTest');
  });
  it.each([500, 502, 408, 429])('never turns ambiguous HTTP %i into another billable create', async (status) => {
    fetcher.mockResolvedValueOnce(response({}, status));
    expect((await call('complete')).code).toBe(202);
    expect(db._tables.media_assets[0].status).toBe('processing');
  });
  it('does not create a duplicate when a failed original already has a Mux asset', async () => {
    Object.assign(db._tables.media_assets[0], { status: 'failed', mux_asset_id: 'alreadyCreated' });
    expect((await call('complete')).code).toBe(409);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['processing', 'ready', 'archived'])('a retry waiting for its URL cannot reset concurrent %s state', async (status) => {
    mocks.exists.mockResolvedValueOnce(false);
    mocks.upload.mockImplementationOnce(async () => {
      db._tables.media_assets[0].status = status;
      return 'https://example.test/must-not-be-returned';
    });
    const result = await call('retry-upload');
    expect(result.code).toBe(409);
    expect(result.body.uploadUrl).toBeUndefined();
    expect(db._tables.media_assets[0].status).toBe(status);
    if (status === 'processing') {
      fetcher.mockResolvedValueOnce(response([]));
      expect((await call('complete')).code).toBe(202);
      expect(fetcher.mock.calls.every(([, options]) => options.method !== 'POST')).toBe(true);
    }
  });
  it('a retry cannot reopen a failed row newly bound to a provider asset', async () => {
    mocks.exists.mockResolvedValueOnce(false);
    mocks.upload.mockImplementationOnce(async () => {
      Object.assign(db._tables.media_assets[0], { status: 'failed', mux_asset_id: 'providerAlreadyCreated' });
      return 'https://example.test/must-not-be-returned';
    });
    expect((await call('retry-upload')).code).toBe(409);
    expect(db._tables.media_assets[0].status).toBe('failed');
    expect(db._tables.media_assets[0].mux_asset_id).toBe('providerAlreadyCreated');
  });
  it('still returns a retry upload URL for an unclaimed failed transfer', async () => {
    db._tables.media_assets[0].status = 'failed';
    mocks.exists.mockResolvedValueOnce(false);
    const result = await call('retry-upload');
    expect(result.code).toBe(200);
    expect(result.body.uploadUrl).toBe('https://example.test/synthetic-retry');
    expect(db._tables.media_assets[0].status).toBe('uploading');
  });
  it('a stale transfer failure cannot reopen a processing video for another create', async () => {
    const originalFrom = db.from;
    let firstRead = true;
    db.from = (table) => {
      const query = originalFrom(table);
      const originalRead = query.maybeSingle;
      query.maybeSingle = async () => {
        const result = await originalRead();
        if (firstRead) {
          firstRead = false;
          const snapshot = structuredClone(result);
          db._tables.media_assets[0].status = 'processing';
          return snapshot;
        }
        return result;
      };
      return query;
    };
    expect((await call('fail')).code).toBe(200);
    expect(db._tables.media_assets[0].status).toBe('processing');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('a ready webhook winning the handoff race cannot be downgraded by the create response', async () => {
    fetcher.mockImplementationOnce(async () => {
      await applyMuxVideoState(db, { ...db._tables.media_assets[0] }, ready());
      return response({ ...ready(), status: 'preparing' });
    });
    const result = await call('complete');
    expect(result.code).toBe(200);
    expect(db._tables.media_assets[0].status).toBe('ready');
    expect(db._tables.media_assets[0].mux_playback_id).toBe('playTest');
  });
  it('recovers an asset beyond the first 100 using the provider cursor', async () => {
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'unrelated', passthrough: 'other' }], next_cursor: 'next-test' }) })
      .mockResolvedValueOnce(response([ready()]));
    const found = await findMuxVideoByPassthrough({}, ID, () => 'Basic synthetic');
    expect(found.id).toBe('muxTest');
    expect(fetcher.mock.calls[1][0]).toContain('cursor=next-test');
    expect(fetcher.mock.calls.every(([, options]) => !options.method)).toBe(true);
  });
  it('a missing recovery match leaves the original pending without another POST', async () => {
    db._tables.media_assets[0].status = 'processing';
    fetcher.mockResolvedValueOnce(response([]));
    expect((await call('sync')).code).toBe(202);
    expect(db._tables.media_assets[0].status).toBe('processing');
    expect(fetcher.mock.calls.every(([, options]) => !options.method)).toBe(true);
  });
  it('ignores ready state for a mismatched passthrough or provider ID', async () => {
    Object.assign(db._tables.media_assets[0], { status: 'processing', mux_asset_id: 'correct' });
    await applyMuxVideoState(db, { ...db._tables.media_assets[0] }, ready());
    await applyMuxVideoState(db, { ...db._tables.media_assets[0] }, { ...ready(), id: 'correct', passthrough: 'wrong' });
    expect(db._tables.media_assets[0].status).toBe('processing');
  });
  it('an authenticated lookup can finish an already-bound historical asset without optional passthrough metadata', async () => {
    Object.assign(db._tables.media_assets[0], { status: 'processing', mux_asset_id: 'muxTest' });
    const provider = ready();
    delete provider.passthrough;
    fetcher.mockResolvedValueOnce(response(provider));
    expect((await call('sync')).code).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.mux.com/video/v1/assets/muxTest');
    expect(db._tables.media_assets[0].status).toBe('ready');
  });
  it.each(['ready', 'archived', 'failed'])('late events do not change terminal %s rows', async (status) => {
    Object.assign(db._tables.media_assets[0], { status, mux_asset_id: 'muxTest' });
    await applyMuxVideoState(db, { ...db._tables.media_assets[0] }, ready());
    expect(db._tables.media_assets[0].status).toBe(status);
  });
  it('a concurrent archive is preserved by the conditional write', async () => {
    const previous = { ...base(), status: 'processing' };
    db._tables.media_assets[0].status = 'archived';
    const result = await applyMuxVideoState(db, previous, ready());
    expect(result.status).toBe('archived');
    expect(db._tables.media_assets[0].mux_asset_id).toBeNull();
  });
});
