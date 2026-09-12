import type { VerifiedGoogleRating } from '../data/googleRating';

/** Describe the existing source date without presenting a saved snapshot as live. */
export function googleRatingSourceLabel(rating: (Pick<VerifiedGoogleRating, 'verifiedOn'> & { live?: boolean }) | null) {
  if (!rating) return '';
  const date = new Date(rating.verifiedOn).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  return `${rating.live ? 'Updated' : 'Checked'} ${date}`;
}
