// Focused proof for the five implemented local end of tenancy pages.
//
// Covers: unique H1/opening per area, exactly six visible FAQs, exactly
// three valid nearby links, exactly two approved review cards with unaltered
// attribution, canonical pricing parity with the main EOT page, valid
// JSON-LD with the required graph members and none of the banned ones, and
// no prohibited unsupported phrases from the source template.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../AppRoutes';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';
import { LOCAL_EOT_AREAS } from '../data/localEotAreas';
import { EOT_BASE_PRICES_P, EOT_TAILORED_START_PRICES_P } from '../data/pricing';
import { REVIEWS } from '../data/reviews';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>
        <BookingProvider>
          <AppRoutes />
        </BookingProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

const PROHIBITED_PHRASES = [
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

describe.each(LOCAL_EOT_AREAS)('local EOT page: $areaName ($postcode)', (area) => {
  it('renders the correct unique H1 and local opening paragraph', () => {
    renderAt(area.path);
    expect(screen.getByRole('heading', { level: 1, name: new RegExp(area.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
    const text = document.body.textContent || '';
    expect(text).toContain(area.landmarks[0]);
    expect(text).toContain(area.landmarks[1]);
  });

  it('shows exactly six visible FAQs', () => {
    renderAt(area.path);
    expect(document.querySelectorAll('.faq-item')).toHaveLength(6);
  });

  it('shows exactly three nearby local links, all to real implemented routes', () => {
    renderAt(area.path);
    const validPaths = new Set(LOCAL_EOT_AREAS.map((a) => a.path));
    const nearbyLinks = area.nearbySlugs.map((slug) => {
      const target = LOCAL_EOT_AREAS.find((a) => a.slug === slug)!;
      return screen.getByRole('link', { name: new RegExp(`End of Tenancy Cleaning in ${target.areaName}`) });
    });
    expect(nearbyLinks).toHaveLength(3);
    nearbyLinks.forEach((link) => {
      const href = link.getAttribute('href')!;
      expect(validPaths.has(href)).toBe(true);
      expect(href).not.toBe(area.path);
    });
  });

  it('shows exactly two approved review cards with unaltered attribution and no invented stars', () => {
    const { container } = renderAt(area.path);
    const section = container.querySelector('[aria-label="Recent customer feedback"]');
    expect(section).not.toBeNull();
    const cards = (section as HTMLElement).querySelectorAll('.grid > div');
    expect(cards).toHaveLength(2);
    area.reviewNames.forEach((name, i) => {
      const review = REVIEWS.find((r) => r.name === name)!;
      const scoped = within(cards[i] as HTMLElement);
      expect(scoped.getByText(review.text, { exact: false })).toBeInTheDocument();
      expect(scoped.getByText(review.location, { exact: false })).toBeInTheDocument();
    });
    // No fabricated star rating widget: only the two Google logos, one per
    // card — a star-rating row would be a run of several sibling icons.
    expect((section as HTMLElement).querySelectorAll('svg')).toHaveLength(2);
  });

  it('sources pricing from the canonical EOT data and matches the main EOT page', () => {
    renderAt(area.path);
    const text = document.body.textContent || '';
    expect(text).toContain(`£${EOT_BASE_PRICES_P.studio / 100}`);
    expect(text).toContain(`£${EOT_TAILORED_START_PRICES_P.studio / 100}`);
  });

  it('contains valid JSON-LD with BreadcrumbList, the one real business identity, Service areaServed and FAQPage — no AggregateRating/Review/fake branch/geo', () => {
    const { container } = renderAt(area.path);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.innerHTML);
    const graph = parsed['@graph'];
    expect(Array.isArray(graph)).toBe(true);

    const breadcrumb = graph.find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
    expect(breadcrumb).toBeTruthy();
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[0].name).toBe('Home');
    expect(breadcrumb.itemListElement[1].name).toBe('End of Tenancy Cleaning London');

    const business = graph.find((n: { '@type': string }) => n['@type'] === 'LocalBusiness');
    expect(business).toBeTruthy();
    expect(business['@id']).toBe('https://www.vveclean.co.uk/#business');
    expect(business.name).toBe('VVE Clean');
    expect(business.address.streetAddress).toContain('Queensway');
    expect(business.address.postalCode).toBe('W2 4QP');
    expect(business.geo).toBeUndefined();

    const service = graph.find((n: { '@type': string }) => n['@type'] === 'Service');
    expect(service).toBeTruthy();
    expect(service.provider['@id']).toBe('https://www.vveclean.co.uk/#business');
    expect(service.areaServed.name).toContain(area.areaName);
    expect(service.areaServed.name).toContain(area.postcode);
    expect(service.offers.length).toBeGreaterThan(0);

    const faqPage = graph.find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    expect(faqPage).toBeTruthy();
    expect(faqPage.mainEntity).toHaveLength(6);
    const visibleQs = [...document.querySelectorAll('.faq-question')].map((el) => el.textContent);
    expect(faqPage.mainEntity.map((q: { name: string }) => q.name)).toEqual(visibleQs);

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('AggregateRating');
    expect(serialized).not.toMatch(/"@type":\s*"Review"/);
    expect(serialized).not.toContain('GeoCoordinates');
    expect(serialized).not.toMatch(/VVE Clean\s*—\s*\w+/); // no branch-style business name
  });

  it('never states a prohibited unsupported claim', () => {
    renderAt(area.path);
    const text = document.body.textContent || '';
    for (const phrase of PROHIBITED_PHRASES) {
      expect(text).not.toMatch(phrase);
    }
  });
});

describe('local EOT pages — unique per-area content', () => {
  it('every H1 and opening paragraph is unique across all five pages', () => {
    const h1s = new Set(LOCAL_EOT_AREAS.map((a) => a.h1));
    const openings = new Set(LOCAL_EOT_AREAS.map((a) => a.openingParagraph));
    expect(h1s.size).toBe(LOCAL_EOT_AREAS.length);
    expect(openings.size).toBe(LOCAL_EOT_AREAS.length);
  });

  it('every opening paragraph is within the 150-200 word target', () => {
    for (const area of LOCAL_EOT_AREAS) {
      const words = area.openingParagraph.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(150);
      expect(words).toBeLessThanOrEqual(210);
    }
  });
});
