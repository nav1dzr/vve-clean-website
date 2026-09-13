import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { AREAS, AREAS_BY_SLUG } from './areas';
import { COVERAGE_POSTCODES } from '../../shared/pricingCatalogue.js';
import { ROUTE_METADATA } from '../lib/routeMetadata';
import { areaHasRealProof } from '../lib/areaProof';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const areasComponent = readFileSync(resolve(root, 'src/components/Areas.tsx'), 'utf8');
const areaMarquee = readFileSync(resolve(root, 'src/components/AreaMarquee.tsx'), 'utf8');
const prerender = readFileSync(resolve(root, 'prerender.mjs'), 'utf8');
const appRoutes = readFileSync(resolve(root, 'src/routeDefinitions.tsx'), 'utf8');

// Regression guard for docs/LOCATION_PAGES_ASSESSMENT.md's core rule: an area
// page may only assert facts that are actually true. These tests read the
// real, independent sources of truth rather than trusting areas.ts itself.
describe('AREAS data integrity', () => {
  it('has 15 areas, each with a unique slug', () => {
    expect(AREAS).toHaveLength(15);
    const slugs = AREAS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only asserts postcodes that are in the canonical coverage list', () => {
    for (const area of AREAS) {
      for (const postcode of area.postcodes) {
        expect(COVERAGE_POSTCODES, `${area.name}'s postcode ${postcode}`).toContain(postcode);
      }
    }
  });

  it('only lists neighbouring areas that are already published in Areas.tsx or AreaMarquee.tsx', () => {
    for (const area of AREAS) {
      for (const neighbour of area.neighbourAreas) {
        const published = areasComponent.includes(`'${neighbour}'`) || areaMarquee.includes(`'${neighbour}'`);
        expect(published, `${area.name}'s neighbour "${neighbour}" is not published elsewhere`).toBe(true);
      }
    }
  });

  it('AREAS_BY_SLUG indexes every area', () => {
    for (const area of AREAS) {
      expect(AREAS_BY_SLUG[area.slug]).toBe(area);
    }
  });

  it('is wired into routing (AppRoutes.tsx generates a route per area)', () => {
    expect(appRoutes).toContain('AREAS.map');
    expect(appRoutes).toContain('/cleaning-${area.slug}');
  });

  it('generates exactly one prerender metadata entry for every area with the correct index status', () => {
    const routes = ROUTE_METADATA.filter((route) => route.path.startsWith('/cleaning-'));
    expect(routes.map((route) => route.path).sort()).toEqual(
      AREAS.map((area) => `/cleaning-${area.slug}`).sort(),
    );
    for (const area of AREAS) {
      const route = routes.find((entry) => entry.path === `/cleaning-${area.slug}`)!;
      expect(route.title).toContain(area.name);
      expect(route.description).toContain(area.name);
      expect(route.canonical).toBe(`https://www.vveclean.co.uk/cleaning-${area.slug}`);
      expect(route.robots).toBe(areaHasRealProof(area) ? 'index, follow' : 'noindex, follow');
    }
    // The build consumes the compiled shared inventory, rather than keeping
    // a second area loop that could drift from client-navigation metadata.
    expect(prerender).toContain('ROUTE_METADATA: routes');
    expect(prerender).toContain("await import('./dist/server/entry-server.js')");
  });
});
