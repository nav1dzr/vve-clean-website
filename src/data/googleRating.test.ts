// Guards the one claim on this site a customer is most likely to check, and
// the one most likely to be challenged: the Google rating.
//
// Three components rendered a hardcoded "5.0" independently, and the hero badge
// announced "rated 5.0 out of 5 on Google" to screen readers. Nothing in the
// project held a verified rating or review count, and the live profile could
// not be read programmatically (the share link 302s to a Google consent wall).
//
// These tests enforce two rules:
//   1. no numeric rating may be displayed while VERIFIED_GOOGLE_RATING is null;
//   2. if it is ever set, every surface must show the SAME numbers — the old
//      failure mode was three copies drifting apart.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GOOGLE_RATING_ARIA_LABEL,
  GOOGLE_RATING_LABEL,
  HAS_VERIFIED_RATING,
  VERIFIED_GOOGLE_RATING,
} from './googleRating';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(src, p), 'utf8');

/**
 * File contents with comments removed.
 *
 * The scans below look for a rating rendered to the customer. Several of these
 * files legitimately *quote* the removed "Rated 5.0 by genuine Google
 * reviewers" string in a comment explaining why it went — that documentation is
 * the point, and it must not trip the guard. Only executable code and JSX text
 * are checked.
 */
const readCode = (p: string) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block and {/* JSX */} comments
  .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments, sparing "https://"

/**
 * Every non-test source file, scanned for a stray rating claim.
 *
 * This was originally a hand-written list of three components — and it missed a
 * fourth copy in TrustBadges.tsx ("5.0 average rating"), which only surfaced in
 * a browser check. A hardcoded list guards the files someone remembered; this
 * guards the codebase.
 */
function sourceFiles(dir = src, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const SURFACES = sourceFiles()
  .map((f) => f.slice(src.length + 1).replace(/\\/g, '/'))
  // googleRating.ts itself documents the removed claim and holds the example.
  .filter((f) => f !== 'data/googleRating.ts');

describe('the rating is centralised', () => {
  it('exposes a single verified-or-null source', () => {
    expect(HAS_VERIFIED_RATING).toBe(VERIFIED_GOOGLE_RATING !== null);
  });

  it('is read from that source by every surface that shows the badge', () => {
    for (const file of ['components/GoogleBadge.tsx', 'components/Reviews.tsx']) {
      expect(read(file), `${file} must not hardcode a rating`)
        .toMatch(/googleRating/);
    }
  });
});

describe('while the rating is unverified, nothing claims a number', () => {
  // If VERIFIED_GOOGLE_RATING is ever set, this whole block is skipped and the
  // consistency block below takes over instead.
  const unverified = VERIFIED_GOOGLE_RATING === null;

  it.runIf(unverified)('falls back to wording that asserts no figure', () => {
    expect(GOOGLE_RATING_LABEL).toBe('Rated on Google');
    expect(GOOGLE_RATING_LABEL).not.toMatch(/\d/);
  });

  it.runIf(unverified)('keeps the accessible name free of a rating claim', () => {
    // Screen-reader users were previously told "rated 5.0 out of 5 on Google".
    expect(GOOGLE_RATING_ARIA_LABEL).not.toMatch(/\d/);
    expect(GOOGLE_RATING_ARIA_LABEL).not.toMatch(/out of/i);
  });

  it.runIf(unverified).each(SURFACES)('%s hardcodes no star rating', (file) => {
    const code = readCode(file);
    // Catches "5.0", "Rated 5.0", "4.9 out of 5" and similar in JSX text.
    expect(code).not.toMatch(/>\s*[0-5]\.\d\s*</);
    expect(code).not.toMatch(/Rated\s+[0-5]\.\d/i);
    expect(code).not.toMatch(/[0-5]\.\d\s+out of\s+5/i);
  });

  it.runIf(unverified)('publishes no aggregateRating in structured data', () => {
    // Marking up an unverifiable rating is what turns it into a rich-result
    // claim Google can penalise.
    const indexHtml = readFileSync(resolve(src, '../index.html'), 'utf8');
    expect(indexHtml).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
  });
});

describe('if a verified rating is added, it stays consistent', () => {
  const verified = VERIFIED_GOOGLE_RATING !== null;

  it.runIf(verified)('carries a plausible value, a count and a check date', () => {
    const r = VERIFIED_GOOGLE_RATING!;
    expect(r.value).toBeGreaterThan(0);
    expect(r.value).toBeLessThanOrEqual(5);
    expect(r.count).toBeGreaterThan(0);
    expect(Number.isInteger(r.count)).toBe(true);
    // Forces whoever sets it to record when they actually looked.
    expect(r.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.runIf(verified)('is the only number the labels quote', () => {
    const r = VERIFIED_GOOGLE_RATING!;
    expect(GOOGLE_RATING_LABEL).toContain(String(r.value));
    expect(GOOGLE_RATING_ARIA_LABEL).toContain(String(r.value));
    expect(GOOGLE_RATING_ARIA_LABEL).toContain(String(r.count));
  });

  it.runIf(verified).each(SURFACES)('%s still hardcodes no rating of its own', (file) => {
    expect(readCode(file)).not.toMatch(/Rated\s+[0-5]\.\d/i);
  });
});

describe('the genuine review content is untouched', () => {
  it('still links to the real Google profile', () => {
    expect(read('components/Reviews.tsx'))
      .toContain("export const GOOGLE_PROFILE_LINK = 'https://share.google/tZEyXUs0J0SxXZlDi'");
  });

  it('still links to the real review-writing URL', () => {
    expect(read('components/Reviews.tsx')).toContain('https://g.page/r/');
  });
});
