import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import CommercialPage from '../pages/CommercialPage';
import CommercialCarpetPage from '../pages/CommercialCarpetPage';
import AfterBuildersPage from '../pages/AfterBuildersPage';
import AreaPage from '../pages/AreaPage';
import CarpetCleaningPage from '../pages/CarpetCleaningPage';
import SofaCleaningPage from '../pages/SofaCleaningPage';
import HowWeCleanCarpetsPage from '../pages/HowWeCleanCarpetsPage';
import PricingPage from '../pages/PricingPage';
import { AREAS_BY_SLUG } from '../data/areas';

beforeEach(() => {
  // These are UI integration tests; use existing local media/rating fallbacks
  // instead of making any live requests.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline test fixture')));
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    matches: true, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
});
afterEach(() => vi.unstubAllGlobals());

function renderPage(page: ReactElement, pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <CookieConsentProvider>{page}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('real pages keep contextual navigation', () => {
  it.each([
    ['/commercial', <CommercialPage />, 'Request a site visit', 'commercial%20site%20visit'],
    ['/commercial-carpet-cleaning-london', <CommercialCarpetPage />, 'Request a site assessment', 'wa.me/447845451111'],
    ['/after-builders-cleaning-london', <AfterBuildersPage />, 'WhatsApp a photo for a quote', 'after-builders%20clean%20quote'],
  ] as const)('keeps %s on its existing enquiry route in the header and sticky bar', (path, page, label, hrefPart) => {
    const { container } = renderPage(page, path);
    const header = within(container.querySelector('header')!);
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(header.getByRole('link', { name: label })).toHaveAttribute('href', expect.stringContaining(hrefPart));
    expect(bar.getByRole('link', { name: label })).toHaveAttribute('href', header.getByRole('link', { name: label }).getAttribute('href'));
    expect(bar.queryByRole('button', { name: 'Get my price' })).not.toBeInTheDocument();
  });

  it('keeps a covered area on its real service-choice section', () => {
    const { container } = renderPage(<AreaPage area={AREAS_BY_SLUG.islington} />, '/cleaning-islington');
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(bar.getByRole('link', { name: 'Choose my service' })).toHaveAttribute('href', '#area-services');
    expect(container.querySelector('#area-services')).not.toBeNull();
  });

  it('keeps unconfirmed coverage on postcode checking instead of promising a booking', () => {
    renderPage(<AreaPage area={AREAS_BY_SLUG.highgate} />, '/cleaning-highgate');
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(bar.getByRole('link', { name: 'Check my postcode' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
    expect(bar.queryByRole('button', { name: 'Get my price' })).not.toBeInTheDocument();
  });

  it.each([
    ['/carpet-cleaning-london', <CarpetCleaningPage />, 'Choose my rooms'],
    ['/sofa-cleaning-london', <SofaCleaningPage />, 'Choose my furniture'],
  ] as const)('keeps an unfinished %s quote on the existing validation action', (path, page, label) => {
    const { container } = renderPage(page, `${path}?utm_source=google#quote`);
    expect(within(container.querySelector('header')!).getByRole('link', { name: label })).toHaveAttribute('href', '#quote');
    expect(within(screen.getByRole('navigation', { name: 'Quick booking and help' })).getByRole('button', { name: 'Get my price' })).toBeInTheDocument();
    expect(container.querySelector('#quote')).not.toBeNull();
  });

  it('keeps a process-page quote action pointing to its service calculator', () => {
    renderPage(<HowWeCleanCarpetsPage />, '/how-we-clean-carpets');
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(bar.getByRole('link', { name: 'Get a carpet quote' })).toHaveAttribute('href', '/carpet-cleaning-london#quote');
  });

  it('keeps pricing header and sticky actions aligned as categories change', () => {
    const { container } = renderPage(<PricingPage />, '/pricing');
    const header = within(container.querySelector('header')!);
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    const expectTarget = (href: string) => {
      expect(header.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', href);
      expect(bar.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', href);
    };
    expectTarget('/end-of-tenancy-cleaning-london#quote');
    for (const [category, href] of [
      [/^Carpets/, '/carpet-cleaning-london#quote'],
      [/^Sofas & upholstery/, '/sofa-cleaning-london#quote'],
      [/^Other cleans/, '/#quote'],
      [/^End of tenancy/, '/end-of-tenancy-cleaning-london#quote'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: category }));
      expectTarget(href);
    }
    fireEvent.click(header.getByRole('button', { name: 'Open menu' }));
    const headerActions = header.getAllByRole('link', { name: 'Get my price' });
    expect(headerActions).toHaveLength(2);
    for (const link of headerActions) expect(link).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#quote');
  });
});
