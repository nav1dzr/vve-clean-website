// What the customer actually SEES about our Google rating.
//
// src/data/googleRating.test.ts scans source files for a written-out number.
// That caught "5.0" and missed the louder claim: a row of five filled gold
// stars beside a Google logo. It contains no digits, so a text scan passes it,
// and it was marked aria-hidden — which hides it from screen readers without
// making it any less of a claim to everyone else. Five filled stars *are*
// "5.0".
//
// These tests render the real components and assert on the rendered output, so
// they fail whichever way the claim comes back: as text, as an aria-label, or
// as pictures.

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import GoogleBadge from './GoogleBadge';
import Reviews from './Reviews';
import { SHOW_AGGREGATE_STARS, VERIFIED_GOOGLE_RATING } from '../data/googleRating';

const unverified = VERIFIED_GOOGLE_RATING === null;

/**
 * The largest number of sibling icons under any single parent.
 *
 * A star *rating* is always a run of icons in one container. A lone star on a
 * "Leave us a review" button is not. Counting siblings rather than looking for
 * a CSS class keeps this honest if the icon library, the colour utility or the
 * markup changes — the shape of a rating widget is what is being banned.
 */
function largestIconRun(container: HTMLElement): number {
  let largest = 0;
  for (const el of container.querySelectorAll('*')) {
    const svgKids = [...el.children].filter((c) => c.tagName.toLowerCase() === 'svg').length;
    if (svgKids > largest) largest = svgKids;
  }
  return largest;
}

/** Every accessible name in the tree, where a rating claim can also hide. */
function ariaText(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((el) => el.getAttribute('aria-label') ?? '')
    .join(' | ');
}

describe('the hero Google badge, while the rating is unverified', () => {
  it.runIf(unverified)('draws no star rating', () => {
    const { container } = render(<GoogleBadge />);
    expect(largestIconRun(container)).toBeLessThan(4);
  });

  it.runIf(unverified)('shows no number', () => {
    const { container } = render(<GoogleBadge />);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it.runIf(unverified)('still identifies itself as Google, and links there', () => {
    const { container } = render(<GoogleBadge />);
    // Neutral presentation, not a silent badge: the visitor is told what the
    // link is, and can go and read the reviews for themselves.
    expect(container.textContent).toMatch(/Google/i);
    expect(container.querySelector('a')?.getAttribute('href')).toContain('share.google');
  });

  it.runIf(unverified)('claims no rating in its accessible name', () => {
    const { container } = render(<GoogleBadge />);
    expect(ariaText(container)).not.toMatch(/\d/);
    expect(ariaText(container)).not.toMatch(/out of|star/i);
  });
});

describe('the reviews section, while the rating is unverified', () => {
  it.runIf(unverified)('draws no aggregate star row in its heading badge', () => {
    const { container } = render(<Reviews />);
    expect(largestIconRun(container)).toBeLessThan(4);
  });

  it.runIf(unverified)('shows no rating figure anywhere in the section', () => {
    const { container } = render(<Reviews />);
    expect(container.textContent).not.toMatch(/\b[0-5]\.\d\b/);
    expect(container.textContent).not.toMatch(/\d\s*(?:out of|\/)\s*5/i);
  });

  it.runIf(unverified)('claims no rating in any accessible name', () => {
    const { container } = render(<Reviews />);
    expect(ariaText(container)).not.toMatch(/Rated \d/i);
  });

  it('gives every review card no stars unless that card carries its own verified rating', () => {
    // Each card previously drew five filled stars regardless of what the
    // reviewer actually gave. Stars per card are now driven by a `rating` field
    // that must be read off the profile; none has been entered, so none show.
    const { container } = render(<Reviews />);
    expect(largestIconRun(container)).toBeLessThan(4);
  });

  it('keeps the real review text and the real profile link intact', () => {
    // De-claiming the rating must not quietly remove the genuine content.
    const { container } = render(<Reviews />);
    expect(container.textContent).toContain('Hannah M.');
    expect(container.textContent).toContain('Islington, N1');
    expect(container.textContent).toMatch(/Read our Google reviews/i);
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('share.google'))).toBe(true);
    expect(hrefs.some((h) => h.includes('g.page/r/'))).toBe(true);
  });
});

describe('once a rating is verified, the stars come back', () => {
  it('gates the star row on exactly the same condition as the number', () => {
    // One flag, so the two can never drift apart — the failure mode being
    // guarded is "we removed the digits and left the stars".
    expect(SHOW_AGGREGATE_STARS).toBe(VERIFIED_GOOGLE_RATING !== null);
  });

  it.runIf(!unverified)('renders the verified value beside them', () => {
    const { container } = render(<GoogleBadge />);
    expect(largestIconRun(container)).toBe(5);
    expect(container.textContent).toContain(String(VERIFIED_GOOGLE_RATING!.value));
  });
});
