import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServerAppRoutes from '../ServerAppRoutes';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';
import { ROUTE_METADATA } from '../lib/routeMetadata';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }),
  });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider><BookingProvider><ServerAppRoutes /></BookingProvider></CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('the current public booking policy on every published route', () => {
  it.each(ROUTE_METADATA.map(({ path }) => path))('%s keeps public browsing and requests free of checkout actions', (path) => {
    const { container, unmount } = renderPage(path);
    // Include FAQ structured data as well as visible copy; tenancy-deposit
    // advice and genuine £30 service prices remain valid public content.
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).not.toMatch(/No deposit or advance payment is required|we confirm your appointment directly|Pay £30 deposit by card/i);
    expect(container.querySelector('a[href*="checkout.stripe.com"]')).toBeNull();
    unmount();
  });

  it.each([
    '/', '/pricing', '/contact', '/about', '/faq',
    '/carpet-cleaning-london', '/sofa-cleaning-london', '/end-of-tenancy-cleaning-london',
    '/how-we-clean-carpets', '/how-we-clean-sofas-upholstery', '/how-we-clean-end-of-tenancy',
  ])('%s explains a free request followed by deposit options after agreement', (path) => {
    const { container, unmount } = renderPage(path);
    expect(container.textContent).toContain(BOOKING_REQUEST_NOTE);
    unmount();
  });
});
