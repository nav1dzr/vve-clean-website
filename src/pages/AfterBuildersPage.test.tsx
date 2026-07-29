import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AfterBuildersPage from './AfterBuildersPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/after-builders-cleaning-london']}>
      <CookieConsentProvider>
        <AfterBuildersPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// After Builders pricing genuinely depends on scope/photos, so — unlike EOT,
// Carpet and Sofa — this page must not get a fixed-price QuoteCalculator.
// The hero CTA is the early, prominent quote path here, and it must always
// go to the WhatsApp photo-quote flow, never to an invented "#quote" anchor
// that doesn't exist on this page.
describe('AfterBuildersPage — photo-quote CTA (no fixed-price calculator)', () => {
  it('renders a prominent hero CTA that opens the WhatsApp photo-quote conversation', () => {
    renderPage();

    const heroCta = screen.getAllByRole('link', { name: 'WhatsApp a photo for a quote' })[0];
    expect(heroCta).toHaveAttribute('href', expect.stringContaining('https://wa.me/447845451111'));
    expect(heroCta).toHaveAttribute('href', expect.stringContaining('after-builders%20clean%20quote'));
    expect(heroCta).toHaveAttribute('target', '_blank');
    expect(heroCta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('never renders a fixed-price instant quote calculator on this page', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: /Instant Quote/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
  });
});
