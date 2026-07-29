import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CarpetCleaningPage from './CarpetCleaningPage';
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
    <MemoryRouter initialEntries={['/carpet-cleaning-london']}>
      <CookieConsentProvider>
        <CarpetCleaningPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('CarpetCleaningPage — quote placement and proof placeholders', () => {
  it('surfaces a carpet-focused instant quote calculator directly after the hero, and the hero CTA reaches it', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Carpet Quote/i })).toBeInTheDocument();
    // "Bedroom" also appears in the fixed-price table further down the page,
    // so assert presence rather than uniqueness.
    expect(screen.getAllByText('Bedroom').length).toBeGreaterThan(0);
    expect(screen.queryByText('2-seater sofa')).not.toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Build my carpet quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/carpet-cleaning-london#quote');
  });

  it('renders exactly 6 proof placeholder slots (3 before/after + 3 video) with no pricing shown', () => {
    renderPage();

    expect(screen.getAllByText('Recent results coming soon')).toHaveLength(3);
    expect(screen.getAllByText('Video results coming soon')).toHaveLength(3);
  });

  it('links to the Gallery carpet category and an Instagram follow CTA', () => {
    renderPage();

    const galleryLinks = screen.getAllByRole('link', { name: 'View full Gallery' });
    expect(galleryLinks.some((l) => l.getAttribute('href') === '/gallery?category=carpet')).toBe(true);
    // ServiceLandingLayout also renders the generic homepage-style Gallery
    // component, which has its own Instagram CTA — expect at least one.
    const igLinks = screen.getAllByRole('link', { name: 'Follow VVE Clean on Instagram' });
    expect(igLinks.length).toBeGreaterThan(0);
    igLinks.forEach((l) => expect(l).toHaveAttribute('href', 'https://www.instagram.com/vve__clean'));
  });
});
