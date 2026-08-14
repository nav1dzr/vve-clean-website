import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from './AboutPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { CHECKATRADE_URL } from '../data/contactDetails';

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

  it('is team-first — never frames VVE Clean as owner-operated or founder-attends-every-job', () => {
    renderPage();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(/owner-operated|owner-run|same cleaner attends every job|founder attends|one owner|not a single owner|not one person/);
    expect(text).toMatch(/a real team with shared standards/);
  });

  it('does not disparage previous employers (no "rushed", "corners cut" or "chasing" claims)', () => {
    renderPage();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(/rushed|corners cut|chasing someone|none of it (felt|matched)/);
  });

  it('states the real, already-published guarantee length rather than a new number', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toContain(`${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`);
  });

  it('links prominently to the external Checkatrade profile without a hardcoded rating', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /view our checkatrade profile/i });
    expect(link).toHaveAttribute('href', CHECKATRADE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\d(\.\d)?\s*(out of|\/)\s*5|\d+\s*reviews/i);
  });

  it('links through to the team and contact pages', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Meet the team' })).toHaveAttribute('href', '/team');
    expect(screen.getAllByRole('link', { name: /contact us/i })[0]).toHaveAttribute('href', '/contact');
  });

  it('emits non-exaggerated AboutPage JSON-LD (no aggregateRating or fabricated founding date)', () => {
    const { container } = render(
      <MemoryRouter>
        <CookieConsentProvider>
          <AboutPage />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const schema = JSON.parse(script!.innerHTML);
    expect(schema['@type']).toBe('AboutPage');
    expect(schema.mainEntity.sameAs).toContain(CHECKATRADE_URL);
    expect(JSON.stringify(schema)).not.toMatch(/aggregateRating|foundingDate/);
  });
});
