import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TeamSection from './TeamSection';
import { MAX_TEAM_MEMBERS, TEAM_MEMBERS, initialsFor } from '../data/team';

// The About page previously carried a customer-facing "Team photo placeholder"
// card (see docs/FINAL_COMPLETION_LOG.md). The rule this file enforces is that
// missing team data produces *nothing*, never an empty box or a stock face.

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../data/team');
});

async function renderWithMembers(members: unknown[]) {
  vi.doMock('../data/team', async () => {
    const actual = await vi.importActual<typeof import('../data/team')>('../data/team');
    return { ...actual, TEAM_MEMBERS: members };
  });
  const { default: Section } = await import('./TeamSection');
  return render(<Section />);
}

describe('TeamSection — graceful degradation', () => {
  it('renders nothing at all when no team members are configured', () => {
    const { container } = render(<TeamSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ships with an empty roster, so no unconfirmed person is published', () => {
    expect(TEAM_MEMBERS).toHaveLength(0);
  });

  it('shows initials instead of an empty photo box when a member has no photograph', async () => {
    await renderWithMembers([{ name: 'Alex Morgan', role: 'Cleaning technician' }]);

    expect(screen.getByRole('heading', { name: 'Alex Morgan' })).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a photograph with a descriptive alt when one is supplied', async () => {
    await renderWithMembers([
      { name: 'Alex Morgan', role: 'Cleaning technician', photo: '/team/alex.avif' },
    ]);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/team/alex.avif');
    expect(img).toHaveAccessibleName('Alex Morgan, Cleaning technician at VVE Clean');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('omits optional detail lines rather than rendering empty ones', async () => {
    const { container } = await renderWithMembers([
      { name: 'Alex Morgan', role: 'Cleaning technician' },
    ]);

    expect(container.querySelector('dl')).toBeNull();
    expect(screen.queryByText(/DBS checked/)).not.toBeInTheDocument();
  });

  it('shows DBS status only for a member explicitly marked as checked', async () => {
    await renderWithMembers([
      { name: 'Alex Morgan', role: 'Technician', dbsChecked: true },
      { name: 'Sam Patel', role: 'Technician' },
    ]);

    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]).getByText('DBS checked')).toBeInTheDocument();
    expect(within(cards[1]).queryByText('DBS checked')).not.toBeInTheDocument();
  });

  it('renders experience and training when supplied', async () => {
    await renderWithMembers([
      {
        name: 'Alex Morgan',
        role: 'Technician',
        experience: 'Eight years in end of tenancy cleaning',
        training: 'IICRC carpet cleaning certification',
      },
    ]);

    expect(screen.getByText('Eight years in end of tenancy cleaning')).toBeInTheDocument();
    expect(screen.getByText('IICRC carpet cleaning certification')).toBeInTheDocument();
  });

  it('renders every configured member as a list item', async () => {
    await renderWithMembers([
      { name: 'A One', role: 'Technician' },
      { name: 'B Two', role: 'Technician' },
      { name: 'C Three', role: 'Technician' },
      { name: 'D Four', role: 'Technician' },
    ]);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('team data rules', () => {
  it('caps the roster at six, the size the grid is designed for', () => {
    expect(MAX_TEAM_MEMBERS).toBe(6);
    expect(TEAM_MEMBERS.length).toBeLessThanOrEqual(MAX_TEAM_MEMBERS);
  });

  it('derives initials from the first two name parts', () => {
    expect(initialsFor('Alex Morgan')).toBe('AM');
    expect(initialsFor('Alex')).toBe('A');
    expect(initialsFor('Alex James Morgan')).toBe('AJ');
  });

  it('requires a name and role for every member that is added later', () => {
    for (const member of TEAM_MEMBERS) {
      expect(member.name.trim()).not.toBe('');
      expect(member.role.trim()).not.toBe('');
    }
  });
});
