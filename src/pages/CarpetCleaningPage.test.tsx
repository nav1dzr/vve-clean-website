import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CarpetCleaningPage from './CarpetCleaningPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { CARPET_FEATURED_BEFORE_AFTER } from '../data/galleryMedia';

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
  it('uses the supplied carpet-cleaning photograph in a responsive hero card', () => {
    renderPage();

    const heroImage = screen.getByRole('img', {
      name: 'Professional hot-water extraction cleaning on a deep blue carpet',
    });
    expect(heroImage).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    expect(screen.getByText('Deep clean, visible results')).toBeInTheDocument();
    expect(screen.getByText(/deeper than the surface/i)).toHaveClass('text-gradient-carpet');
  });

  it('surfaces a carpet-focused instant quote calculator directly after the hero, and the hero CTA reaches it', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Carpet Quote/i })).toBeInTheDocument();
    // "Bedroom" also appears in the fixed-price table further down the page,
    // so assert presence rather than uniqueness.
    expect(screen.getAllByText('Bedroom').length).toBeGreaterThan(0);

    // Upholstery is offered as an optional add-on inside the same quote, so a
    // customer can book carpets and a sofa in one visit without switching
    // calculators or leaving the page. The offer shows immediately; its
    // controls stay collapsed until accepted, so the page does not open with a
    // second service's worth of counters the visitor never asked for.
    expect(screen.getByText('Would you also like upholstery cleaning?')).toBeInTheDocument();
    expect(screen.queryByText('2-seater sofa')).not.toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Build my carpet quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/carpet-cleaning-london#quote');
  });

  it('shows exactly the three approved before/after cards, not placeholders', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Recent carpet results/i })).toBeInTheDocument();
    expect(screen.queryByText('Recent results coming soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Video results coming soon')).not.toBeInTheDocument();

    // Scoped to the carpet results section: ServiceLandingLayout also renders
    // the generic homepage-style Gallery block, which has its own Before/After
    // labels for unrelated services.
    const results = document.getElementById('results');
    expect(results).not.toBeNull();
    const r = within(results as HTMLElement);
    expect(CARPET_FEATURED_BEFORE_AFTER).toHaveLength(3);
    expect(r.getAllByText(/^Before$/i)).toHaveLength(3);
    expect(r.getAllByText(/^After$/i)).toHaveLength(3);
    expect(r.getByText('Office carpet')).toBeInTheDocument();
    expect(r.getByText('Blue bedroom carpet')).toBeInTheDocument();
    expect(r.getByText('Brown carpet')).toBeInTheDocument();
  });

  it('renders all four converted clips — one per card plus the wide process clip', () => {
    renderPage();

    const results = document.getElementById('results');
    const process = document.getElementById('process');
    expect(process).not.toBeNull();

    const inResults = (results as HTMLElement).querySelectorAll('video');
    const inProcess = (process as HTMLElement).querySelectorAll('video');
    expect(inResults).toHaveLength(3);
    expect(inProcess).toHaveLength(1);
    expect(document.querySelectorAll('video')).toHaveLength(4);

    expect(
      screen.getByRole('heading', { name: /Watch the equipment work/i }),
    ).toBeInTheDocument();
  });

  it('ships no .heic or .mov source anywhere in the rendered page', () => {
    renderPage();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\.heic/i);
    expect(html).not.toMatch(/\.mov(["'?\s]|$)/i);
    expect(html).not.toContain('/gallery/carpet_cleaning_before_.jpg');
  });

  it('lazy-loads every clip rather than fetching it on page load', () => {
    renderPage();

    document.querySelectorAll('video').forEach((v) => {
      // No <source> children until the IntersectionObserver fires, so nothing
      // is fetched above or below the fold on first paint.
      expect(v.querySelectorAll('source')).toHaveLength(0);
      expect(v.getAttribute('preload')).toBe('none');
      expect(v).toHaveAttribute('poster');
      expect(v.muted).toBe(true);
      expect(v.loop).toBe(true);
      expect(v.playsInline).toBe(true);
      expect(v.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(30);
    });
  });

  it('states honestly that complete stain removal cannot be guaranteed', () => {
    renderPage();
    expect(screen.getAllByText(/complete removal cannot be guaranteed/i).length).toBeGreaterThan(0);
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
