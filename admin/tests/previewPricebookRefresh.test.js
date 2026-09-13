import { afterEach, describe, expect, it, vi } from 'vitest';
import { pricebookRefreshConfigured, requestPricebookRefresh } from '../api/_lib/websitePricebook.js';
afterEach(() => vi.unstubAllGlobals());
describe('preview pricebook build hook isolation', () => {
  it('never calls an inherited build hook without explicit selection of a preview destination', async () => {
    const env = { VERCEL_ENV: 'preview', WEBSITE_PRICEBOOK_ENABLED: 'true', WEBSITE_PRICEBOOK_REFRESH_URL: 'https://build.example.com/inherited' };
    const fetchMock = vi.fn(), db = { from: vi.fn() }; vi.stubGlobal('fetch', fetchMock);
    expect(pricebookRefreshConfigured(env)).toBe(false);
    expect(await requestPricebookRefresh('synthetic', db, env)).toEqual({ status: 'failed', recorded: false });
    expect(fetchMock).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
    expect(pricebookRefreshConfigured({ ...env, VVE_PREVIEW_PRICEBOOK_REFRESH_URL: 'https://build.example.com/preview' })).toBe(false);
    expect(pricebookRefreshConfigured({ ...env, WEBSITE_PRICEBOOK_REFRESH_URL: 'https://build.example.com/preview', VVE_PREVIEW_PRICEBOOK_REFRESH_URL: 'https://build.example.com/preview' })).toBe(true);
  });
});
