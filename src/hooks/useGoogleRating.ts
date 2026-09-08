import { useEffect, useState } from 'react';
import { VERIFIED_GOOGLE_RATING, type VerifiedGoogleRating } from '../data/googleRating';
import { isPrivatePage } from '../lib/privatePage';

type Rating = VerifiedGoogleRating & { live?: boolean };
let pending: Promise<Rating | null> | undefined;
/** One same-origin request shared by all badges during this page visit. */
export function useGoogleRating() {
  const [rating, setRating] = useState<Rating | null>(VERIFIED_GOOGLE_RATING);
  useEffect(() => {
    if (isPrivatePage()) return;
    let active = true;
    pending ??= fetch('/api/google-rating', { credentials: 'omit', signal: AbortSignal.timeout(6000) })
      .then(async response => {
        if (!response.ok) return null;
        const { rating: next } = await response.json();
        return next && typeof next.value === 'number' && next.value >= 1 && next.value <= 5
          && Number.isInteger(next.count) && next.count > 0 && Number.isFinite(Date.parse(next.verifiedOn))
          ? next as Rating : null;
      }).catch(() => null);
    pending.then(next => { if (active && next) setRating(next); });
    return () => { active = false; };
  }, []);
  return rating;
}
