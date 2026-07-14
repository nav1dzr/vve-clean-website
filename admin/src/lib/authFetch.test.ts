import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-123' } } }),
    },
  },
}));

const { authFetch, ApiError } = await import('./authFetch');

describe('authFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('attaches the current session bearer token', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ hello: 'world' }) } as Response);

    await authFetch('/api/test');

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }),
    );
  });

  it('returns the parsed JSON body on success', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ hello: 'world' }) } as Response);

    const result = await authFetch('/api/test');

    expect(result).toEqual({ hello: 'world' });
  });

  it('sends a JSON content-type header when a body is provided', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    await authFetch('/api/test', { method: 'POST', body: JSON.stringify({ q: 'x' }) });

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
  });

  it('throws an ApiError carrying the server-provided message on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Not an authorised admin' }),
    } as Response);

    await expect(authFetch('/api/test')).rejects.toMatchObject({ status: 403, message: 'Not an authorised admin' });
  });

  it('falls back to a generic message when the error response has no usable body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('no body');
      },
    } as unknown as Response);

    await expect(authFetch('/api/test')).rejects.toMatchObject({ status: 500, message: 'Request failed' });
  });

  it('throws a clear, retryable ApiError when the network request itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authFetch('/api/test')).rejects.toBeInstanceOf(ApiError);
    await expect(authFetch('/api/test')).rejects.toMatchObject({
      message: expect.stringContaining('Could not reach the server'),
    });
  });

  it('throws a timeout-specific ApiError rather than hanging forever', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const promise = authFetch('/api/test');
    const assertion = expect(promise).rejects.toMatchObject({ message: expect.stringContaining('timed out') });

    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
