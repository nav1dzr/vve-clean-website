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

describe('EndOfTenancyPage — quote placement and proof section', () => {
  it('places the complete EOT quote calculator directly after the hero, with a working CTA href', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Complete Clean/i })).toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Build my complete quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#quote');

    // Hero heading should render before the quote heading in document order —
    // i.e. the quote sits near the top of the page, not buried after
    // gallery/reviews/why/pricing.
    const positions = Array.from(document.querySelectorAll('h1, h2')).map((el) => el.textContent);
    const h1Index = positions.findIndex((t) => t?.includes('Complete End of Tenancy Cleaning London'));
    const quoteHeadingIndex = positions.findIndex((t) => t?.includes('Build Your Complete Clean'));
    expect(h1Index).toBeGreaterThanOrEqual(0);
    expect(quoteHeadingIndex).toBeGreaterThan(h1Index);
    // Only the intro heading should sit between hero and quote — no gallery/
    // reviews/why/pricing headings in between.
    expect(quoteHeadingIndex - h1Index).toBeLessThanOrEqual(1);
  });

  it('renders exactly 3 before/after placeholders + 1 rotating-results placeholder — no real photos yet', () => {
    renderPage();

    expect(screen.getAllByText('Recent results coming soon')).toHaveLength(3);
    expect(screen.getByText('Rotating results — coming soon')).toBeInTheDocument();
    expect(screen.queryAllByText('Video results coming soon')).toHaveLength(0);
  });

  it('links to the Gallery end-of-tenancy category and an Instagram CTA', () => {
    renderPage();

    const galleryLinks = screen.getAllByRole('link', { name: 'View full Gallery' });
    expect(galleryLinks.some((l) => l.getAttribute('href') === '/gallery?category=end-of-tenancy')).toBe(true);
    // ServiceLandingLayout also renders the generic homepage-style Gallery
    // component, which has its own Instagram CTA — expect at least one.
    expect(screen.getAllByRole('link', { name: 'Follow VVE Clean on Instagram' }).length).toBeGreaterThan(0);
  });
});
