import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AreaPage from './AreaPage';
import AreaProofSection from '../components/areas/AreaProofSection';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { AREAS, AREAS_BY_SLUG, type AreaInfo } from '../data/areas';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';
import { ROUTE_METADATA } from '../lib/routeMetadata';

function renderArea(area: AreaInfo) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <StaticRouter location={`/cleaning-${area.slug}`}>
      <CookieConsentProvider><AreaPage area={area} /></CookieConsentProvider>
    </StaticRouter>,
  );
  return container;
}

describe('local visitor journey in server-rendered pages', () => {
  it.each(AREAS)('$name keeps coverage, real destinations and direct confirmation usable before JavaScript loads', (area) => {
    const container = renderArea(area);
    const main = container.querySelector('main')!;
    const sticky = container.querySelector('nav[aria-label="Quick booking and help"]')!;
    const primary = sticky.querySelector('a')!;
    expect(primary.getAttribute('href')).toBe(area.coverageConfirmed === false
      ? main.querySelector('a[href^="https://wa.me/"]')!.getAttribute('href')
      : '#area-services');
    expect(primary.textContent).toContain(area.coverageConfirmed === false ? 'Check my postcode' : 'Choose my service');
    expect(main.textContent).toContain(BOOKING_REQUEST_NOTE);
    expect(main.textContent).not.toMatch(/confirm with £30|before you pay|payment confirms/i);
    expect(main.querySelectorAll('h1')).toHaveLength(1);
    expect(main.querySelector(`[aria-labelledby="${area.slug}-visit-heading"]`)).not.toBeNull();

    for (const link of main.querySelectorAll<HTMLAnchorElement>('a[href^="/cleaning-"]')) {
      const path = new URL(link.getAttribute('href')!, 'https://www.vveclean.co.uk').pathname;
      expect(ROUTE_METADATA.some((route) => route.path === path)).toBe(true);
    }
    if (area.coverageConfirmed !== false) {
      const services = main.querySelector('#area-services')!;
      expect(services).not.toBeNull();
      expect(services.textContent).toContain('Studio flat with one bathroom');
      expect(services.textContent).toContain('minimum visit');
      expect(main.textContent).toContain(`Clips from our work across London.`);
      const postcodes = main.querySelector(`[aria-label="${area.name} postcode districts"]`)!;
      expect([...postcodes.querySelectorAll('li')].map((item) => item.textContent)).toEqual(area.postcodes);
      for (const video of services.querySelectorAll('video')) {
        expect(video.getAttribute('preload')).toBe('none');
        expect(video.querySelector('source')).toBeNull();
      }
    }
  });

  it('keeps Highgate an availability enquiry, with working external actions and no claimed service coverage', () => {
    const container = renderArea(AREAS_BY_SLUG.highgate);
    const main = container.querySelector('main')!;
    expect(main.querySelector('#area-services')).toBeNull();
    expect(main.textContent).toContain('outside our currently published postcode list');
    expect(main.textContent).not.toContain('Complete from');
    const whatsappLinks = [...main.querySelectorAll<HTMLAnchorElement>('a[href^="https://wa.me/"]')];
    expect(whatsappLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of whatsappLinks) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(decodeURIComponent(link.href)).toContain('Highgate');
    }
    const schema = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((script) => {
        const data = JSON.parse(script.textContent ?? '{}');
        return data['@graph'] ?? [data];
      });
    expect(schema.some((node) => node['@type'] === 'Service')).toBe(false);
    expect(schema.some((node) => node['@type'] === 'FAQPage')).toBe(true);
  });

  it('does not label job notes as a customer review or publish empty proof sections', () => {
    expect(renderToString(<AreaProofSection area={AREAS_BY_SLUG.angel} />)).toBe('');
    const area = { ...AREAS_BY_SLUG.angel, jobNotes: ['Synthetic test note, not a published job.'] };
    const html = renderToString(<AreaProofSection area={area} />);
    expect(html).toContain('Our work in Angel');
    expect(html).not.toContain('customer review from');
  });
});