import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWebsitePricebook } from '../../api/_lib/websitePricebook.js';
import handler from '../../api/website-pricebook.js';

afterEach(() => vi.unstubAllEnvs());

describe('published website price service', () => {
  it('uses the bundled snapshot without querying a database before activation', async () => {
    vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED', 'false');
    const rpc = vi.fn();
    const result = await loadWebsitePricebook({ rpc });
    expect(result.version).toBe('bundled');
    expect(result.catalogue.DEPOSIT_P).toBe(3000);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('constructs authoritative prices from the published version', async () => {
    vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED', 'true');
    const overrides = { CARPET_MIN_BOOKING_P: 9000 };
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'version-1', version: 'version-1', overrides }, error: null });
    const result = await loadWebsitePricebook({ rpc });
    expect(rpc).toHaveBeenCalledWith('get_published_website_pricebook');
    expect(result.version).toBe('version-1');
    expect(result.catalogue.CARPET_MIN_BOOKING_P).toBe(9000);
    expect(result.catalogue.DEPOSIT_P).toBe(3000);
  });

  it.each([
    { data: null, error: { message: 'database unavailable' } },
    { data: { version: 'invalid', overrides: { DEPOSIT_P: 4000 } }, error: null },
    { data: { version: 'invalid', overrides: { CARPET_MIN_BOOKING_P: -1 } }, error: null },
  ])('rejects unavailable or invalid published data instead of substituting old prices', async (reply) => {
    vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED', 'true');
    await expect(loadWebsitePricebook({ rpc: vi.fn().mockResolvedValue(reply) })).rejects.toThrow();
  });

  it('exposes only a non-cacheable public snapshot and refuses writes', async () => {
    vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED', 'false');
    const res = { writeHead: vi.fn(), end: vi.fn() };
    await handler({ method: 'GET' }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Cache-Control': 'no-store' }));
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ id: 'bundled', version: 'bundled', overrides: {} });
    await handler({ method: 'POST' }, res);
    expect(res.writeHead).toHaveBeenLastCalledWith(405, expect.any(Object));
  });
});
