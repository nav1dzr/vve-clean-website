import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/google-rating.js';
const response = () => ({ writeHead: vi.fn(), end: vi.fn() });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('shared Google aggregate endpoint', () => {
  it('makes no paid API call until explicitly configured', async () => {
    vi.stubEnv('GOOGLE_RATING_ENABLED', 'false');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const res = response(); await handler({ method: 'GET' }, res);
    expect(fetch).not.toHaveBeenCalled(); expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ rating: null });
  });
  it('uses the fixed configured place and returns only a validated aggregate', async () => {
    vi.stubEnv('GOOGLE_RATING_ENABLED', 'true'); vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key'); vi.stubEnv('GOOGLE_PLACES_PLACE_ID', 'ChIJtestplace123');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rating: 4.8, userRatingCount: 31, reviews: ['not exposed'] }) }); vi.stubGlobal('fetch', fetch);
    const res = response(); await handler({ method: 'GET', query: { place: 'attacker' } }, res);
    expect(fetch.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/ChIJtestplace123');
    expect(fetch.mock.calls[0][1].headers['X-Goog-FieldMask']).toBe('rating,userRatingCount');
    const output = JSON.parse(res.end.mock.calls[0][0]); expect(output.rating).toMatchObject({ value: 4.8, count: 31, live: true }); expect(output).not.toHaveProperty('reviews');
  });
  it.each([{ rating: 7, userRatingCount: 2 }, { rating: 5, userRatingCount: '26' }, { rating: 5, userRatingCount: 0 }])('rejects invalid aggregates', async data => {
    vi.stubEnv('GOOGLE_RATING_ENABLED', 'true'); vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key'); vi.stubEnv('GOOGLE_PLACES_PLACE_ID', 'ChIJtestplace123');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const res = response(); await handler({ method: 'GET' }, res); expect(res.writeHead.mock.calls[0][0]).toBe(503);
  });
  it('does not allow mutation methods', async () => { const res = response(); await handler({ method: 'POST' }, res); expect(res.writeHead.mock.calls[0][0]).toBe(405); });
});
