import { useEffect, useState } from 'react';
import { VERIFIED_GOOGLE_RATING, type VerifiedGoogleRating } from '../data/googleRating';
import { isPrivatePage } from '../lib/privatePage';

type Rating = VerifiedGoogleRating & { live?: boolean };
const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 2;
let cached: Rating | null = VERIFIED_GOOGLE_RATING;
let pending = false;
let attempts = 0;
let finished = false;
let retryAfter = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(rating: Rating | null) => void>();

function scheduleRefresh() {
  if (finished || pending || attempts >= MAX_ATTEMPTS || listeners.size === 0 || isPrivatePage()) return;
  const delay = retryAfter - Date.now();
  if (delay > 0) {
    retryTimer ??= setTimeout(() => {
      retryTimer = undefined;
      scheduleRefresh();
    }, delay);
    return;
  }
  pending = true;
  attempts += 1;
  void (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/google-rating', { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Rating unavailable');
      const { rating: next } = await response.json();
      // Null means the integration is disabled, not a transient network fault.
      if (next === null) { finished = true; return; }
      if (!next || typeof next.value !== 'number' || !Number.isFinite(next.value) || next.value < 1 || next.value > 5
        || !Number.isInteger(next.count) || next.count < 1 || typeof next.verifiedOn !== 'string'
        || !Number.isFinite(Date.parse(next.verifiedOn)) || Date.parse(next.verifiedOn) > Date.now() + 60_000) {
        throw new Error('Invalid rating');
      }
      // The in-memory result is a dated snapshot. Do not keep labelling it live
      // after navigation or a long-running browser visit.
      cached = { value: next.value, count: next.count, verifiedOn: next.verifiedOn, live: false };
      finished = true;
      listeners.forEach(listener => listener(cached));
    } catch {
      retryAfter = Date.now() + RETRY_DELAY_MS;
    } finally {
      clearTimeout(timeout);
      pending = false;
      scheduleRefresh();
    }
  })();
}

/** Share one public snapshot and at most one transient-failure retry per page visit. */
export function useGoogleRating() {
  const [rating, setRating] = useState<Rating | null>(cached);
  useEffect(() => {
    if (isPrivatePage()) return;
    listeners.add(setRating);
    setRating(cached);
    scheduleRefresh();
    return () => {
      listeners.delete(setRating);
      if (listeners.size === 0 && retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };
  }, []);
  return rating;
}
