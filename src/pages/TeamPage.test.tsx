import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamPage from './TeamPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { TEAM_SLOTS } from '../data/team';

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

  it('shows exactly six placeholder slots — three founder, three team', () => {
    renderPage();
    expect(TEAM_SLOTS).toHaveLength(6);
    expect(screen.getAllByText('Founder profile pending')).toHaveLength(3);
    expect(screen.getAllByText('Team profile pending')).toHaveLength(3);
  });

  it('does not use fake portraits, invented names or initials', () => {
    renderPage();
    const text = document.body.textContent || '';
    // No slot currently has a real name — only the status placeholder text.
    for (const slot of TEAM_SLOTS) {
      expect(slot.name).toBeNull();
      expect(slot.photoUrl).toBeNull();
    }
    expect(document.querySelectorAll('img').length).toBe(0);
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
});
