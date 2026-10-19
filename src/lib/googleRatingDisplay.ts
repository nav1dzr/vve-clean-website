import type { VerifiedGoogleRating } from '../data/googleRating';

export type GoogleRating = VerifiedGoogleRating & { live?: boolean };

/** Only an explicit, dated provider response may replace the checked snapshot. */
export function parseGoogleRating(value: unknown): GoogleRating | null {
  if (!value || typeof value !== 'object') return null;
  const rating = value as Record<string, unknown>;
  if (rating.live !== true || typeof rating.value !== 'number' || !Number.isFinite(rating.value)
    || rating.value < 1 || rating.value > 5 || typeof rating.count !== 'number'
    || !Number.isSafeInteger(rating.count) || rating.count < 1
    || typeof rating.verifiedOn !== 'string' || !Number.isFinite(Date.parse(rating.verifiedOn))) return null;
  return { value: rating.value, count: rating.count, verifiedOn: rating.verifiedOn, live: true };
}

/** Describe the existing source date without presenting a saved snapshot as live. */
export function googleRatingSourceLabel(rating: (Pick<VerifiedGoogleRating, 'verifiedOn'> & { live?: boolean }) | null) {
  if (!rating) return '';
  const date = new Date(rating.verifiedOn).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  return `${rating.live ? 'Updated' : 'Checked'} ${date}`;
}
