import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from './AboutPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <AboutPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('AboutPage', () => {
  it('renders Navbar, a single main landmark and Footer — not a blank page', () => {
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('tells the three-friends origin story without inventing specifics', () => {
    renderPage();
    const text = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(text).toMatch(/three friends who had each worked for different cleaning companies/i);
    // No invented founding year or job-count claims.
    expect(text).not.toMatch(/founded in (19|20)\d{2}/i);
    expect(text).not.toMatch(/\b\d[,\d]*\+?\s*(jobs|cleans|customers)\b/i);
  });

  it('states the real, already-published guarantee length rather than a new number', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toContain(`${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`);
  });

  it('links through to the team and contact pages', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Meet the team' })).toHaveAttribute('href', '/team');
    expect(screen.getAllByRole('link', { name: /contact us/i })[0]).toHaveAttribute('href', '/contact');
  });
});
