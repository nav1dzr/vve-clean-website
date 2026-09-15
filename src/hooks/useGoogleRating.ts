import { useEffect, useState } from 'react';
import { VERIFIED_GOOGLE_RATING } from '../data/googleRating';
import { parseGoogleRating, type GoogleRating } from '../lib/googleRatingDisplay';
import { isPrivatePage } from '../lib/privatePage';

let pending: Promise<GoogleRating | null> | undefined;
/** One same-origin request shared by badges in this visit; no persisted API data. */
export function useGoogleRating() {
  const [rating, setRating] = useState<GoogleRating | null>(VERIFIED_GOOGLE_RATING);
  useEffect(() => {
    if (isPrivatePage()) return;
    let active = true;
    // Promise.resolve also catches browsers where fetch or timeout support fails
    // synchronously, leaving the server-rendered, dated snapshot intact.
    pending ??= Promise.resolve().then(() => fetch('/api/google-rating', {
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(6000),
    })).then(async response => {
      if (!response.ok) return null;
      const data: unknown = await response.json();
      return data && typeof data === 'object' && 'rating' in data ? parseGoogleRating(data.rating) : null;
    }).catch(() => null);
    pending.then(next => { if (active && next && !isPrivatePage()) setRating(next); });
    return () => { active = false; };
  }, []);
  return rating;
}
