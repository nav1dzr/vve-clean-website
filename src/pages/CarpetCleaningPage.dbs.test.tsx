// The DBS credential must appear exactly once on the Carpet page.
//
// It was stated twice: in the hero credential chip under the Google rating,
// and again a few hundred pixels below in the quote calculator's trust strip.
// The hero one is the keeper. Suppression is scoped to carpet mode, so this
// file also pins that every other surface still shows all five trust items.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CarpetCleaningPage from './CarpetCleaningPage';
import SofaCleaningPage from './SofaCleaningPage';
import QuoteCalculator from '../components/QuoteCalculator';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';

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

const DBS = /DBS/;
const HERO_CREDENTIAL = 'Fully insured · DBS-checked technicians';
const CALC_TRUST_ITEM = 'DBS-checked, vetted cleaners';

function renderPage(node: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

function renderCalc(mode: 'all-services' | 'carpet' | 'upholstery' | 'eot') {
  return render(
    <MemoryRouter>
      <BookingProvider>
        <QuoteCalculator mode={mode} />
      </BookingProvider>
    </MemoryRouter>,
  );
}

describe('Carpet page — DBS stated once', () => {
  it('mentions DBS exactly once across the whole rendered page', () => {
    const { container } = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');

    // Count text nodes, not elements: an ancestor chain would inflate an
    // element-based count and hide a genuine second mention.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const mentions: string[] = [];
    let node = walker.nextNode();
    while (node) {
      if (DBS.test(node.textContent ?? '')) mentions.push((node.textContent ?? '').trim());
      node = walker.nextNode();
    }

    expect(mentions).toEqual([HERO_CREDENTIAL]);
  });

  it('keeps the hero credential visible', () => {
    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    expect(screen.getByText(HERO_CREDENTIAL)).toBeInTheDocument();
  });

  it('drops only the DBS line from the trust strip, keeping the other four', () => {
    renderCalc('carpet');

    expect(screen.queryByText(CALC_TRUST_ITEM)).not.toBeInTheDocument();
    for (const kept of [
      '£5m public liability insurance',
      '48hr re-clean guarantee',
      'No hidden fees — fixed prices',
      'Secure Stripe checkout',
    ]) {
      expect(screen.getByText(kept)).toBeInTheDocument();
    }
  });
});

describe('every other surface is unchanged', () => {
  it.each(['all-services', 'upholstery', 'eot'] as const)(
    '%s mode still shows the DBS trust item',
    (mode) => {
      renderCalc(mode);
      expect(screen.getByText(CALC_TRUST_ITEM)).toBeInTheDocument();
    },
  );

  it('the Sofa page still shows it', () => {
    renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    expect(screen.getByText(CALC_TRUST_ITEM)).toBeInTheDocument();
  });
});
