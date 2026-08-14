import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamPage from './TeamPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { TEAM_SLOTS } from '../data/team';
import { CHECKATRADE_URL } from '../data/contactDetails';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <TeamPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('TeamPage', () => {
  it('renders Navbar, a single main landmark and Footer — not a blank page', () => {
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('shows exactly six placeholder slots — three founding team, three team', () => {
    renderPage();
    expect(TEAM_SLOTS).toHaveLength(6);
    expect(screen.getAllByText('Founding team')).toHaveLength(3);
    expect(screen.getAllByText('Team member')).toHaveLength(3);
  });

  it('uses a tasteful "Photo and profile coming soon" headline, not raw "pending" status text', () => {
    renderPage();
    expect(screen.getAllByText('Photo and profile coming soon')).toHaveLength(6);
    expect(screen.queryByText(/profile pending/i)).not.toBeInTheDocument();
  });

  it('does not use fake portraits, invented names, initials or roles', () => {
    renderPage();
    for (const slot of TEAM_SLOTS) {
      expect(slot.name).toBeNull();
      expect(slot.role).toBeNull();
      expect(slot.photoUrl).toBeNull();
    }
    expect(document.querySelectorAll('img').length).toBe(0);
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\b[A-Z]\.[A-Z]\.\b/); // no "J.D." style initials
  });

  it('reserves a 4:5 image aspect ratio for each placeholder', () => {
    const { container } = render(
      <MemoryRouter>
        <CookieConsentProvider>
          <TeamPage />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    const slots = container.querySelectorAll('.aspect-\\[4\\/5\\]');
    expect(slots).toHaveLength(6);
  });

  it('states only supported team trust facts (DBS-checked, insured, guarantee)', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toMatch(/DBS-checked/);
    expect(text).toMatch(/£5m public liability insurance/);
    expect(text).toMatch(/re-clean guarantee/);
    // Must NOT claim staff selection, subcontractor policy, uniforms/ID,
    // individual training or "who normally attends" until the owner supplies
    // those facts.
    expect(text.toLowerCase()).not.toMatch(/subcontractor|uniform|id badge|normally attends|hand-picked|hire only/);
  });

  it('is team-first — never frames VVE Clean as owner-operated', () => {
    renderPage();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(/owner-operated|owner-run|not a single owner|not one person|founder attends/);
  });

  it('links prominently to the external Checkatrade profile without a hardcoded rating', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /view our checkatrade profile/i });
    expect(link).toHaveAttribute('href', CHECKATRADE_URL);
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\d(\.\d)?\s*(out of|\/)\s*5|\d+\s*reviews/i);
  });
});
