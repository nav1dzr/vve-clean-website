import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';

import CarpetCleaningPage from './CarpetCleaningPage';
import SofaCleaningPage from './SofaCleaningPage';
import EndOfTenancyPage from './EndOfTenancyPage';
import AfterBuildersPage from './AfterBuildersPage';
import CommercialCarpetPage from './CommercialCarpetPage';
import CommercialPage from './CommercialPage';
import PricingPage from './PricingPage';
import ContactPage from './ContactPage';
import FaqPage from './FaqPage';
import HowWeCleanCarpetsPage from './HowWeCleanCarpetsPage';
import HowWeCleanSofasPage from './HowWeCleanSofasPage';
import HowWeCleanEndOfTenancyPage from './HowWeCleanEndOfTenancyPage';
import AreaPage from './AreaPage';
import { AREAS } from '../data/areas';

// Generalised guard for docs/BRAND_AND_UI_GUIDE.md ("Show FAQ text visibly
// whenever FAQ structured data is present") and design-system/vve-clean/
// MASTER.md ("Visible accordion text and FAQ structured data must match
// exactly").
//
// Six pages previously maintained two hand-written FAQ literals — one for the
// visible accordion and one for the FAQPage schema — and the two had drifted.
// On the end of tenancy page the schema copy of the re-clean guarantee had
// lost its exclusions, and on the commercial carpet page the schema still
// carried a client-base and invoicing claim the visible copy had already
// dropped. Every page now derives both from one array; this test fails if any
// page reintroduces a second source.

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

/** Every FAQPage node in the document, from bare objects, arrays and @graph. */
function collectFaqEntities(container: HTMLElement) {
  const scripts = [...container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')];
  const entities: { name: string; text: string }[] = [];

  for (const script of scripts) {
    const parsed = JSON.parse(script.textContent ?? '{}');
    const nodes: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : (parsed['@graph'] as Record<string, unknown>[] | undefined) ?? [parsed];

    for (const node of nodes) {
      if (node?.['@type'] !== 'FAQPage') continue;
      const mainEntity = (node.mainEntity ?? []) as {
        name: string;
        acceptedAnswer?: { text?: string };
      }[];
      for (const question of mainEntity) {
        entities.push({ name: question.name, text: question.acceptedAnswer?.text ?? '' });
      }
    }
  }

  return entities;
}

/**
 * Visible question/answer pairs, read from the <details> accordions the site
 * uses everywhere. Markup-agnostic on purpose: the shared
 * ServiceLandingLayout/FAQ accordion wraps its text in .faq-question and
 * .faq-answer, while PricingPage styles its own <details>. Both are covered so
 * a page cannot escape this guard by rolling its own markup. Decorative
 * aria-hidden icons ("+") are stripped before comparing.
 */
function collectVisibleFaqs(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('details:not([data-disclosure])')].map((item) => {
    const summary = item.querySelector('summary');

    const questionNode = item.querySelector('.faq-question') ?? summary;
    const questionClone = questionNode?.cloneNode(true) as HTMLElement | undefined;
    questionClone?.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());

    const answerNode = item.querySelector('.faq-answer');
    let answerText: string;
    if (answerNode) {
      answerText = answerNode.textContent?.trim() ?? '';
    } else {
      const bodyClone = item.cloneNode(true) as HTMLElement;
      bodyClone.querySelector('summary')?.remove();
      answerText = bodyClone.textContent?.trim() ?? '';
    }

    return { name: questionClone?.textContent?.trim() ?? '', text: answerText };
  });
}

function renderPage(path: string, page: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{page}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

const pages: [string, string, React.ReactElement][] = [
  ['carpet cleaning', '/carpet-cleaning-london', <CarpetCleaningPage />],
  ['sofa cleaning', '/sofa-cleaning-london', <SofaCleaningPage />],
  ['end of tenancy', '/end-of-tenancy-cleaning-london', <EndOfTenancyPage />],
  ['after builders', '/after-builders-cleaning-london', <AfterBuildersPage />],
  ['commercial carpet', '/commercial-carpet-cleaning-london', <CommercialCarpetPage />],
  ['commercial', '/commercial', <CommercialPage />],
  ['pricing', '/pricing', <PricingPage />],
  ['contact', '/contact', <ContactPage />],
  ['faq', '/faq', <FaqPage />],
  ['how we clean carpets', '/how-we-clean-carpets', <HowWeCleanCarpetsPage />],
  ['how we clean sofas', '/how-we-clean-sofas-upholstery', <HowWeCleanSofasPage />],
  ['how we clean end of tenancy', '/how-we-clean-end-of-tenancy', <HowWeCleanEndOfTenancyPage />],
];

describe('FAQ schema parity — every question and answer in schema is visible on the page', () => {
  it.each(pages)('%s', (_name, path, page) => {
    const { container } = renderPage(path, page);

    const schemaFaqs = collectFaqEntities(container);
    const visibleFaqs = collectVisibleFaqs(container);

    // A page may legitimately have no FAQ schema; if it has some, it must be
    // backed one-for-one by visible text.
    if (schemaFaqs.length === 0) return;

    expect(visibleFaqs.length).toBeGreaterThan(0);
    expect(schemaFaqs.map((faq) => faq.name)).toEqual(visibleFaqs.map((faq) => faq.name));
    expect(schemaFaqs.map((faq) => faq.text)).toEqual(visibleFaqs.map((faq) => faq.text));
  });
});

describe('FAQ schema parity — area pages', () => {
  it.each(AREAS.map((area) => [area.name, area] as const))('%s', (_name, area) => {
    const { container } = renderPage(`/cleaning-${area.slug}`, <AreaPage area={area} />);

    const schemaFaqs = collectFaqEntities(container);
    const visibleFaqs = collectVisibleFaqs(container);

    expect(schemaFaqs.length).toBeGreaterThan(0);
    expect(schemaFaqs.map((faq) => faq.name)).toEqual(visibleFaqs.map((faq) => faq.name));
    expect(schemaFaqs.map((faq) => faq.text)).toEqual(visibleFaqs.map((faq) => faq.text));
  });
});

describe('FAQ answers that must keep their limits', () => {
  it('keeps the re-clean guarantee exclusions in both the visible answer and the schema', () => {
    const { container } = renderPage('/end-of-tenancy-cleaning-london', <EndOfTenancyPage />);

    const guaranteeSchema = collectFaqEntities(container).find((faq) => faq.name.includes('re-clean guarantee'));
    expect(guaranteeSchema).toBeDefined();

    for (const limit of [
      'does not cover permanent damage',
      'wear and tear',
      'permanent stains',
      'new mess created after the team leaves',
    ]) {
      expect(guaranteeSchema?.text).toContain(limit);
    }

    const guaranteeVisible = collectVisibleFaqs(container).find((faq) => faq.name.includes('re-clean guarantee'));
    expect(guaranteeVisible?.text).toBe(guaranteeSchema?.text);
  });

  it('never promises complete stain removal on the sofa page', () => {
    const { container } = renderPage('/sofa-cleaning-london', <SofaCleaningPage />);

    const stains = collectFaqEntities(container).find((faq) => faq.name.includes('stains'));
    expect(stains?.text).toContain('never guarantee complete stain removal');
  });
});
