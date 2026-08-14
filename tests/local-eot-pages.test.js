// Discovery/indexing proof for the five local end of tenancy pages: they are
// registered as real routes, statically prerendered with canonical/sitemap
// entries, and their metadata carries the canonical price and no prohibited
// unsupported claims from the source template.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EOT_BASE_PRICES_P } from '../src/data/pricing.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const prerender = read('prerender.mjs');
const appRoutes = read('src/AppRoutes.tsx');

const LOCAL_PATHS = [
  '/end-of-tenancy-cleaning-islington',
  '/end-of-tenancy-cleaning-camden',
  '/end-of-tenancy-cleaning-hackney',
  '/end-of-tenancy-cleaning-stratford',
  '/end-of-tenancy-cleaning-walthamstow',
];

const gbp = (pence) => `£${pence / 100}`;

describe('local end of tenancy pages — route registration', () => {
  it('registers all five routes via the shared LOCAL_EOT_AREAS data', () => {
    expect(appRoutes).toContain("import LocalEndOfTenancyPage from './pages/LocalEndOfTenancyPage'");
    expect(appRoutes).toContain("import { LOCAL_EOT_AREAS } from './data/localEotAreas'");
    expect(appRoutes).toContain('LOCAL_EOT_AREAS.map');
  });
});

describe('local end of tenancy pages — prerendering, canonicals and sitemap', () => {
  it.each(LOCAL_PATHS)('%s is a prerendered, indexable route with a title and description', (path) => {
    const start = prerender.indexOf(`path: '${path}'`);
    expect(start, `${path} is missing from prerender.mjs`).toBeGreaterThan(-1);
    const block = prerender.slice(start, start + 900);
    expect(block).not.toContain('noindex');
    expect(block).toMatch(/title:\s*'[^']+'/);
    expect(block).toMatch(/description:\s*\n?\s*['"][^'"]+['"]/);
  });

  it.each(LOCAL_PATHS)('%s quotes the canonical starting price', (path) => {
    const start = prerender.indexOf(`path: '${path}'`);
    const block = prerender.slice(start, start + 900);
    expect(block).toContain(gbp(EOT_BASE_PRICES_P.studio));
  });

  it('will be included in the generated sitemap (indexable, has sources)', () => {
    for (const path of LOCAL_PATHS) {
      const start = prerender.indexOf(`path: '${path}'`);
      const block = prerender.slice(start, start + 900);
      expect(block).toMatch(/sources:\s*\[/);
    }
  });

  it('does not use the attachment template\'s apex-domain canonical form', () => {
    for (const path of LOCAL_PATHS) {
      const start = prerender.indexOf(`path: '${path}'`);
      const block = prerender.slice(start, start + 900);
      expect(block).not.toContain('https://vveclean.co.uk');
    }
  });
});

describe('local end of tenancy pages — no prohibited unsupported claims in prerendered metadata', () => {
  const PROHIBITED = [
    /full deposit back/i,
    /5\.0 google rating/i,
    /\bhundreds\b/i,
    /over 150/i,
    /less than 2%/i,
    /next-day/i,
    /same-day/i,
    /pay £30 to secure your slot/i,
    /most companies charge/i,
    /we regularly clean/i,
    /teams are based in/i,
    /up to 50%/i,
  ];

  it.each(LOCAL_PATHS)('%s carries none of the banned template phrases', (path) => {
    const start = prerender.indexOf(`path: '${path}'`);
    const nextRouteMatch = prerender.slice(start + 10).search(/\n  \{\n\s*path:/);
    const end = nextRouteMatch === -1 ? start + 1200 : start + 10 + nextRouteMatch;
    const block = prerender.slice(start, end);
    for (const phrase of PROHIBITED) {
      expect(block).not.toMatch(phrase);
    }
  });
});
