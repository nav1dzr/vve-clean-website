// Which area pages are indexable, asserted against the code rather than
// against a document that can go stale.
//
// Two owner-facing documents claimed Angel was indexable because it shares
// Islington's N1 postcode district. It is not, and never was: matchesNamedArea
// requires an exact named-area match, deliberately, so an area cannot inherit
// a neighbour's review. The code was right and the documentation was wrong —
// which is exactly the direction that is hardest to notice.
//
// This file pins the real set and makes the owner-facing documents agree
// with it.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS } from '../src/data/areas';
import { areaHasRealProof } from '../src/lib/areaProof';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/** The areas the code says have real proof, computed the way prerender does. */
const indexable = AREAS.filter(areaHasRealProof).map((a) => a.slug).sort();

describe('area indexability is computed, not asserted', () => {
  it('is exactly Islington and Stratford today', () => {
    expect(indexable).toEqual(['islington', 'stratford']);
  });

  it('leaves the other 13 areas without proof', () => {
    expect(AREAS).toHaveLength(15);
    expect(AREAS.length - indexable.length).toBe(13);
  });

  // The specific bug: N1 is shared, the review is not.
  it('does not let Angel inherit Islington\'s review through a shared postcode', () => {
    const angel = AREAS.find((a) => a.slug === 'angel');
    const islington = AREAS.find((a) => a.slug === 'islington');

    expect(angel).toBeDefined();
    expect(angel.postcodes).toContain('N1');
    expect(islington.postcodes).toContain('N1');

    expect(areaHasRealProof(islington)).toBe(true);
    expect(areaHasRealProof(angel)).toBe(false);
  });
});

describe('owner-facing documents agree with the code', () => {
  const docs = [
    'OWNER_REVIEW_QUEUE.md',
    'OWNER_PAGE_REVIEW.md',
    'docs/LOCATION_PAGES_ASSESSMENT.md',
  ];

  it.each(docs)('%s does not claim Angel is indexable', (doc) => {
    const text = read(doc);
    // Allowed: naming Angel while explaining that it is NOT indexable.
    const claimsIndexable =
      /Indexable[^.\n]*\bAngel\b/i.test(text) ||
      /\bAngel\b[^.\n]*\bis indexable\b/i.test(text);

    expect(claimsIndexable, `${doc} still lists Angel as indexable`).toBe(false);
  });

  it.each(docs)('%s names the correct two indexable areas', (doc) => {
    const text = read(doc);
    expect(text).toMatch(/Islington/);
    expect(text).toMatch(/Stratford/);
  });

  it('the queue states the right noindex count', () => {
    const text = read('OWNER_REVIEW_QUEUE.md');
    // 13 of 15, not 12.
    expect(text).toMatch(/13 of the 15/);
    expect(text).not.toMatch(/12 of the 15/);
  });
});

describe('the build agrees with the code', () => {
  const dist = resolve(root, 'dist');
  const built = existsSync(dist);

  it.runIf(built)('marks only the proven areas index, follow', () => {
    const indexed = AREAS.filter((a) => {
      const file = resolve(dist, `cleaning-${a.slug}`, 'index.html');
      return existsSync(file) && readFileSync(file, 'utf8').includes('content="index, follow"');
    }).map((a) => a.slug).sort();

    expect(indexed).toEqual(indexable);
  });

  it.runIf(built)('lists only the proven areas in the sitemap', () => {
    const sitemap = read('dist/sitemap.xml');
    const listed = AREAS.filter((a) => sitemap.includes(`/cleaning-${a.slug}<`))
      .map((a) => a.slug)
      .sort();

    expect(listed).toEqual(indexable);
  });
});
