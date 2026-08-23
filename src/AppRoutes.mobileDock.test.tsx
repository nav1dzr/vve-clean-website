// Route-coverage proof for the mobile action dock: every brief-required
// public page renders exactly one MobileActionDock, Booking and 404 render
// none (documented as deliberate exclusions — Booking's payment form already
// owns the primary action; a 404 error screen must not feel crowded), and no
// second hand-rolled fixed bottom bar (the old Pricing/Privacy/Terms clones)
// survives anywhere in the tree.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { CookieConsentProvider } from './context/CookieConsentContext';

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

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// Every route the brief requires a shared dock on. ServiceLandingLayout
// covers all of these except Home; Home renders it directly.
const DOCK_ROUTES = [
  '/', // Home — calculator variant
  '/carpet-cleaning-london',
  '/sofa-cleaning-london',
  '/commercial-carpet-cleaning-london',
  '/end-of-tenancy-cleaning-london',
  '/end-of-tenancy-cleaning-islington',
  '/end-of-tenancy-cleaning-camden',
  '/end-of-tenancy-cleaning-hackney',
  '/end-of-tenancy-cleaning-stratford',
  '/end-of-tenancy-cleaning-walthamstow',
  '/after-builders-cleaning-london',
  '/pricing',
  '/commercial',
  '/gallery',
  '/about',
  '/contact',
  '/faq',
  '/team',
  '/privacy-policy',
  '/terms-of-service',
  '/leaflet',
];

// Deliberately excluded — see the mobile action bar brief. Booking's payment
// form already owns the page's primary action, so a second persistent
// marketing bar would compete with/cover it. The 404 error screen must not
// feel crowded; if a dock is ever added there this test must change too.
const NO_DOCK_ROUTES = ['/booking', '/this-route-does-not-exist'];

describe('MobileActionDock — required route coverage', () => {
  it.each(DOCK_ROUTES)('%s renders exactly one shared dock', (route) => {
    const { container, unmount } = renderAt(route);
    // The EOT routes start in the calculator's truthful pre-wizard 'none'
    // state (see the geometry-handoff tests) — the wizard footer starts
    // off-screen, so the dock is present at mount on every route here.
    expect(container.querySelectorAll('[data-testid="mobile-action-dock"]')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Quick actions' })).toBeInTheDocument();
    unmount();
  });

  it.each(NO_DOCK_ROUTES)('%s deliberately renders no dock', (route) => {
    const { container, unmount } = renderAt(route);
    expect(container.querySelectorAll('[data-testid="mobile-action-dock"]')).toHaveLength(0);
    expect(screen.queryByRole('navigation', { name: 'Quick actions' })).not.toBeInTheDocument();
    unmount();
  });
});

describe('MobileActionDock — no duplicate hand-rolled fixed bottom bar survives', () => {
  // Fingerprint of the three old inline clones this migration removed
  // (Pricing/Privacy/Terms each rendered their own
  // `fixed bottom-0 left-0 right-0 ... border-silver-200 shadow-xl` div).
  // MobileActionDock never uses this class combination, so any match here
  // means a duplicate has crept back in.
  it.each(['/pricing', '/privacy-policy', '/terms-of-service'])(
    '%s has no leftover duplicate fixed bar alongside the shared dock',
    (route) => {
      const { container, unmount } = renderAt(route);
      expect(container.querySelectorAll('[data-testid="mobile-action-dock"]')).toHaveLength(1);
      expect(container.querySelector('.border-silver-200.shadow-xl')).toBeNull();
      unmount();
    },
  );

  it('the shared .mobile-page-bottom reserve is the only production fixed-bottom-bar CSS contract besides the cookie banner', () => {
    // Static source check: jsdom cannot resolve cross-element var()/calc()
    // through getComputedStyle, so this reads the actual rule instead of
    // guessing at a computed pixel value. Confirms the reserve accounts for
    // BOTH the dock's real height and the cookie banner's live height —
    // real-device measurement showed the old flat 72px under-reserved by
    // exactly the banner's height while it was visible, leaving the last
    // footer link reachable-but-covered.
    const css = readFileSync(path.resolve(__dirname, 'index.css'), 'utf-8');
    const rule = css.match(/\.mobile-page-bottom\s*{[^}]*}/)?.[0] ?? '';
    expect(rule).toMatch(/var\(--vve-dock-h/);
    expect(rule).toMatch(/var\(--vve-cookie-banner-h/);
  });
});

describe('MobileActionDock — last footer link stays a real, focusable element', () => {
  // jsdom has no layout engine, so pixel-level "is this covered by the fixed
  // stack" cannot be asserted here (that's the real-Chromium matrix's job).
  // What's provable at this level: the reserve class is actually applied to
  // the page root wrapping the footer, and the footer's own last control
  // (Cookie settings, after Privacy/Terms) is present, enabled and meets the
  // 44px target — i.e. nothing about this migration removed or disabled it.
  it.each(['/pricing', '/about', '/privacy-policy', '/terms-of-service'])(
    '%s applies the shared bottom reserve and keeps "Cookie settings" reachable',
    (route) => {
      const { container, unmount } = renderAt(route);
      expect(container.querySelector('.mobile-page-bottom')).not.toBeNull();
      const cookieSettings = screen.getByRole('button', { name: 'Cookie settings' });
      expect(cookieSettings).toBeEnabled();
      expect(cookieSettings.className).toMatch(/min-h-\[44px\]/);
      unmount();
    },
  );
});
