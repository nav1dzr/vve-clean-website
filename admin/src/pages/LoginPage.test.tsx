import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';

const signInWithPasswordMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
    },
  },
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

function Destination() {
  const location = useLocation();
  return <div>Returned to {location.pathname}{location.search}{location.hash}</div>;
}

function renderLoginPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard Home</div>} />
        <Route path="/bookings/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    useAuthMock.mockReturnValue({ status: 'unauthenticated' });
  });

  it.each(['authenticated', 'unauthenticated'])('restores the original page and filters after %s sign-in', async (status) => {
    useAuthMock.mockReturnValue({ status });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    renderLoginPage({ from: { pathname: '/bookings/test-booking', search: '?view=details', hash: '#delivery' } });
    if (status === 'unauthenticated') {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
      await user.type(screen.getByLabelText(/password/i), 'test-password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
    }
    expect(await screen.findByText('Returned to /bookings/test-booking?view=details#delivery')).toBeInTheDocument();
  });

  it.each(['https://example.com', '//example.com', '/login', '/login/', '/\\example.com', 42])('rejects unsafe return path %s', (pathname) => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    renderLoginPage({ from: { pathname } });
    expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
  });

  it('allows retry after a network failure', async () => {
    signInWithPasswordMock.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/password/i), 'test-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument();
  });

  it('renders accessible email and password fields and no sign-up link', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/register/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });

  it('does not attempt sign-in when required fields are left empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('shows a generic error message on failed sign-in, without revealing the cause', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password.');
  });

  it('navigates to the dashboard on successful sign-in', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument();
  });

  it('redirects away from /login when a session is already authenticated', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    renderLoginPage();

    expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
  });

});
