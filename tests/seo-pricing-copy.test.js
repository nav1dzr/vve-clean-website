import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROUTE_METADATA, NOT_FOUND_METADATA, metadataForPath } from '../src/lib/routeMetadata';
import { EOT_BASE_PRICES_P, MOVEIN_BASE_PRICES_P, AFTER_BUILDERS_START_FROM_P,
  CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, penceToDisplay } from '../src/data/pricing';

describe('shared search metadata prices', () => {
  it('does not duplicate a separate price list in the no-JavaScript template', () => {
    expect(readFileSync('index.html', 'utf8')).not.toContain('<noscript>');
  });
  it('qualifies the Complete studio example without implying Tailored has Complete inclusions', () => {
    const route = metadataForPath('/end-of-tenancy-cleaning-london');
    expect(route.description).toContain(`Studio flat Complete from ${penceToDisplay(EOT_BASE_PRICES_P.studio)} with one bathroom`);
    expect(route.ogDescription).toContain('selected-task Tailored');
  });
  it('states item prices together with the applicable visit minimum', () => {
    const carpet = metadataForPath('/carpet-cleaning-london');
    const sofa = metadataForPath('/sofa-cleaning-london');
    expect(carpet.description).toContain(penceToDisplay(CARPET_ITEM_PRICES_P.bedroom));
    expect(sofa.description).toContain(penceToDisplay(CARPET_ITEM_PRICES_P.sofa_2));
    for (const route of [carpet, sofa, metadataForPath('/pricing')]) {
      expect(route.description).toContain(`${penceToDisplay(CARPET_MIN_BOOKING_P)} visit minimum`);
    }
  });
  it('takes other starting examples from the same catalogue', () => {
    expect(metadataForPath('/pricing').ogDescription).toContain(`studio move-in from ${penceToDisplay(MOVEIN_BASE_PRICES_P.studio)}`);
    expect(metadataForPath('/after-builders-cleaning-london').description).toContain(`from ${penceToDisplay(AFTER_BUILDERS_START_FROM_P)}`);
  });
});

describe('complete route search descriptions', () => {
  it('gives every route and the missing-page state a usable title and description', () => {
    expect(ROUTE_METADATA).toHaveLength(37);
    for (const route of [...ROUTE_METADATA, NOT_FOUND_METADATA]) {
      expect(route.title.length, route.path).toBeGreaterThan(10);
      expect(route.description.length, route.path).toBeGreaterThan(20);
      expect(route.ogTitle, route.path).toBeTruthy();
      expect(route.ogDescription, route.path).toBeTruthy();
      expect(route.title.length, `${route.path}: ${route.title}`).toBeLessThanOrEqual(65);
      expect(route.description.length, `${route.path}: ${route.description}`).toBeLessThanOrEqual(165);
    }
  });
  it('keeps service and London terms in each service-page title', () => {
    const services = ROUTE_METADATA.filter((route) => route.path.endsWith('-london'));
    expect(services).toHaveLength(5);
    for (const route of services) expect(route.title).toMatch(/Cleaning London/);
  });
});
