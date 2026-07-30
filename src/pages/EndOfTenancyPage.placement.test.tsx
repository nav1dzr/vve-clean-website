import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EndOfTenancyPage from './EndOfTenancyPage';
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
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider>
        <EndOfTenancyPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// Approved conversion-flow order for this page: Hero -> EOT quote -> real EOT
// media/results -> Customer reviews -> "Why tenants and landlords choose VVE
// Clean" -> "About this service" -> "Why choose us" -> Pricing -> FAQ/related/
// final CTA. The generic homepage-style Gallery block and its duplicate proof
// content are intentionally omitted on this page.
describe('EndOfTenancyPage — approved section order and real media', () => {
  it('places the complete EOT quote calculator directly after the hero, with a working CTA href', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Complete Clean/i })).toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Build my complete quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#quote');

    const positions = Array.from(document.querySelectorAll('h1, h2')).map((el) => el.textContent);
    const h1Index = positions.findIndex((t) => t?.includes('Complete End of Tenancy Cleaning London'));
    const quoteHeadingIndex = positions.findIndex((t) => t?.includes('Build Your Complete Clean'));
    expect(h1Index).toBeGreaterThanOrEqual(0);
    expect(quoteHeadingIndex).toBeGreaterThan(h1Index);
    expect(quoteHeadingIndex - h1Index).toBeLessThanOrEqual(1);
  });

  it('renders the section headings in the approved conversion-flow order', () => {
    renderPage();

    const positions = Array.from(document.querySelectorAll('h1, h2')).map((el) => el.textContent ?? '');
    const indexOf = (needle: string) => positions.findIndex((t) => t.includes(needle));

    const hero      = indexOf('Complete End of Tenancy Cleaning London');
    const quote     = indexOf('Build Your Complete Clean');
    const media     = indexOf('See the difference');
    const reviews   = indexOf('Rated by London customers on Google');
    const benefits  = indexOf('Why tenants and landlords choose VVE Clean');
    const intro     = indexOf('One complete clean');
    const why       = indexOf('What every end of tenancy clean includes');
    const pricing   = indexOf('Complete fixed prices by property size');
    const faq       = indexOf('Common questions');

    for (const idx of [hero, quote, media, reviews, benefits, intro, why, pricing, faq]) {
      expect(idx).toBeGreaterThanOrEqual(0);
    }

    expect(hero).toBeLessThan(quote);
    expect(quote).toBeLessThan(media);
    expect(media).toBeLessThan(reviews);
    expect(reviews).toBeLessThan(benefits);
    expect(benefits).toBeLessThan(intro);
    expect(intro).toBeLessThan(why);
    expect(why).toBeLessThan(pricing);
    expect(pricing).toBeLessThan(faq);
  });

  it('does not render the generic homepage-style Gallery block (avoids duplicate proof)', () => {
    renderPage();

    // The generic Gallery component's distinctive heading/copy should not
    // appear on this page — its before/after proof is superseded by the real
    // EOT media section.
    expect(screen.queryByText('Real jobs, real results')).not.toBeInTheDocument();
    expect(screen.queryByText(/no stock images/i)).not.toBeInTheDocument();
  });

  it('renders exactly 3 real before/after cards, correctly labelled, with no placeholders', () => {
    renderPage();

    expect(screen.queryAllByText('Recent results coming soon')).toHaveLength(0);
    expect(screen.queryByText('Rotating results — coming soon')).not.toBeInTheDocument();

    expect(screen.getByText('Kitchen hob')).toBeInTheDocument();
    expect(screen.getByText('Oven')).toBeInTheDocument();
    expect(screen.getByText('Shower')).toBeInTheDocument();

    const beforeLabels = screen.getAllByText('Before');
    const afterLabels = screen.getAllByText('After');
    expect(beforeLabels.length).toBeGreaterThanOrEqual(3);
    expect(afterLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a rotating results area with accessible controls and status text', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 10')).toBeInTheDocument();
  });

  it('links to the Gallery end-of-tenancy category and an Instagram CTA', () => {
    renderPage();

    const galleryLinks = screen.getAllByRole('link', { name: 'View full Gallery' });
    expect(galleryLinks.some((l) => l.getAttribute('href') === '/gallery?category=end-of-tenancy')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Follow VVE Clean on Instagram' }).length).toBeGreaterThan(0);
  });

  it('gives the hero WhatsApp CTA the green WhatsApp treatment', () => {
    renderPage();

    const waCta = screen.getByRole('link', { name: 'WhatsApp us first' });
    expect(waCta).toHaveClass('btn-whatsapp');
    expect(waCta).toHaveAttribute('href', expect.stringContaining('wa.me'));
  });
});
