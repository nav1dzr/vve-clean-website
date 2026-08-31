// Cross-page consistency for the End of Tenancy quote.
//
// The homepage and the dedicated /end-of-tenancy-cleaning-london page used
// to each embed their own instance of a bespoke "premium" EOT quote
// component, kept in sync only by convention and a parallel-scenario test
// suite. Both pages now mount the exact same QuoteCalculator, which hands
// off internally to the exact same EotQuoteWizard — so the two literally
// cannot drift in pricing or presentation; there is only one implementation
// to render. This file proves that wiring, not the wizard's own behaviour
// (covered exhaustively by EotQuoteWizard.test.tsx).

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import EndOfTenancyPage from './EndOfTenancyPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { EOT_COMPLETE_PRICES_P, EOT_TAILORED_START_PRICES_P } from '../data/pricing';

const cheapestP = (completeP: number, tailoredP: number) => Math.min(completeP, tailoredP);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  sessionStorage.clear();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CookieConsentProvider><HomePage /></CookieConsentProvider>
    </MemoryRouter>,
  );
}

function renderEotPage() {
  return render(
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider><EndOfTenancyPage /></CookieConsentProvider>
    </MemoryRouter>,
  );
}

function quote() {
  const el = document.getElementById('quote');
  expect(el).not.toBeNull();
  return within(el as HTMLElement);
}

/** Clicks the quote action on a named homepage service card. */
async function chooseCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  const grid = document.getElementById('services') as HTMLElement;
  const card = within(grid).getByText(title).closest('article');
  await user.click(within(card as HTMLElement).getByRole('button', { name: /Get your price/i }));
}

describe('End of Tenancy quote — identical on the homepage and the service page', () => {
  it('the homepage End of Tenancy card opens the same wizard as the dedicated service page', async () => {
    const user = userEvent.setup();
    renderHome();
    await chooseCard(user, 'End of tenancy cleaning');
    await waitFor(() => expect(quote().getByRole('list', { name: /Step 1 of 4/ })).toBeInTheDocument());
    expect(quote().queryByText('Service Type')).not.toBeInTheDocument();
  });

  it('selecting the same property size shows the same footer total on both pages', async () => {
    const user = userEvent.setup();
    renderHome();
    await chooseCard(user, 'End of tenancy cleaning');
    await waitFor(() => expect(quote().getByRole('list', { name: /Step 1 of 4/ })).toBeInTheDocument());
    await user.click(quote().getByRole('button', { name: /^3 bed/ }));
    const homeTotal = quote().getByTestId('footer-total').textContent;

    renderEotPage();
    const eotSections = document.querySelectorAll('#quote');
    const eotQuote = within(eotSections[eotSections.length - 1] as HTMLElement);
    await user.click(eotQuote.getByRole('button', { name: /^3 bed/ }));

    const expected = `£${cheapestP(EOT_COMPLETE_PRICES_P.bed3, EOT_TAILORED_START_PRICES_P.bed3) / 100}`;
    expect(homeTotal).toBe(expected);
    expect(eotQuote.getByTestId('footer-total')).toHaveTextContent(expected);
  });

  it('a pending "Back to quote" restore for an End of Tenancy booking reopens on the homepage too', async () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      serviceName: 'End of tenancy (Complete Agency-Ready Clean) — 2 Bed, 1 bathroom',
      price: EOT_COMPLETE_PRICES_P.bed2 / 100,
      quoteConfig: {
        service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2', deepBaths: 1,
        eotPackage: 'complete', addOnCounts: {},
      },
    }));
    try {
      renderHome();
      const expected = `£${cheapestP(EOT_COMPLETE_PRICES_P.bed2, EOT_TAILORED_START_PRICES_P.bed2) / 100}`;
      await waitFor(() => expect(quote().getByTestId('footer-total')).toHaveTextContent(expected));
    } finally {
      sessionStorage.removeItem('vve_restore_quote');
      sessionStorage.removeItem('vve_booking');
    }
  });
});
