import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdsValidationReadiness, readinessMessage } from './adsValidationReadiness';
const getSession = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }));
const fetchMock = vi.fn();
beforeEach(() => { getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'MOCK-token' } } }); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('diagnostic-only readiness transport', () => {
  it('uses a single fixed authenticated GET without redirects', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ status: 'ready' }) });
    expect(await getAdsValidationReadiness()).toEqual({ status: 'ready' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin-ads-validation', expect.objectContaining({
      method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer MOCK-token' },
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('preserves a safe non-2xx reason instead of discarding it', async () => {
    const body = { status: 'unavailable', stage: 'website', reason: 'CLAIM_LOOKUP_FAILED' };
    fetchMock.mockResolvedValue({ status: 503, json: async () => body });
    expect(await getAdsValidationReadiness()).toEqual(body);
  });
  it('no session cannot start readiness', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await getAdsValidationReadiness()).toEqual({ status: 'denied' }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [503, { status: 'ready' }], [200, { status: 'ready', token: 'PRIVATE' }],
    [200, { status: 'closed' }], [503, { status: 'unavailable', stage: 'website', reason: 'PRIVATE' }],
    [503, { status: 'unavailable', stage: 'website', reason: 'CLAIM_LOOKUP_FAILED', error: 'PRIVATE' }],
    [200, { status: 'validated', warningCount: 0 }], [200, null], [200, []],
  ])('rejects misleading status or extra/untrusted data %#', async (status, body) => {
    fetchMock.mockResolvedValue({ status, json: async () => body });
    await expect(getAdsValidationReadiness()).rejects.toThrow('invalid_readiness_result'); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry malformed JSON or network failures', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => { throw new Error('PRIVATE'); } });
    await expect(getAdsValidationReadiness()).rejects.toThrow(); expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset().mockRejectedValue(new Error('PRIVATE'));
    await expect(getAdsValidationReadiness()).rejects.toThrow(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('bounds response-body waiting too and never retries', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (_url, init) => ({ status: 200,
      json: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout')))) }));
    const result = getAdsValidationReadiness(); const rejection = expect(result).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(20_000); await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('closed and unavailable messages do not invent a production root cause', () => {
    expect(readinessMessage({ status: 'closed' })).toContain('does not disclose');
    expect(readinessMessage({ status: 'unavailable' })).toContain('unavailable or uncertain');
  });
});
