// Reading order on the three priority service pages.
//
// The order is a conversion decision, not a styling detail: service selection
// and pricing first, genuine evidence early, reassurance next, deeper
// explanation later. A refactor that quietly moved the proof media back below
// the pricing table would not fail any other test in the suite, so it is pinned
// here — and pinned by reading the rendered document, not by inspecting the
// sectionOrder array, so it still fails if the layout stops honouring it.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import SofaCleaningPage from './SofaCleaningPage';
import CarpetCleaningPage from './CarpetCleaningPage';
import EndOfTenancyPage from './EndOfTenancyPage';

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

function renderPage(node: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

/**
 * Walks the rendered tree once and reports the document position of each
 * landmark. Most sections in ServiceLandingLayout carry no id, so a landmark is
 * either a CSS selector (`#quote`) or a heading's exact text.
 */
function locator(container: HTMLElement) {
  const all = [...container.querySelectorAll<HTMLElement>('*')];

  return {
    sel: (selector: string) => all.findIndex((el) => el.matches(selector)),
    heading: (text: string) => all.findIndex(
      (el) => /^H[1-3]$/.test(el.tagName) && (el.textContent ?? '').trim().startsWith(text),
    ),
  };
}

/** Asserts every landmark was found, and that they appear in the given order. */
function expectOrder(entries: [string, number][]) {
  for (const [label, pos] of entries) {
    expect(pos, `"${label}" was not found on the page`).toBeGreaterThan(-1);
  }
  for (let i = 1; i < entries.length; i += 1) {
    expect(
      entries[i][1],
      `"${entries[i][0]}" should come after "${entries[i - 1][0]}"`,
    ).toBeGreaterThan(entries[i - 1][1]);
  }
}

describe('Sofa & Upholstery page order', () => {
  it('runs hero → quote → results → extraction clip → reviews → benefits → process → gallery → intro → includes → pricing → FAQs → related → CTA', () => {
    const { container } = renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    const at = locator(container);

    expectOrder([
      ['hero', at.sel('h1')],
      ['quote', at.sel('#quote')],
      ['before/after results', at.sel('#results')],
      ['featured extraction clip', at.sel('#extraction')],
      ['reviews', at.sel('#reviews')],
      ['benefits', at.heading('Why customers book sofa cleaning with us')],
      ['process', at.sel('[aria-labelledby="sofa-process-heading"]')],
      ['supporting gallery', at.sel('#gallery')],
      ['intro', at.heading('Sofa cleaning that goes deeper than vacuuming')],
      ['what every clean includes', at.heading('What every sofa clean includes')],
      ['pricing', at.heading('Fixed sofa cleaning prices')],
      ['FAQs', at.heading('Common questions')],
      ['related', at.heading('Other services')],
      ['final CTA', at.heading('Ready to book your sofa clean?')],
    ]);
  });

  it('places both proof blocks above the pricing table, where they used to sit below it', () => {
    const { container } = renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    const at = locator(container);
    const pricing = at.heading('Fixed sofa cleaning prices');

    expect(at.sel('#results')).toBeLessThan(pricing);
    expect(at.sel('#extraction')).toBeLessThan(pricing);
    expect(at.sel('#gallery')).toBeLessThan(pricing);
  });

  it('shows each kind of proof exactly once — no duplicate gallery or reviews', () => {
    const { container } = renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');

    expect(container.querySelectorAll('#results')).toHaveLength(1);
    expect(container.querySelectorAll('#extraction')).toHaveLength(1);
    expect(container.querySelectorAll('#gallery')).toHaveLength(1);
    expect(container.querySelectorAll('#reviews')).toHaveLength(1);
  });

  it('keeps the upholstery quote reachable and working', () => {
    renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    expect(screen.getAllByText('3-seater sofa').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Book online/i }).length).toBeGreaterThan(0);
  });

  it('uses no duplicate element ids anywhere on the page', () => {
    const { container } = renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Carpet page order', () => {
  it('runs hero → quote → results → reviews → benefits → process footage → intro → includes → pricing', () => {
    const { container } = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    const at = locator(container);

    expectOrder([
      ['hero', at.sel('h1')],
      ['quote', at.sel('#quote')],
      ['results', at.sel('#results')],
      ['reviews', at.sel('#reviews')],
      ['benefits', at.heading('What makes our carpet cleaning different')],
      ['process footage', at.sel('#process')],
      ['what every clean includes', at.heading('What every carpet clean includes')],
      ['pricing', at.heading('Fixed carpet cleaning prices')],
    ]);
  });

  it('keeps its three before/after pairs and all four clips', () => {
    const { container } = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');

    expect(screen.getByText('Office carpet')).toBeInTheDocument();
    expect(screen.getByText('Blue bedroom carpet')).toBeInTheDocument();
    expect(screen.getByText('Brown carpet')).toBeInTheDocument();
    expect(container.querySelectorAll('video')).toHaveLength(4);
  });

  it('does not publish an unverified universal DBS claim', () => {
    const { container } = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    expect(container.textContent ?? '').not.toMatch(/DBS/);
  });

  it('keeps the carpet quote reachable and working', () => {
    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    expect(screen.getAllByText('Living / dining room').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Book online/i }).length).toBeGreaterThan(0);
  });

  it('uses no duplicate element ids anywhere on the page', () => {
    const { container } = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('End of Tenancy page order', () => {
  // The section order itself is unchanged by the Complete/Tailored wizard
  // migration; the assertions exist so future shared-layout edits cannot
  // regress it.
  it('runs hero → guided quote → proof → reviews → benefits → intro → includes → pricing', () => {
    const { container } = renderPage(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');
    const at = locator(container);

    expectOrder([
      ['hero', at.sel('h1')],
      ['guided quote', at.sel('#quote')],
      ['proof media', at.heading('See the difference')],
      ['reviews', at.sel('#reviews')],
      ['benefits', at.heading('Why tenants and landlords choose VVE Clean')],
      ['intro', at.heading('The clean your agent actually checks for')],
      ['what every clean includes', at.heading('What every Complete end of tenancy clean includes')],
      ['pricing', at.heading('Fixed end of tenancy cleaning prices')],
    ]);
  });

  it('keeps the premium guided quote and its gallery discovery intact', () => {
    const { container } = renderPage(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');
    expect(container.querySelector('#quote')).not.toBeNull();
    expect(screen.getByText('Kitchen hob')).toBeInTheDocument();
  });

  it('uses no duplicate element ids anywhere on the page', () => {
    const { container } = renderPage(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
