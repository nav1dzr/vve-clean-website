// The single source of truth for what the site may claim about Google reviews.
//
// ── Why this file exists ─────────────────────────────────────────────────────
// A hardcoded "5.0" was rendered in three separate places (the hero badge, the
// Reviews section header, and a QuoteCalculator bullet reading "Rated 5.0 by
// genuine Google reviewers"), plus an accessibility label announcing "rated 5.0
// out of 5 on Google". Nothing in the project stored a verified rating or a
// review count, and the component carrying it admitted as much in a comment.
//
// An unsubstantiated rating is the most trust-damaging thing a service site can
// display: it is exactly the claim a customer checks first, and under the UK
// CAP Code an objective claim like this has to be substantiated.
//
// ── Verification attempt (2026-08-03) ────────────────────────────────────────
// GOOGLE_PROFILE_LINK (share.google/tZEyXUs0J0SxXZlDi) was followed
// programmatically. It 302s to a google.com search URL, which in turn 302s to
// consent.google.com — a cookie-consent interstitial. No rating or review count
// is reachable without accepting that interstitial, and a web search returned
// no rating for VVE Clean either. So the real values COULD NOT be verified.
//
// The honest response to "we cannot verify it" is to stop asserting it, not to
// keep the number and hope. No rating or count is invented here.
//
// ── Stars are a claim too ────────────────────────────────────────────────────
// Removing the digits was not enough. A row of five filled gold stars beside a
// Google logo states "5.0" to any reader — more forcefully than the number did,
// because it is read at a glance and is not qualified by any wording. Marking
// it aria-hidden hides it from screen readers; it does not stop it being a
// claim to everyone else. So while VERIFIED_GOOGLE_RATING is null NO aggregate
// star row is rendered anywhere, and the badges fall back to the Google logo
// plus neutral wording. Stars return automatically the moment a real rating is
// entered below. SHOW_AGGREGATE_STARS is the single flag that governs this.
//
// ── How to publish a real rating later ───────────────────────────────────────
// Open the Google Business Profile, read the actual rating and review count,
// and replace `null` below with e.g. `{ value: 4.9, count: 27 }`. Every surface
// picks it up automatically and the tests in googleRating.test.ts start
// enforcing that the same numbers appear everywhere.

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
  // Example once verified: { value: 4.9, count: 27, verifiedOn: '2026-08-03' }
  return null;
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
