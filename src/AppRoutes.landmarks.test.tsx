// Accessibility guard: every public route must expose exactly one <main>
// landmark. The audit found none at all on the public site, which weakens
// screen-reader navigation and makes automated axe checks unreliable.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { CookieConsentProvider } from './context/CookieConsentContext';
import { BookingProvider } from './context/BookingContext';

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

const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/commercial',
  '/booking',
  '/leaflet',
  '/privacy-policy',
  '/terms-of-service',
  '/carpet-cleaning-london',
  '/sofa-cleaning-london',
  '/commercial-carpet-cleaning-london',
  '/end-of-tenancy-cleaning-london',
  '/after-builders-cleaning-london',
  '/gallery',
];

describe('public routes expose exactly one main landmark', () => {
  it.each(PUBLIC_ROUTES)('%s has a single <main>', (path) => {
    const { unmount } = renderAt(path);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    unmount();
  });
});
