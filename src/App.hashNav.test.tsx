import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import AppRoutes from './AppRoutes';
import { CookieConsentProvider } from './context/CookieConsentContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScrollToTop />
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// Regression coverage for the diagnosed bug: a service-landing hero/pricing
// CTA that points at "<page>#quote" is a React Router <Link>, which never
// lets the browser's native fragment-scroll fire. ScrollToTop (mounted once,
// above <AppRoutes/> in App.tsx) is what actually performs the scroll+focus
// after such a navigation — same-page or cross-page.
describe('hash navigation to #quote', () => {
  it('focuses the quote section after clicking a same-page hero CTA', async () => {
    const user = userEvent.setup();
    renderAt('/end-of-tenancy-cleaning-london');

    const heroCta = screen.getAllByRole('link', { name: 'Build my quote' })[0];
    await user.click(heroCta);

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('quote');
    });
  });

  it('lands on and focuses the quote section after a cross-page navigation carrying a hash', async () => {
    const user = userEvent.setup();
    renderAt('/carpet-cleaning-london');

    // Navbar's "Get my price" always targets the homepage's general quote.
    const navCta = screen.getAllByRole('link', { name: 'Get my price' })[0];
    await user.click(navCta);

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('quote');
    });
    // The homepage quote is present before any service is chosen — it opens on
    // the introductory panel — so the link lands on something real.
    expect(screen.getByRole('heading', { name: 'Get an instant quote' })).toBeInTheDocument();
  });
});

describe('Navbar Gallery link', () => {
  it('routes to the /gallery page, not the old homepage "#gallery" anchor', async () => {
    const user = userEvent.setup();
    renderAt('/end-of-tenancy-cleaning-london');

    const galleryLink = screen.getAllByRole('link', { name: 'Gallery' })[0];
    expect(galleryLink).toHaveAttribute('href', '/gallery');

    await user.click(galleryLink);

    expect(await screen.findByRole('tablist', { name: 'Gallery categories' })).toBeInTheDocument();
  });
});
