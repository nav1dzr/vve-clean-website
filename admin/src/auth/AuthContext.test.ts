import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminProfile } from './AuthContext';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('admin verification timeout and denial', () => {
  it.each([401, 403])('treats HTTP %i as denied access', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status }));
    expect(await fetchAdminProfile('synthetic-token')).toEqual({ ok: false, kind: 'unauthorized' });
  });
  it('bounds a request that does not return headers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const result = fetchAdminProfile('synthetic-token');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toEqual({ ok: false, kind: 'error' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps the timeout until the response body has finished', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => Promise.resolve({
      status: 200,
      json: () => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    })));
    const result = fetchAdminProfile('synthetic-token');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toEqual({ ok: false, kind: 'error' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels obsolete verification through the caller signal', async () => {
    const outer = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const result = fetchAdminProfile('synthetic-token', outer.signal);
    outer.abort();
    expect(await result).toEqual({ ok: false, kind: 'error' });
  });
});
