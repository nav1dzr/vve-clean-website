import { beforeAll, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
// Same import path src/entry-server.tsx uses, so this test exercises the
// exact renderer prerender.mjs runs at build time.
import { StaticRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';

import CarpetCleaningPage from '../pages/CarpetCleaningPage';
import SofaCleaningPage from '../pages/SofaCleaningPage';
import EndOfTenancyPage from '../pages/EndOfTenancyPage';
import AfterBuildersPage from '../pages/AfterBuildersPage';
import CommercialCarpetPage from '../pages/CommercialCarpetPage';
import HowWeCleanCarpetsPage from '../pages/HowWeCleanCarpetsPage';
import AreaPage from '../pages/AreaPage';
import BookingPage from '../pages/BookingPage';
import { AREAS } from '../data/areas';

// prerender.mjs server-renders every one of these routes to static HTML. The
// hero used to be wrapped in useReveal, which starts hidden and only becomes
// visible inside an effect — so the prerendered HTML shipped the H1 and both
// CTAs inside `opacity-0`, blank until the client bundle hydrated. These tests
// assert against the *server* output, because that is the artefact a first-time
// mobile visitor and a crawler actually receive.

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function ssr(path: string, page: React.ReactElement) {
  return renderToString(
    <StaticRouter location={path}>
      <CookieConsentProvider>{page}</CookieConsentProvider>
    </StaticRouter>,
  );
}

/** The markup from the start of the document up to and including the H1. */
function aboveTheFold(html: string) {
  const h1End = html.indexOf('</h1>');
  expect(h1End).toBeGreaterThan(-1);
  return html.slice(0, h1End);
}

const pages: [string, string, React.ReactElement][] = [
  ['carpet cleaning', '/carpet-cleaning-london', <CarpetCleaningPage />],
  ['sofa cleaning', '/sofa-cleaning-london', <SofaCleaningPage />],
  ['end of tenancy', '/end-of-tenancy-cleaning-london', <EndOfTenancyPage />],
  ['after builders', '/after-builders-cleaning-london', <AfterBuildersPage />],
  ['commercial carpet', '/commercial-carpet-cleaning-london', <CommercialCarpetPage />],
  ['how we clean carpets', '/how-we-clean-carpets', <HowWeCleanCarpetsPage />],
  ['area page', `/cleaning-${AREAS[0].slug}`, <AreaPage area={AREAS[0]} />],
];

describe('ServiceLandingLayout hero is painted by the prerendered HTML', () => {
  it.each(pages)('%s renders its H1 without opacity-0', (_name, path, page) => {
    const html = ssr(path, page);

    expect(html).toContain('<h1');
    expect(aboveTheFold(html)).not.toContain('opacity-0');
  });

  it.each(pages)('%s renders both hero CTAs without opacity-0', (_name, path, page) => {
    const html = ssr(path, page);

    // The hero CTA block sits between the H1 and the first section that
    // follows the hero, so slice from the H1 to the end of the hero <section>.
    const fromH1 = html.slice(html.indexOf('<h1'));
    const heroEnd = fromH1.indexOf('</section>');
    expect(heroEnd).toBeGreaterThan(-1);

    expect(fromH1.slice(0, heroEnd)).not.toContain('opacity-0');
  });
});

describe('below-the-fold reveal animations are preserved', () => {
  it('still ships reveal state for sections further down the page', () => {
    const html = ssr('/carpet-cleaning-london', <CarpetCleaningPage />);

    // Guards against "fixing" the hero by deleting useReveal everywhere.
    expect(html).toContain('opacity-0 translate-y-8');
  });
});

describe('standalone booking selector is visible in prerendered HTML', () => {
  it('does not hide the quote heading or selector behind opacity-0', () => {
    const html = ssr('/booking', <BookingPage />);
    const quoteStart = html.indexOf('Get Your');
    expect(quoteStart).toBeGreaterThan(-1);

    const quoteMarkup = html.slice(quoteStart, html.indexOf('</section>', quoteStart));
    expect(quoteMarkup).not.toContain('opacity-0');
  });
});
