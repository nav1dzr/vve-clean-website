import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedShell from './ProtectedShell';

const useAuthMock = vi.fn();

vi.mock('../auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

function renderShell(initialEntries = ['/bookings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/bookings" element={<div>Bookings page</div>} />
          <Route path="/search" element={<div>Search page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedShell', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      admin: { id: 'a', displayName: 'Sam Wilson', email: 'sam@example.com' },
      signOut: vi.fn(),
    });
  });

  it('renders Home, Bookings, and Search navigation links (mobile + desktop nav both present in the DOM)', () => {
    renderShell();
    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Bookings' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Search' }).length).toBeGreaterThan(0);
  });

  it('marks the current route as the active nav item', () => {
    renderShell(['/bookings']);
    const bookingsLinks = screen.getAllByRole('link', { name: 'Bookings' });
    expect(bookingsLinks.some((el) => el.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('renders the protected page content passed via the router outlet', () => {
    renderShell(['/bookings']);
    expect(screen.getByText('Bookings page')).toBeInTheDocument();
  });

  it('calls signOut when a logout control is activated', async () => {
    const signOut = vi.fn();
    useAuthMock.mockReturnValue({
      admin: { id: 'a', displayName: 'Sam Wilson', email: 'sam@example.com' },
      signOut,
    });
    const user = userEvent.setup();
    renderShell();

    const logoutButtons = screen.getAllByRole('button', { name: /log\s?out/i });
    await user.click(logoutButtons[0]);

    expect(signOut).toHaveBeenCalled();
  });

  it('shows the signed-in admin display name', () => {
    renderShell();
    expect(screen.getByText('Sam Wilson')).toBeInTheDocument();
  });
});
