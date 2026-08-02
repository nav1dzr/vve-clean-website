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

describe('SofaCleaningPage — quote placement and premium service guidance', () => {
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

  it('replaces empty proof placeholders with an honest fabric-care process', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Built around the fabric/i })).toBeInTheDocument();
    expect(screen.getByText('Inspect and test')).toBeInTheDocument();
    expect(screen.queryByText('Recent results coming soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Video results coming soon')).not.toBeInTheDocument();
  });

  it('keeps direct links to the other services and booking', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Carpet Cleaning' })).toHaveAttribute('href', '/carpet-cleaning-london');
    expect(screen.getAllByRole('link', { name: 'Book online now' }).length).toBeGreaterThan(0);
  });
});
