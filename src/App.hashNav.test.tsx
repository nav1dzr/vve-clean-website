import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import AppRoutes from './ClientAppRoutes';
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

    const hero = (await screen.findByRole('heading', { level: 1 }, { timeout: 5000 })).closest('section')!;
    const heroCta = within(hero).getByRole('link', { name: 'Get my moving-out quote' });
    await user.click(heroCta);

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('quote');
    });
    // The visitor scrolls back to the hero while the URL already ends #quote.
    // Clicking that same CTA again must navigate and focus, not silently stop.
    heroCta.focus();
    expect(document.activeElement).toBe(heroCta);
    await user.click(heroCta);
    await waitFor(() => expect(document.activeElement?.id).toBe('quote'));
  });

  it('lands on and focuses the quote section after a cross-page navigation carrying a hash', async () => {
    const user = userEvent.setup();
    renderAt('/how-we-clean-carpets');

    // The process page's header keeps visitors in the carpet quote journey.
    const navCta = (await screen.findAllByRole(
      'link',
      { name: 'Get a carpet quote' },
      { timeout: 5000 },
    ))[0];
    await user.click(navCta);

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('quote');
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Carpet cleaning in London');
    expect(screen.getByRole('button', { name: 'Increase Bedroom quantity' })).toBeInTheDocument();
  });
});

describe('Navbar Gallery link', () => {
  it('routes to the /gallery page, not the old homepage "#gallery" anchor', async () => {
    const user = userEvent.setup();
    renderAt('/end-of-tenancy-cleaning-london');

    const galleryLink = (await screen.findAllByRole(
      'link',
      { name: 'Gallery' },
      { timeout: 5000 },
    ))[0];
    expect(galleryLink).toHaveAttribute('href', '/gallery');

    await user.click(galleryLink);

    expect(await screen.findByRole('tablist', { name: 'Gallery categories' })).toBeInTheDocument();
  });
});
