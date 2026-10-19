import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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
          <Route path="/media" element={<div>Media page</div>} />
          <Route path="/search" element={<div>Search page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedShell', () => {
  afterEach(() => vi.unstubAllGlobals());
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
  it('makes every secondary section reachable from More and closes on navigation', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('dialog', { name: 'More in your CRM' });
    for (const name of ['Enquiries', 'Receipts', 'Catalogue', 'Media', 'Website prices', 'Customers', 'Search']) {
      expect(within(menu).getByRole('link', { name })).toBeInTheDocument();
    }
    await user.click(within(menu).getByRole('link', { name: 'Media' }));
    expect(screen.getByText('Media page')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes More with Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    renderShell();
    const more = screen.getByRole('button', { name: 'More' });
    await user.click(more);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('unmounts More when switching to desktop and does not reopen on returning to mobile', async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
    const user = userEvent.setup();
    const { unmount } = renderShell();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('dialog', { name: 'More in your CRM' })).toBeInTheDocument();
    act(() => {
      mediaQuery.matches = true;
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      mediaQuery.matches = false;
      listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    expect(listeners.size).toBe(0);
  });

});
