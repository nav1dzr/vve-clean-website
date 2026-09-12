// Page-level smoke tests for the End of Tenancy landing page.
//
// The wizard's own step-by-step behaviour (property/bathrooms/package/
// tailored add-ons/floor-care/extras/review, monotonicity, restore
// rehydration) is covered exhaustively by EotQuoteWizard.test.tsx. This file
// only proves the page itself wires the real wizard in correctly — no
// separate "premium" EOT UI, no service-type switcher, and that a pending
// "Back to quote" restore (the mechanism shared by every other service) also
// reopens an in-progress End of Tenancy quote.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EndOfTenancyPage from './EndOfTenancyPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';
import { EOT_COMPLETE_PRICES_P, EOT_TAILORED_START_PRICES_P } from '../data/pricing';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => sessionStorage.clear());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider>
        <BookingProvider>
          <EndOfTenancyPage />
        </BookingProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

/**
 * Scopes queries to the quote. The page also carries a static pricing table
 * that repeats phrases the wizard shows too, so page-wide queries could
 * match copy the customer never sees inside the quote itself.
 */
function quote() {
  const el = document.getElementById('quote');
  if (!el) throw new Error('quote section not found');
  return within(el);
}

describe('EndOfTenancyPage — mounts the Complete/Tailored wizard directly, not a separate UI', () => {
  it('renders the page heading and the wizard\'s first step, with no legacy service-type switcher', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /End of Tenancy Cleaning London/i }),
    ).toBeInTheDocument();
    expect(quote().getByRole('list', { name: /Step 1 of 4/ })).toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
  });

  it('asks a fresh visitor to choose a property size before showing a quote', () => {
    renderPage();
    expect(quote().getByTestId('footer-total')).toHaveTextContent('Choose a size');
    expect(quote().getByRole('button', { name: /^Continue$/ })).toBeDisabled();
    expect(quote().getByRole('button', { name: /^2 beds$/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('changing property size updates the footer total, still on step 1', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(quote().getByRole('button', { name: /^1 bed/ }));
    expect(quote().getByTestId('footer-total')).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed1 / 100}`);
    expect(quote().getByRole('list', { name: /Step 1 of 4/ })).toBeInTheDocument();
  });

  it('lets the customer change service back to carpet & upholstery from within the quote', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(quote().getByRole('button', { name: /Choose a different service/i }));
    expect(quote().queryByRole('list', { name: /Step 1 of 4/ })).not.toBeInTheDocument();
    expect(quote().getByRole('button', { name: 'Increase Bedroom quantity' })).toBeInTheDocument();
  });

  it('reopens a pending End of Tenancy "Back to quote" restore instead of starting from step 1 defaults', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      serviceName: 'End of tenancy (Complete Agency-Ready Clean) — 3 Bed, 1 bathroom',
      price: EOT_COMPLETE_PRICES_P.bed3 / 100,
      quoteConfig: {
        service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed3', deepBaths: 1,
        eotPackage: 'complete', addOnCounts: {},
      },
    }));
    try {
      renderPage();
      expect(quote().getByTestId('footer-total')).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed3 / 100}`);
    } finally {
      sessionStorage.removeItem('vve_restore_quote');
      sessionStorage.removeItem('vve_booking');
    }
  });
});


describe('EndOfTenancyPage — saved package compatibility', () => {
  it('preserves an explicit Tailored selection and its selected appliance addition', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      serviceName: 'End of tenancy — Tailored Checklist Clean',
      price: EOT_TAILORED_START_PRICES_P.bed1 / 100 + 25,
      quoteConfig: {
        service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed1', deepBaths: 1,
        eotPackage: 'tailored', tailoredAddOns: { fridgeFreezerInside: true }, addOnCounts: {},
      },
    }));
    renderPage();
    expect(quote().getByTestId('footer-total')).toHaveTextContent('£224');
    await user.click(quote().getByRole('button', { name: /^Continue$/ }));
    expect(quote().getByText('Tailored Checklist Clean').closest('button')).toHaveAttribute('aria-pressed', 'true');
    await user.click(quote().getByRole('button', { name: /^Continue$/ }));
    await user.click(quote().getByRole('button', { name: /^Continue$/ }));
    expect(quote().getByRole('checkbox', { name: /Inside standard fridge/ })).toBeChecked();
    expect(quote().getByTestId('final-total')).toHaveTextContent('£224');
  });

  it('uses Complete for a legacy EOT restore without a package field, retaining the selected property', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      serviceName: 'End of tenancy cleaning', price: EOT_COMPLETE_PRICES_P.bed2 / 100,
      quoteConfig: { service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2', deepBaths: 1, addOnCounts: {} },
    }));
    renderPage();
    expect(quote().getByRole('button', { name: /^2 beds$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(quote().getByTestId('footer-total')).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });
});
