import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminProfile } from './AuthContext';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('admin verification timeout and denial', () => {
  it('treats HTTP 401 as a session requiring sign-in, not denied admin membership', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
    expect(await fetchAdminProfile('synthetic-token')).toEqual({ ok: false, kind: 'session-expired' });
  });
  it.each([
    [{ code: 'PREVIEW_SETUP_REQUIRED', error: 'Preview setup required' }, 'preview-blocked'],
    [{ error: 'This preview is read-only until approved isolated test resources are connected.' }, 'preview-blocked'],
    [{ code: 'ADMIN_ACCESS_DENIED', error: 'Membership denied' }, 'unauthorized'],
    [{ error: 'Not an authorised admin' }, 'unauthorized'],
    [{ error: 'Deployment protection' }, 'error'],
    [{ code: 'UNKNOWN', error: 'Not an authorised admin' }, 'error'],
    [null, 'error'],
  ])('classifies a 403 response %j without guessing membership', async (body, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, json: async () => body }));
    expect(await fetchAdminProfile('synthetic-token')).toEqual({ ok: false, kind });
  });
  it('keeps a non-JSON 403 response retryable without claiming missing admin access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, json: async () => { throw new SyntaxError('HTML response'); } }));
    expect(await fetchAdminProfile('synthetic-token')).toEqual({ ok: false, kind: 'error' });
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
