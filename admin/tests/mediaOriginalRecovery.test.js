import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './api/_lib/fakeSupabase.js';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), config: vi.fn(), inspect: vi.fn(), upload: vi.fn() }));
vi.mock('../api/_lib/adminAuth.js', () => ({ verifyMediaAdminRequest: mocks.auth }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getMediaServiceClient: mocks.client }));
vi.mock('../api/_lib/mediaConfig.js', () => ({
  getMediaConfig: mocks.config, inspectOriginal: mocks.inspect, createUploadUrl: mocks.upload,
  createImageDeliveryTemplate: () => 'https://media.example.test/image/{width}/synthetic.jpg',
  createDownloadUrl: vi.fn(), muxAuthHeader: () => 'Basic synthetic',
}));
import { mediaAssetHandler } from '../api/_lib/mediaAssetActions.js';

const ID = '11111111-2222-3333-4444-555555555555';
const ORIGINAL_TIME = '2026-11-17T10:00:00Z';
const image = () => ({ id: ID, media_type: 'image', status: 'uploading', mux_asset_id: null,
  delivery_url: '', updated_at: ORIGINAL_TIME, processing_error: '', r2_key: 'synthetic/original.jpg',
  original_size_bytes: 1234, original_content_type: 'image/jpeg' });
const delivery = () => ({ ok: true, headers: new Headers({ 'content-type': 'image/avif' }), body: { cancel: vi.fn() } });
let db, fetcher;
async function call(action) {
  const req = { method: 'POST', query: { id: ID }, headers: {}, on(name, callback) {
    if (name === 'data') callback(Buffer.from(JSON.stringify({ action })));
    if (name === 'end') callback();
  } };
  const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
  await mediaAssetHandler(req, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  db = createFakeSupabase({ media_assets: [image()] });
  mocks.auth.mockResolvedValue({ ok: true, admin: { id: ID } });
  mocks.client.mockReturnValue(db);
  mocks.config.mockReturnValue({});
  mocks.inspect.mockResolvedValue({ status: 'verified' });
  mocks.upload.mockResolvedValue('https://storage.example.test/synthetic-upload');
  fetcher = vi.fn().mockResolvedValue(delivery());
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe('original verification and safe image recovery', () => {
  it('confirms the original before preparing the image delivery', async () => {
    expect((await call('complete')).status).toBe(200);
    expect(db._tables.media_assets[0].status).toBe('ready');
    expect(mocks.inspect).toHaveBeenCalledWith({}, 'synthetic/original.jpg', expect.objectContaining({ original_size_bytes: 1234 }));
  });
  it('reports a confirmed missing original and allows a safe immutable retry URL', async () => {
    mocks.inspect.mockResolvedValue({ status: 'missing' });
    const complete = await call('complete');
    expect(complete.status).toBe(422);
    expect(complete.body.code).toBe('MEDIA_ORIGINAL_MISSING');
    expect(db._tables.media_assets[0].status).toBe('failed');
    const retry = await call('retry-upload');
    expect(retry.status).toBe(200);
    expect(retry.body.uploadUrl).toContain('synthetic-upload');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['size', 'type', 'size-and-type'])('keeps an existing %s mismatch and never signs an overwrite retry', async (reason) => {
    mocks.inspect.mockResolvedValue({ status: 'mismatch', reason });
    const result = await call('complete');
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('MEDIA_ORIGINAL_MISMATCH');
    expect(result.body.error).toContain('kept unchanged');
    expect((await call('retry-upload')).status).toBe(409);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['access', 'temporary'])('does not label an unavailable %s check as a missing original', async (reason) => {
    mocks.inspect.mockResolvedValue({ status: 'unavailable', reason });
    const result = await call('complete');
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('MEDIA_ORIGINAL_UNAVAILABLE');
    expect(result.body.error).not.toContain('not found');
    const savedError = db._tables.media_assets[0].processing_error;
    expect(db._tables.media_assets[0].status).toBe('uploading');
    await call('fail');
    expect(db._tables.media_assets[0].processing_error).toBe(savedError);
    expect(db._tables.media_assets[0].status).toBe('uploading');
    expect((await call('retry-upload')).status).toBe(503);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('recovers after a temporary verification failure without another upload', async () => {
    mocks.inspect.mockResolvedValueOnce({ status: 'unavailable', reason: 'temporary' });
    expect((await call('complete')).status).toBe(503);
    expect((await call('complete')).status).toBe(200);
    expect(db._tables.media_assets[0]).toMatchObject({ status: 'ready', processing_error: '' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each([
    { media_type: 'image', status: 'ready', delivery_url: 'https://media.example.test/ready.jpg' },
    { media_type: 'video', status: 'ready', mux_asset_id: 'synthetic-ready' },
    { media_type: 'video', status: 'processing', mux_asset_id: 'synthetic-processing' },
    { media_type: 'video', status: 'processing', mux_asset_id: null },
  ])('recovers a lost completion response for $media_type/$status without another transfer or mutation', async (state) => {
    db._tables.media_assets[0] = { ...image(), ...state };
    const before = structuredClone(db._tables);
    const result = await call('retry-upload');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: ID, alreadyStored: true });
    expect(db._tables).toEqual(before);
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { media_type: 'image', status: 'archived', delivery_url: 'https://media.example.test/archived.jpg' },
    { media_type: 'video', status: 'archived', mux_asset_id: 'synthetic-archived' },
    { media_type: 'video', status: 'failed', mux_asset_id: 'synthetic-failed' },
  ])('keeps the retry guard for $media_type/$status without touching the original or record', async (state) => {
    db._tables.media_assets[0] = { ...image(), ...state };
    const before = structuredClone(db._tables);
    expect((await call('retry-upload')).status).toBe(409);
    expect(db._tables).toEqual(before);
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('a retry racing a ready result returns a valid already-stored plan rather than an undefined upload URL', async () => {
    mocks.inspect.mockImplementationOnce(async () => {
      db._tables.media_assets[0] = { ...image(), status: 'ready', delivery_url: 'https://media.example.test/winning.jpg', updated_at: '2026-11-17T11:00:00Z' };
      return { status: 'unavailable', reason: 'temporary' };
    });
    const result = await call('retry-upload');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ id: ID, alreadyStored: true });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect((await call('complete')).status).toBe(200);
  });
  it.each(['ready', 'archived'])('stale failed verification cannot downgrade concurrent %s state', async (status) => {
    mocks.inspect.mockImplementationOnce(async () => {
      db._tables.media_assets[0] = { ...image(), status, delivery_url: 'https://media.example.test/winning.jpg', updated_at: '2026-11-17T11:00:00Z' };
      return { status: 'missing' };
    });
    expect((await call('complete')).status).toBe(status === 'ready' ? 200 : 409);
    expect(db._tables.media_assets[0].status).toBe(status);
    expect(db._tables.media_assets[0].processing_error).toBe('');
  });
  it.each(['ready', 'archived'])('stale successful delivery cannot overwrite concurrent %s state', async (status) => {
    fetcher.mockImplementationOnce(async () => {
      db._tables.media_assets[0] = { ...image(), status, delivery_url: 'https://media.example.test/winning.jpg', updated_at: '2026-11-17T11:00:00Z' };
      return delivery();
    });
    expect((await call('complete')).status).toBe(status === 'ready' ? 200 : 409);
    expect(db._tables.media_assets[0]).toMatchObject({ status, delivery_url: 'https://media.example.test/winning.jpg' });
  });
  it.each(['response', 'timeout'])('preserves a verified original if photo delivery has a %s failure', async (failure) => {
    if (failure === 'timeout') fetcher.mockRejectedValueOnce(new Error('synthetic timeout'));
    else fetcher.mockResolvedValueOnce({ ...delivery(), ok: false });
    const result = await call('complete');
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('MEDIA_PHOTO_DELIVERY_UNAVAILABLE');
    expect(result.body.error).toContain('stored safely');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect((await call('complete')).status).toBe(200);
  });
  it('a concurrent metadata edit keeps its newer state rather than accepting a stale check', async () => {
    fetcher.mockImplementationOnce(async () => {
      db._tables.media_assets[0] = { ...image(), title: 'New caption', updated_at: '2026-11-17T11:00:00Z' };
      return delivery();
    });
    expect((await call('complete')).status).toBe(409);
    expect(db._tables.media_assets[0]).toMatchObject({ status: 'uploading', title: 'New caption' });
  });
});
