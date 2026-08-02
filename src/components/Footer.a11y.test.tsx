// Footer accessibility regressions found while auditing the routed pages.
//
// The footer renders on every route, so both of these were site-wide: three
// icon-only social links that a screen reader read out as raw share URLs, and
// column headings that jumped straight from h2 (or h1 on /gallery) to h4.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderFooter() {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <Footer />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('Footer accessibility', () => {
  it('names every icon-only social link', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: 'VVE Clean on Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'VVE Clean on Instagram' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Message VVE Clean on WhatsApp' })).toBeInTheDocument();
  });

  it('leaves no link without an accessible name', () => {
    const { container } = renderFooter();

    const unnamed = [...container.querySelectorAll('a')].filter(
      (a) => !a.textContent?.trim() && !a.getAttribute('aria-label'),
    );
    expect(unnamed.map((a) => a.getAttribute('href'))).toEqual([]);
  });

  it('uses h2 for the column headings so no level is skipped', () => {
    const { container } = renderFooter();

    expect(screen.getByRole('heading', { level: 2, name: 'Links' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Contact' })).toBeInTheDocument();
    // An h4 here would skip a level on every page on the site.
    expect(container.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0);
  });
});
