import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { mediaRequest, outputFormat } from './index.js';

describe('private R2 media Worker routes', () => {
  it('maps a constrained delivery route to an internal immutable R2 key', () => {
    expect(mediaRequest('/image/1200/11111111-2222-3333-4444-555555555555.heic')).toEqual({
      width: 1200,
      assetId: '11111111-2222-3333-4444-555555555555',
      extension: 'heic',
      key: 'originals/11111111-2222-3333-4444-555555555555/source.heic',
    });
  });

  it('rejects raw object paths and unbounded transformation sizes', () => {
    expect(mediaRequest('/originals/11111111-2222-3333-4444-555555555555/source.jpg')).toBeNull();
    expect(mediaRequest('/image/9999/11111111-2222-3333-4444-555555555555.jpg')).toBeNull();
  });

  it('implements format=auto from browser support', () => {
    expect(outputFormat('image/avif,image/webp,image/*')).toBe('image/avif');
    expect(outputFormat('image/webp,image/*')).toBe('image/webp');
    expect(outputFormat('image/*')).toBe('image/jpeg');
  });
});

// Images.output() resolves asynchronously in Cloudflare's real binding.
// A synchronous stand-in would hide calls to response() on its Promise.
describe('private R2 media Worker delivery', () => {
  const path = '/image/480/11111111-2222-4333-8444-555555555555.jpg';

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setup() {
    const original = new Response('private original').body;
    const response = vi.fn(() => new Response('optimized image', {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Image-Provider': 'binding' },
    }));
    const output = vi.fn().mockResolvedValue({ response });
    const transform = vi.fn(() => ({ output }));
    const input = vi.fn(() => ({ transform }));
    const env = { MEDIA_ORIGINALS: { get: vi.fn().mockResolvedValue({ body: original }) }, IMAGES: { input } };
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    const ctx = { waitUntil: vi.fn() };
    vi.stubGlobal('caches', { default: cache });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return { original, env, input, transform, output, response, cache, ctx };
  }

  it.each([
    ['image/avif,image/webp,image/*', 'image/avif'],
    ['image/webp,image/*', 'image/webp'],
    ['image/*', 'image/jpeg'],
  ])('awaits optimized output and caches the %s representation', async (accept, format) => {
    const h = setup();
    const result = await worker.fetch(new Request('https://media.example.test' + path, {
      headers: { Accept: accept },
    }), h.env, h.ctx);

    expect(result.status).toBe(200);
    expect(await result.text()).toBe('optimized image');
    expect(h.input).toHaveBeenCalledWith(h.original);
    expect(h.transform).toHaveBeenCalledWith({ width: 480, fit: 'scale-down' });
    expect(h.output).toHaveBeenCalledWith({ format, quality: 85 });
    expect(h.response).toHaveBeenCalledOnce();
    expect(result.headers.get('Content-Type')).toBe(format);
    expect(result.headers.get('X-Image-Provider')).toBe('binding');
    expect(result.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(result.headers.get('CDN-Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(result.headers.get('Vary')).toBe('Accept');
    expect(result.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(h.cache.put).toHaveBeenCalledOnce();
    const [cacheKey, cached] = h.cache.put.mock.calls[0];
    expect(new URL(cacheKey.url).searchParams.get('__format')).toBe(format);
    expect(await cached.text()).toBe('optimized image');
    expect(h.ctx.waitUntil).toHaveBeenCalledOnce();
    expect(h.ctx.waitUntil.mock.calls[0][0]).toBe(h.cache.put.mock.results[0].value);
  });

  it('returns a cached representation without rereading or transforming the original', async () => {
    const h = setup();
    const cached = new Response('cached optimized image', { headers: { 'Content-Type': 'image/webp' } });
    h.cache.match.mockResolvedValue(cached);
    const result = await worker.fetch(new Request('https://media.example.test' + path, {
      headers: { Accept: 'image/webp' },
    }), h.env, h.ctx);
    expect(result).toBe(cached);
    expect(new URL(h.cache.match.mock.calls[0][0].url).searchParams.get('__format')).toBe('image/webp');
    expect(h.env.MEDIA_ORIGINALS.get).not.toHaveBeenCalled();
    expect(h.input).not.toHaveBeenCalled();
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it('contains an asynchronous encoding failure without returning or caching the original', async () => {
    const h = setup();
    h.output.mockRejectedValue(new Error('Image encoding failed'));
    const result = await worker.fetch(new Request('https://media.example.test' + path), h.env, h.ctx);
    expect(result.status).toBe(422);
    expect(await result.text()).toBe('Image unavailable');
    expect(h.response).not.toHaveBeenCalled();
    expect(h.cache.put).not.toHaveBeenCalled();
    expect(h.ctx.waitUntil).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Image transformation failed', {
      assetId: '11111111-2222-4333-8444-555555555555', message: 'Image encoding failed',
    });
  });

  it('returns 404 for a missing original without calling Images', async () => {
    const h = setup();
    h.env.MEDIA_ORIGINALS.get.mockResolvedValue(null);
    const result = await worker.fetch(new Request('https://media.example.test' + path), h.env, h.ctx);
    expect(result.status).toBe(404);
    expect(h.input).not.toHaveBeenCalled();
    expect(h.cache.put).not.toHaveBeenCalled();
  });
});
