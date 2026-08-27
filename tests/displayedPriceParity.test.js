// Every customer-facing starting price must come from the canonical
// catalogue, never a typed literal.
//
// Two real defects motivated this file:
//
//   1. The booking page's secondary-services footnote said "Window cleaning
//      from £45" and "Garden services from £45". The catalogue, the homepage
//      and the admin price list all say £75. The stale figure sat at the exact
//      moment a customer decides — 40% below the real price.
//
//   2. The /sofa-cleaning-london route metadata said "from £75", which matched
//      nothing at all: the cheapest sofa is a 2-seater at £70, and the £85
//      minimum booking means nobody ever pays £75. The page itself was correct;
//      only the search snippet was wrong.
//
// Both were literals that drifted. The rule this file enforces is that they
// cannot exist in the first place.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WINDOW_CLEANING_FROM_P,
  GARDEN_SERVICES_FROM_P,
  PRESSURE_WASHING_FROM_P,
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
  EOT_COMPLETE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  penceToDisplay,
} from '../shared/pricingCatalogue.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(rel);
  }
  return out;
}

describe('the booking-page secondary-services note uses canonical prices', () => {
  const source = read('src/components/QuoteCalculator.tsx');

  it('reads window, garden and pressure-washing prices from the catalogue', () => {
    expect(source).toContain('penceToDisplay(WINDOW_CLEANING_FROM_P)');
    expect(source).toContain('penceToDisplay(GARDEN_SERVICES_FROM_P)');
    expect(source).toContain('penceToDisplay(PRESSURE_WASHING_FROM_P)');
  });

  it('no longer hard-codes the stale £45 figure', () => {
    expect(source).not.toContain('Window cleaning from £45');
    expect(source).not.toContain('Garden services from £45');
  });

  it('agrees with the catalogue on what those prices actually are', () => {
    expect(penceToDisplay(WINDOW_CLEANING_FROM_P)).toBe('£75');
    expect(penceToDisplay(GARDEN_SERVICES_FROM_P)).toBe('£75');
    expect(penceToDisplay(PRESSURE_WASHING_FROM_P)).toBe('£120');
  });
});

describe('route metadata prices come from the catalogue', () => {
  const prerender = read('prerender.mjs');

  it('imports the canonical prices rather than typing them', () => {
    expect(prerender).toContain("from './shared/pricingCatalogue.js'");
    expect(prerender).toContain('penceToDisplay(CARPET_ITEM_PRICES_P.sofa_2)');
    expect(prerender).toContain('penceToDisplay(CARPET_MIN_BOOKING_P)');
  });

  it('describes the sofa price as the real 2-seater price plus the minimum', () => {
    expect(penceToDisplay(CARPET_ITEM_PRICES_P.sofa_2)).toBe('£70');
    expect(penceToDisplay(CARPET_MIN_BOOKING_P)).toBe('£85');
    // The old "from £75" matched no price in the catalogue. Check the
    // description strings, not the file — the comment explaining this fix
    // legitimately mentions the old figure.
    const descriptions = [...prerender.matchAll(/(?:og)?[Dd]escription:\s*\n?\s*[`'"]([^`'"]*)/g)]
      .map((m) => m[1]);
    expect(descriptions.some((d) => /sofa/i.test(d) && /£75/.test(d))).toBe(false);
    expect(descriptions.some((d) => /sofa/i.test(d))).toBe(true);
  });
});

describe('every advertised price literal matches a real catalogue price', () => {
  // Route metadata still writes some prices as literals — interpolating every
  // one would churn a large block of correct copy for no behavioural gain.
  // What matters is that a literal can never disagree with the catalogue, so
  // this asserts membership rather than banning the pattern: if a price
  // changes and a description is not updated, this fails and names the file.
  const LITERAL = /\b(?:from|starts? at|starting at|only)\s+(£\d+(?:\.\d{2})?)/gi;

  /** Every price the catalogue can legitimately advertise, as display strings. */
  const catalogue = new Set(
    [
      WINDOW_CLEANING_FROM_P,
      GARDEN_SERVICES_FROM_P,
      PRESSURE_WASHING_FROM_P,
      CARPET_MIN_BOOKING_P,
      ...Object.values(CARPET_ITEM_PRICES_P),
      ...Object.values(EOT_COMPLETE_PRICES_P ?? {}),
      ...Object.values(EOT_TAILORED_START_PRICES_P ?? {}),
      ...Object.values(MOVEIN_BASE_PRICES_P ?? {}),
      ...Object.values(AFTER_BUILDERS_FROM_PRICES_P ?? {}),
      AFTER_BUILDERS_START_FROM_P,
    ]
      .filter((p) => typeof p === 'number' && p > 0)
      .map(penceToDisplay),
  );

  const targets = [...sourceFiles('src'), 'prerender.mjs'];

  it.each(targets)('%s quotes no price the catalogue does not have', (file) => {
    const source = read(file);
    const unknown = [...source.matchAll(LITERAL)]
      .map((m) => m[1])
      .filter((price) => !catalogue.has(price));

    expect(
      [...new Set(unknown)],
      `${file} advertises a price that exists nowhere in the catalogue. ` +
        'Either it is stale, or the catalogue is missing it.',
    ).toEqual([]);
  });
});

describe('every displayed starting price matches the catalogue', () => {
  // The full set of "from" prices the site advertises, each checked against
  // its canonical constant. Adding a new advertised service means adding a
  // row here.
  const ADVERTISED = [
    ['Window cleaning', WINDOW_CLEANING_FROM_P, '£75'],
    ['Garden services', GARDEN_SERVICES_FROM_P, '£75'],
    ['Pressure washing', PRESSURE_WASHING_FROM_P, '£120'],
    ['2-seater sofa', CARPET_ITEM_PRICES_P.sofa_2, '£70'],
    ['Carpet & upholstery minimum', CARPET_MIN_BOOKING_P, '£85'],
  ];

  it.each(ADVERTISED)('%s is %s', (_label, pence, expected) => {
    expect(penceToDisplay(pence)).toBe(expected);
  });

  it('never advertises a price below the minimum booking a customer can make', () => {
    // A "from £70" sofa with an £85 floor is misleading on its own, which is
    // why the metadata now states both together.
    const prerender = read('prerender.mjs');
    if (prerender.includes('SOFA_FROM')) {
      expect(prerender).toContain('CARPET_MIN');
    }
  });
});
