import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { AREAS, AREAS_BY_SLUG } from './areas';
import { COVERAGE_POSTCODES } from '../../shared/pricingCatalogue.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const areasComponent = readFileSync(resolve(root, 'src/components/Areas.tsx'), 'utf8');
const areaMarquee = readFileSync(resolve(root, 'src/components/AreaMarquee.tsx'), 'utf8');
const prerender = readFileSync(resolve(root, 'prerender.mjs'), 'utf8');
const appRoutes = readFileSync(resolve(root, 'src/AppRoutes.tsx'), 'utf8');

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

  it('is wired into prerender.mjs so every area gets a real route entry', () => {
    expect(prerender).toContain('for (const area of AREAS)');
    expect(prerender).toContain('/cleaning-${area.slug}');
  });
});
