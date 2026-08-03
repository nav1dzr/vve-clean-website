// Customer-visible price claims outside React must match the canonical
// catalogue.
//
// Neither the no-JavaScript fallback in index.html nor the prerendered meta
// descriptions import pricing.ts, so nothing stopped them drifting. They had:
//   - "End of tenancy cleaning — from £199", while EOT_BASE_PRICES_P.studio
//     is £229 and the /pricing table itself renders £229;
//   - "Carpet & upholstery — from £90", a legacy per-property figure the
//     itemised carpet engine no longer uses.
//
// This reads the real files and compares against the real constants, so the
// next edit that invents a price fails here rather than reaching a customer.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  EOT_BASE_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
} from '../src/data/pricing.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
const prerender = readFileSync(resolve(root, 'prerender.mjs'), 'utf8');

const gbp = (pence) => `£${pence / 100}`;

// The lowest price a customer can actually be charged for each headline
// service, straight from the catalogue.
const FROM = {
  eot: gbp(EOT_BASE_PRICES_P.studio),          // £229
  moveIn: gbp(MOVEIN_BASE_PRICES_P.studio),    // £179
  afterBuilders: gbp(AFTER_BUILDERS_START_FROM_P), // £249
  carpetRoom: gbp(CARPET_ITEM_PRICES_P.bedroom),   // £50
  sofa: gbp(CARPET_ITEM_PRICES_P.sofa_2),          // £75
  carpetMinimum: gbp(CARPET_MIN_BOOKING_P),        // £85
};

describe('no-JavaScript fallback quotes the catalogue', () => {
  const noscript = indexHtml.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];

  it.each([
    ['end of tenancy', FROM.eot],
    ['move-in deep clean', FROM.moveIn],
    ['after builders', FROM.afterBuilders],
  ])('states the correct %s price (%s)', (_label, price) => {
    expect(noscript).toContain(price);
  });

  it('describes carpet by its real per-item pricing and minimum', () => {
    expect(noscript).toContain(FROM.carpetRoom);
    expect(noscript).toContain(FROM.sofa);
    expect(noscript).toContain(FROM.carpetMinimum);
  });

  it('no longer carries the superseded figures', () => {
    expect(noscript).not.toContain('£199');
    expect(noscript).not.toMatch(/upholstery — from £90/);
  });
});

describe('prerendered metadata quotes the catalogue', () => {
  it('uses the correct end-of-tenancy entry price', () => {
    expect(prerender).toContain(`End of tenancy from ${FROM.eot}`);
    expect(prerender).not.toContain('£199');
  });

  it('uses per-item carpet pricing rather than a legacy per-property figure', () => {
    expect(prerender).toContain(`carpet rooms from ${FROM.carpetRoom}`);
    expect(prerender).not.toMatch(/carpet from £90/);
  });

  it('keeps the after-builders and move-in entry prices correct', () => {
    expect(prerender).toContain(`after builders from ${FROM.afterBuilders}`);
    expect(prerender).toContain(`move-in from ${FROM.moveIn}`);
  });
});

describe('titles and descriptions stay inside what search results render', () => {
  const routes = [...prerender.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
  const titles = [...prerender.matchAll(/^\s{4}title:\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]);
  const descriptions = [...prerender.matchAll(/^\s{4}description:\s*\n?\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]);

  it('found a title and description for all 13 routes', () => {
    expect(routes).toHaveLength(13);
    expect(titles).toHaveLength(13);
    expect(descriptions).toHaveLength(13);
  });

  it('keeps every title at or under 65 characters', () => {
    const tooLong = titles.filter((t) => t.length > 65).map((t) => `${t.length}: ${t}`);
    expect(tooLong).toEqual([]);
  });

  it('keeps every description at or under 165 characters', () => {
    const tooLong = descriptions.filter((d) => d.length > 165).map((d) => `${d.length}: ${d.slice(0, 60)}…`);
    expect(tooLong).toEqual([]);
  });

  it('keeps the service and London keywords in every service-page title', () => {
    const serviceTitles = titles.filter((t) => /Carpet|Sofa|End of Tenancy|After Builders|Commercial/i.test(t));
    expect(serviceTitles.length).toBeGreaterThanOrEqual(5);
    serviceTitles.forEach((t) => expect(t).toMatch(/London/));
  });
});
