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
});
