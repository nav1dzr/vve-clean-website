import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { VERIFIED_GOOGLE_RATING } from '../data/googleRating';

beforeEach(() => { vi.resetModules(); window.history.replaceState({}, '', '/'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
const aggregate = { value: 4.8, count: 31, verifiedOn: '2026-09-15T10:00:00Z', live: true };

describe('shared Google rating refresh', () => {
  it('renders the checked snapshot first, then shares one request across all badges', async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn(() => new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const first = renderHook(useGoogleRating);
    const second = renderHook(useGoogleRating);
    expect(first.result.current).toEqual(VERIFIED_GOOGLE_RATING);
    expect(second.result.current).toEqual(VERIFIED_GOOGLE_RATING);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/google-rating', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
    resolve({ ok: true, json: async () => ({ rating: aggregate, secret: 'not retained' }) });
    await waitFor(() => expect(first.result.current).toEqual(aggregate));
    expect(second.result.current).toEqual(aggregate);
    expect(localStorage.getItem('google-rating')).toBeNull();
  });

  it.each([
    { ok: false },
    { ok: true, json: async () => ({ rating: null }) },
    { ok: true, json: async () => null },
    { ok: true, json: async () => ({ rating: { ...aggregate, live: false } }) },
    { ok: true, json: async () => ({ rating: { ...aggregate, count: '31' } }) },
    { ok: true, json: async () => { throw new Error('Malformed JSON'); } },
  ])('keeps the dated snapshot when refresh is unavailable or invalid (%#)', async response => {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const { result } = renderHook(useGoogleRating);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual(VERIFIED_GOOGLE_RATING);
  });

  it('keeps the snapshot on a network rejection', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Offline'));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const { result } = renderHook(useGoogleRating);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual(VERIFIED_GOOGLE_RATING);
  });

  it('does not fetch from a private booking-management page', async () => {
    window.history.replaceState({}, '', '/manage-booking/private-token');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    renderHook(useGoogleRating);
    expect(fetch).not.toHaveBeenCalled();
  });
});
