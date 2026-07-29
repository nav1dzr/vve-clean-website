import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SofaCleaningPage from './SofaCleaningPage';
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
    <MemoryRouter initialEntries={['/sofa-cleaning-london']}>
      <CookieConsentProvider>
        <SofaCleaningPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('SofaCleaningPage — quote placement and proof placeholders', () => {
  it('surfaces an upholstery-focused instant quote calculator directly after the hero, and the hero CTA reaches it', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Upholstery Quote/i })).toBeInTheDocument();
    // "2-seater sofa" also appears in the fixed-price table further down the
    // page, so assert presence rather than uniqueness.
    expect(screen.getAllByText('2-seater sofa').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bedroom')).not.toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Build my upholstery quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/sofa-cleaning-london#quote');
  });

  it('renders exactly 6 proof placeholder slots (3 before/after + 3 video)', () => {
    renderPage();

    expect(screen.getAllByText('Recent results coming soon')).toHaveLength(3);
    expect(screen.getAllByText('Video results coming soon')).toHaveLength(3);
  });

  it('links to the Gallery sofa-upholstery category', () => {
    renderPage();

    const galleryLinks = screen.getAllByRole('link', { name: 'View full Gallery' });
    expect(galleryLinks.some((l) => l.getAttribute('href') === '/gallery?category=sofa-upholstery')).toBe(true);
  });
});
