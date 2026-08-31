// "Back to quote" — visible everywhere, and pointing at the right quote.
//
// Two defects are covered here:
//   1. the link was `hidden sm:flex`, so on a phone there was no way back at
//      all (browser-back does not set the restore flag, so it landed on an
//      empty calculator);
//   2. the destination was hard-coded to '/#quote', so a Carpet or Sofa
//      customer was returned to the homepage.
//
// Navigation and restoration only — no assertion here touches price, deposit,
// Stripe or Supabase, and neither does the code under test.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import CarpetCleaningPage from './CarpetCleaningPage';
import SofaCleaningPage from './SofaCleaningPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { rememberQuoteOrigin } from '../lib/quoteOrigin';

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

beforeEach(() => sessionStorage.clear());

/** A minimal carpet booking, as handleBookNow would have stored it. */
function storeBooking(extra: Record<string, unknown> = {}) {
  sessionStorage.setItem('vve_booking', JSON.stringify({
    serviceName: 'Carpet & Upholstery Cleaning',
    price: 215,
    quoteConfig: {
      service: 'deep',
      deepService: 'carpet_upholstery',
      carpetCondition: 'normal',
      carpetCounts: { living_room: 1, bedroom: 1, sofa_3: 1 },
      ...extra,
    },
  }));
}

function renderBooking() {
  return render(
    <MemoryRouter initialEntries={['/booking']}>
      <CookieConsentProvider>
        <BookingPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

function renderPage(node: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

const backLink = () => screen.getByRole('link', { name: /Back to quote/i });

describe('the link is reachable at every width', () => {
  it('is rendered, with no breakpoint class hiding it', () => {
    storeBooking();
    renderBooking();

    const link = backLink();
    expect(link).toBeInTheDocument();
    // `hidden sm:flex` was the bug — a phone user had no way back.
    expect(link.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(link.className).toContain('flex');
  });

  it('keeps an accessible name even though the visible label shortens on mobile', () => {
    storeBooking();
    renderBooking();
    expect(backLink()).toHaveAccessibleName('Back to quote');
  });
});

describe('it returns to the quote the customer actually built', () => {
  it.each([
    ['/carpet-cleaning-london', '/carpet-cleaning-london#quote'],
    ['/sofa-cleaning-london', '/sofa-cleaning-london#quote'],
    ['/end-of-tenancy-cleaning-london', '/end-of-tenancy-cleaning-london#quote'],
    ['/leaflet', '/leaflet#quote'],
    ['/', '/#quote'],
  ])('a quote built on %s returns to %s', (origin, expected) => {
    rememberQuoteOrigin(origin);
    storeBooking();
    renderBooking();
    expect(backLink()).toHaveAttribute('href', expected);
  });

  it('falls back to the homepage quote when no origin was recorded', () => {
    storeBooking();
    renderBooking();
    expect(backLink()).toHaveAttribute('href', '/#quote');
  });

  it('records the origin even when the page supplies its own onBook', async () => {
    // /leaflet passes onBook and navigates itself. With the origin recorded
    // only in the else branch, leaflet customers were still returned to
    // /#quote — losing the 20% offer context they arrived with.
    const { default: QuoteCalculator } = await import('../components/QuoteCalculator');
    const { BookingProvider } = await import('../context/BookingContext');
    const onBook = vi.fn();
    const user = userEvent.setup();

    window.history.pushState({}, '', '/leaflet');
    render(
      <MemoryRouter initialEntries={['/leaflet']}>
        <BookingProvider>
          <QuoteCalculator onBook={onBook} promoCode="LEAFLET20" />
        </BookingProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);

    expect(onBook).toHaveBeenCalled();
    expect(sessionStorage.getItem('vve_quote_origin')).toBe('/leaflet');
  });

  it('sets the restore flag so the quote rehydrates', async () => {
    const user = userEvent.setup();
    rememberQuoteOrigin('/carpet-cleaning-london');
    storeBooking();
    renderBooking();

    await user.click(backLink());
    expect(sessionStorage.getItem('vve_restore_quote')).toBe('1');
  });
});

describe('the returned-to quote is rehydrated, not reset', () => {
  it('restores carpet quantities and reopens the upholstery cross-sell', () => {
    // Exactly the state the back link leaves behind.
    storeBooking();
    sessionStorage.setItem('vve_restore_quote', '1');

    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');

    // Quantities are back.
    expect(screen.getAllByText('£195').length).toBeGreaterThan(0);

    // The cross-sell group reopens, because the restored quote contains a
    // sofa — leaving it collapsed would price something the customer cannot see.
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('3-seater sofa').length).toBeGreaterThan(0);
  });

  it('leaves the cross-sell collapsed when the restored quote has no sofa', () => {
    storeBooking({ carpetCounts: { living_room: 1, bedroom: 1 } });
    sessionStorage.setItem('vve_restore_quote', '1');

    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');

    expect(screen.getAllByText('£110').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('3-seater sofa')).not.toBeInTheDocument();
  });

  it('restores a sofa-page quote and reopens its carpet cross-sell', () => {
    sessionStorage.setItem('vve_booking', JSON.stringify({
      serviceName: 'Carpet & Upholstery Cleaning',
      price: 145,
      quoteConfig: {
        service: 'deep',
        deepService: 'carpet_upholstery',
        carpetCondition: 'normal',
        carpetCounts: { sofa_3: 1, bedroom: 1 },
      },
    }));
    sessionStorage.setItem('vve_restore_quote', '1');

    renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');

    expect(screen.getAllByText('£145').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Bedroom').length).toBeGreaterThan(0);
  });
});
