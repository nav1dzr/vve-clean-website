import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamTrust from './TeamTrust';
import { CHECKATRADE_URL } from '../data/contactDetails';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';

function renderSection() {
  render(
    <MemoryRouter>
      <TeamTrust />
    </MemoryRouter>,
  );
}

describe('TeamTrust (homepage section)', () => {
  it('is team-first — not a founder spotlight, and mentions no single owner attending jobs', () => {
    renderSection();
    const text = document.body.textContent || '';
    expect(text).toMatch(/three friends who had each worked for different cleaning companies/i);
    expect(text.toLowerCase()).not.toMatch(/founder attends|same cleaner attends every job|one owner/);
  });

  it('states only supported trust facts', () => {
    renderSection();
    const text = document.body.textContent || '';
    expect(text).toMatch(/DBS-checked cleaners/);
    expect(text).toMatch(/£5m public liability insurance/);
    expect(text).toContain(`${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`);
  });

  it('links to the external Checkatrade profile without a hardcoded rating or review count', () => {
    renderSection();
    const link = screen.getByRole('link', { name: /view our checkatrade profile/i });
    expect(link).toHaveAttribute('href', CHECKATRADE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\d(\.\d)?\s*(out of|\/)\s*5|\d+\s*reviews/i);
  });

  it('links through to the dedicated /team page', () => {
    renderSection();
    expect(screen.getByRole('link', { name: 'Meet the team' })).toHaveAttribute('href', '/team');
  });

  it('reserves a group-photo placeholder with honest alt text rather than a fake image', () => {
    const { container } = render(
      <MemoryRouter>
        <TeamTrust />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.querySelectorAll('.aspect-\\[4\\/3\\]')).toHaveLength(1);
    expect(screen.getByText(/group photo coming soon/i)).toBeInTheDocument();
  });
});
