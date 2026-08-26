import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from './AboutPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderAbout() {
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <CookieConsentProvider>
        <AboutPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('AboutPage — team and trust', () => {
  // The business is three people, not one owner with helpers. "Owner-led"
  // undersells that and was the last such phrasing on the site.
  it('does not describe the business as owner-led or owner-operated', () => {
    const { container } = renderAbout();
    expect(container.textContent ?? '').not.toMatch(/owner[-\s]?(led|operated)/i);
  });

  it('presents VVE Clean as a team a customer can contact', () => {
    renderAbout();
    expect(
      screen.getByRole('heading', { name: /a local team you can contact directly/i }),
    ).toBeInTheDocument();
  });

  it('links to the Checkatrade profile as independent proof', () => {
    renderAbout();

    const link = screen.getByRole('link', { name: /see our checkatrade profile/i });
    expect(link).toHaveAttribute('href', 'https://www.checkatrade.com/trades/vvelimited');
    expect(link).toHaveAttribute('target', '_blank');
    // Prevents the opened tab from gaining access to window.opener.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  // A hard-coded rating goes stale silently and becomes a false claim the day
  // a new review lands. The link is what stays true.
  it('does not publish a fixed review score or review count', () => {
    const { container } = renderAbout();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/9\.6|9\.7|\/10\b/);
    expect(text).not.toMatch(/\b\d+\s+reviews?\b/i);
  });

  it('shows no team section, empty card or photo placeholder while the roster is empty', () => {
    const { container } = renderAbout();
    const text = container.textContent ?? '';

    expect(screen.queryByRole('heading', { name: /who comes to your property/i })).not.toBeInTheDocument();
    expect(text).not.toMatch(/placeholder|coming soon|photo here/i);
  });

  it('keeps only verifiable company facts on the page', () => {
    renderAbout();

    expect(screen.getByText(/company number 17234391/i)).toBeInTheDocument();
    expect(screen.getByText(/£5m public liability/i)).toBeInTheDocument();
  });

  // DBS scope is a per-person fact; the repo already guards against a
  // site-wide claim on the service pages.
  it('makes no blanket DBS or staff-credential claim', () => {
    const { container } = renderAbout();
    expect(container.textContent ?? '').not.toMatch(/DBS/);
  });
});
