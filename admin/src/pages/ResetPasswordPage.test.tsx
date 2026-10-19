import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

const resetPasswordForEmailMock = vi.fn();
const updateUserMock = vi.fn();
let authStateCallback: ((event: string, session: unknown) => void) | null = null;

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockReset();
    updateUserMock.mockReset();
    authStateCallback = null;
  });

  it('shows the request form by default', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows a generic confirmation message regardless of whether the email is registered', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/if that email is registered/i);
  });

  it('switches to the update-password form on a PASSWORD_RECOVERY event', () => {
    renderPage();

    act(() => {
      authStateCallback?.('PASSWORD_RECOVERY', {});
    });

    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
  });

  it('submits the new password and shows a success message', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null });
    renderPage();

    act(() => {
      authStateCallback?.('PASSWORD_RECOVERY', {});
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/new password/i), 'a-new-strong-password');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/password updated/i);
  });
  it.each(['', 'not-an-email'])('does not send a recovery request for invalid email %s', async (email) => {
    const user = userEvent.setup();
    renderPage();
    if (email) await user.type(screen.getByLabelText(/email/i), email);
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInvalid();
  });

  it.each([503, 429])('reports a recovery service failure %s without claiming a link was sent', async (status) => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: { status, message: 'Provider details must stay private' } });
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/service is unavailable/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/provider details/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/if that email is registered/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves the generic account-existence response', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { status: 400, code: 'user_not_found' } });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/if that email is registered/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('recovers the request button after a thrown transport failure', async () => {
    resetPasswordForEmailMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/service is unavailable/i);
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeEnabled();
  });

  it('does not submit a short recovery password', async () => {
    const user = userEvent.setup();
    renderPage();
    act(() => { authStateCallback?.('PASSWORD_RECOVERY', {}); });
    await user.type(screen.getByLabelText(/new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('recovers the update button after a rejected network request', async () => {
    updateUserMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPage();
    act(() => { authStateCallback?.('PASSWORD_RECOVERY', {}); });
    await user.type(screen.getByLabelText(/new password/i), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not update/i);
    expect(screen.getByRole('button', { name: /update password/i })).toBeEnabled();
  });

});
