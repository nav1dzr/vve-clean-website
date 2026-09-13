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
  it.each(ROUTE_METADATA.map(({ path }) => path))('%s never asks for a deposit or makes payment confirm a visit', (path) => {
    const { container, unmount } = renderPage(path);
    // Include FAQ structured data as well as visible copy; tenancy-deposit
    // advice and genuine £30 service prices remain valid public content.
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).not.toMatch(/£30\s+deposit|deposit\s+(?:link|request|deadline|after agreement)|confirm with £30|pay(?:ing|ment)?\s+(?:the deposit\s+)?confirms|confirmed when (?:the )?(?:deposit|payment)/i);
    unmount();
  });

  it.each([
    '/', '/pricing', '/contact', '/about', '/faq',
    '/carpet-cleaning-london', '/sofa-cleaning-london', '/end-of-tenancy-cleaning-london',
    '/how-we-clean-carpets', '/how-we-clean-sofas-upholstery', '/how-we-clean-end-of-tenancy',
  ])('%s explains direct confirmation after scope, price and time are agreed', (path) => {
    const { container, unmount } = renderPage(path);
    expect(container.textContent).toContain(BOOKING_REQUEST_NOTE);
    unmount();
  });
});
