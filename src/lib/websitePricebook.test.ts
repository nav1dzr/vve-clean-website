import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A public page must stay usable when the live price list cannot be loaded.
// These cases cover both build states: managed prices off (the committed
// `bundled` snapshot) and managed prices on (a real published version baked in
// at build time by scripts/sync-website-pricebook.mjs).

const state = vi.hoisted(() => ({
  snapshot: { id: 'bundled', version: 'bundled', overrides: {} } as { id: string; version: string; overrides: Record<string, unknown> },
}));
vi.mock('../../shared/publishedPricebookSnapshot.js', () => ({ get default() { return state.snapshot; } }));

const MANAGED_BUILD = { id: 'version-7', version: 'version-7', overrides: { CARPET_MIN_BOOKING_P: 9000 } };
const LIVE = { id: 'version-8', version: 'version-8', overrides: { CARPET_MIN_BOOKING_P: 9500 }, publishedAt: '2026-11-13T10:00:00.000Z' };

async function load() {
  vi.resetModules();
  const { loadWebsitePricebook } = await import('./websitePricebook');
  return loadWebsitePricebook();
}

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => { state.snapshot = { id: 'bundled', version: 'bundled', overrides: {} }; });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('website price list for a page view', () => {
  it('makes no request when managed prices are off — the API could only return the same list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(load()).resolves.toMatchObject({ id: 'bundled', version: 'bundled', overrides: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prefers the live published list when managed prices are on', async () => {
    state.snapshot = MANAGED_BUILD;
    const fetchMock = vi.fn().mockResolvedValue(json(LIVE));
    vi.stubGlobal('fetch', fetchMock);

    await expect(load()).resolves.toMatchObject({ version: 'version-8', overrides: { CARPET_MIN_BOOKING_P: 9500 } });
    expect(fetchMock).toHaveBeenCalledWith('/api/website-pricebook', expect.objectContaining({ cache: 'no-store' }));
  });

  it.each([
    ['the request fails', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
    ['the service answers 503', () => vi.fn().mockResolvedValue(json({ error: 'unavailable' }, false))],
    ['the response is not a price list', () => vi.fn().mockResolvedValue(json({ hello: 'world' }))],
    ['the response is not JSON', () => vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } })],
    ['the response contains a protected or invalid price', () => vi.fn().mockResolvedValue(json({ id: 'bad', version: 'bad', overrides: { DEPOSIT_P: 1 } }))],
  ])('uses the list the page was built with when %s', async (_case, makeFetch) => {
    state.snapshot = MANAGED_BUILD;
    vi.stubGlobal('fetch', makeFetch());

    // Never rejects: a rejection is what used to replace the page with an error.
    await expect(load()).resolves.toMatchObject({ version: 'version-7', overrides: { CARPET_MIN_BOOKING_P: 9000 } });
  });

  it('stops waiting after the timeout and uses the built list', async () => {
    state.snapshot = MANAGED_BUILD;
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));

    vi.resetModules();
    const { loadWebsitePricebook, PRICEBOOK_TIMEOUT_MS } = await import('./websitePricebook');
    const pending = loadWebsitePricebook();
    await vi.advanceTimersByTimeAsync(PRICEBOOK_TIMEOUT_MS);

    await expect(pending).resolves.toMatchObject({ version: 'version-7' });
    expect(PRICEBOOK_TIMEOUT_MS).toBeLessThanOrEqual(4000);
  });

  it('still refuses to start from a build snapshot that is itself invalid', async () => {
    state.snapshot = { id: 'broken', version: 'broken', overrides: { DEPOSIT_P: 1 } };
    vi.stubGlobal('fetch', vi.fn());
    await expect(load()).rejects.toThrow();
  });
});
