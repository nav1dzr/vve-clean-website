import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VERIFIED_GOOGLE_RATING } from '../data/googleRating';
import { googleRatingSourceLabel } from '../lib/googleRatingDisplay';

const privacy = vi.hoisted(() => ({ privatePage: false }));
vi.mock('../lib/privatePage', () => ({ isPrivatePage: () => privacy.privatePage }));

const fresh = { value: 4.8, count: 42, verifiedOn: '2026-10-12T10:00:00Z', live: true };
const reply = (rating: unknown, ok = true) => ({ ok, json: async () => ({ rating }) });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'));
  privacy.privatePage = false;
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shared Google rating recovery', () => {
  it('shares one request across badges and retains an honestly dated snapshot across navigation', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(fresh));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const a = renderHook(useGoogleRating);
    const b = renderHook(useGoogleRating);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].credentials).toBe('omit');
    expect(a.result.current).toEqual({ ...fresh, live: false });
    expect(b.result.current).toEqual(a.result.current);
    a.unmount(); b.unmount();
    await act(async () => { vi.advanceTimersByTime(60 * 60 * 1000); });
    const later = renderHook(useGoogleRating);
    expect(later.result.current).toEqual({ ...fresh, live: false });
    expect(googleRatingSourceLabel(later.result.current)).toBe('Checked 12 Oct 2026');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure once after 30 seconds and updates all mounted badges', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(reply(fresh));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const a = renderHook(useGoogleRating);
    const b = renderHook(useGoogleRating);
    await act(async () => {});
    expect(a.result.current).toEqual(VERIFIED_GOOGLE_RATING);
    await act(async () => { vi.advanceTimersByTime(29_999); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(a.result.current?.count).toBe(42);
    expect(b.result.current).toEqual(a.result.current);
  });

  it('stops after two failures even when badges remount', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(null, false));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const a = renderHook(useGoogleRating);
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(30_000); });
    a.unmount();
    const b = renderHook(useGoogleRating);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(b.result.current).toEqual(VERIFIED_GOOGLE_RATING);
  });

  it('does not retry a disabled integration', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(null));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const a = renderHook(useGoogleRating);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    a.unmount(); renderHook(useGoogleRating);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('pauses the cooldown when there are no badges and resumes without an immediate retry storm', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(reply(fresh));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const a = renderHook(useGoogleRating);
    await act(async () => {});
    a.unmount();
    await act(async () => { vi.advanceTimersByTime(10_000); });
    renderHook(useGoogleRating);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears scheduled retries when the last badge unmounts', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const badge = renderHook(useGoogleRating);
    await act(async () => {});
    badge.unmount();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts a slow request after six seconds and recovers on the bounded retry', async () => {
    const fetch = vi.fn().mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    })).mockResolvedValue(reply(fresh));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const badge = renderHook(useGoogleRating);
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(badge.result.current).toEqual(VERIFIED_GOOGLE_RATING);
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(badge.result.current?.count).toBe(42);
  });

  it('does not fetch on private pages or retry after navigating to one', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    privacy.privatePage = true;
    const privateBadge = renderHook(useGoogleRating);
    expect(fetch).not.toHaveBeenCalled();
    privateBadge.unmount();
    privacy.privatePage = false;
    renderHook(useGoogleRating);
    await act(async () => {});
    privacy.privatePage = true;
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...fresh, value: 7 }, { ...fresh, value: NaN }, { ...fresh, count: 1.5 }, { ...fresh, verifiedOn: 'not-a-date' },
    { ...fresh, verifiedOn: '2030-01-01' },
  ])('never displays an invalid API snapshot: %j', async invalid => {
    const fetch = vi.fn().mockResolvedValue(reply(invalid));
    vi.stubGlobal('fetch', fetch);
    const { useGoogleRating } = await import('./useGoogleRating');
    const result = renderHook(useGoogleRating);
    await act(async () => {});
    expect(result.result.current).toEqual(VERIFIED_GOOGLE_RATING);
  });
});
