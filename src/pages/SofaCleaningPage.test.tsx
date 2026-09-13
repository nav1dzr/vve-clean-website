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
  it('uses the supplied sofa-cleaning photograph as a responsive hero visual', () => {
    renderPage();

    const heroImage = screen.getByRole('img', {
      name: 'A technician cleaning sofa upholstery',
    });

    expect(heroImage).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    expect(screen.getByText('Upholstery cleaning in progress')).toBeInTheDocument();
    expect(heroImage.closest('figure')?.querySelector('figcaption')).toHaveTextContent(/Fabric assessed before treatment/i);
  });

  it('surfaces an upholstery-focused instant quote calculator directly after the hero, and the hero CTA reaches it', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Build Your Upholstery Quote/i })).toBeInTheDocument();
    // "2-seater sofa" also appears in the fixed-price table further down the
    // page, so assert presence rather than uniqueness.
    expect(screen.getAllByText('2-seater sofa').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bedroom')).not.toBeInTheDocument();

    const heroCta = screen.getAllByRole('link', { name: 'Get a sofa quote' })[0];
    expect(heroCta).toHaveAttribute('href', '/sofa-cleaning-london#quote');
  });

  it('replaces empty proof placeholders with an honest fabric-care process', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /The right method starts with the fabric/i })).toBeInTheDocument();
    expect(screen.getByText('Inspect and test')).toBeInTheDocument();
    expect(screen.getByText(/Delicate fabrics need assessment first/)).toBeInTheDocument();
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(hero).toHaveTextContent('£85 minimum booking');
    expect(hero).toHaveTextContent('No VAT is added.');
    expect(hero).not.toHaveTextContent('£5m public liability insurance');
    expect(screen.getAllByText('£5m public liability insurance').length).toBeGreaterThan(0);
    expect(screen.queryByText('Recent results coming soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Video results coming soon')).not.toBeInTheDocument();
  });

  it('keeps other service links and preserves upholstery intent in the final quote links', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Carpet Cleaning' })).toHaveAttribute('href', '/carpet-cleaning-london');
    const quoteLinks = screen.getAllByRole('link', { name: 'Get a sofa quote' });
    expect(quoteLinks.length).toBeGreaterThan(0);
    quoteLinks.forEach(link => expect(link).toHaveAttribute('href', '/sofa-cleaning-london#quote'));
  });
});
