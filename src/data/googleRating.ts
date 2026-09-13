// Shared checked Google rating. Public profile observed 8 September 2026: 5.0, 26 reviews.
// Runtime badges can refresh through the official Places API; never label a snapshot as live.
export interface VerifiedGoogleRating {
  /** The star rating shown on the live Google Business Profile. */
  value: number;
  /** The number of reviews behind that rating. */
  count: number;
  /** ISO date the two numbers above were last checked against the profile. */
  verifiedOn: string;
}

/**
 * The only place a rating may be entered.
 *
 * Returns `null` while unverified, which means: make no numeric claim anywhere.
 * This must only ever be set from the live Google Business Profile. Do not
 * estimate it, do not carry a number over from marketing material, and do not
 * restore the old hardcoded 5.0.
 *
 * Written as a function rather than a bare `const rating = null` so TypeScript
 * keeps the declared union type. A const initialised to a literal `null` gets
 * narrowed to `null`, which makes every "if verified" branch below unreachable
 * (`Property 'value' does not exist on type 'never'`) and would silently delete
 * the code that restores the number once it is verified.
 */
function readVerifiedRating(): VerifiedGoogleRating | null {
  return { value: 5.0, count: 26, verifiedOn: '2026-09-08' };
}

export const VERIFIED_GOOGLE_RATING: VerifiedGoogleRating | null = readVerifiedRating();

/** True when the site is allowed to display a numeric rating. */
export const HAS_VERIFIED_RATING = VERIFIED_GOOGLE_RATING !== null;

/**
 * Whether an aggregate star row may be drawn.
 *
 * Deliberately the same condition as the number. Five filled stars are a
 * rating claim in pictorial form; they may only appear once the rating behind
 * them is real. Individual review cards are governed separately — see the
 * per-review `rating` field in components/Reviews.tsx.
 */
export const SHOW_AGGREGATE_STARS = HAS_VERIFIED_RATING;

/**
 * Short label for the badge. Falls back to wording that claims nothing beyond
 * the fact that a Google profile exists — which is verifiable by clicking it.
 */
export const GOOGLE_RATING_LABEL = VERIFIED_GOOGLE_RATING
  ? `${VERIFIED_GOOGLE_RATING.value} on Google`
  : 'Google Reviews';

/** Accessible name for the badge link. Never states a rating we cannot support. */
export const GOOGLE_RATING_ARIA_LABEL = VERIFIED_GOOGLE_RATING
  ? `VVE Clean is rated ${VERIFIED_GOOGLE_RATING.value} out of 5 from `
    + `${VERIFIED_GOOGLE_RATING.count} Google reviews — read our Google reviews (opens in a new tab)`
  : 'Read our reviews on Google (opens in a new tab)';
