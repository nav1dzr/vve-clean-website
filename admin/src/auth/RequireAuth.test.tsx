import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import type { AuthStatus } from './AuthContext';

const useAuthMock = vi.fn();

vi.mock('./useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

function mockAuth(status: AuthStatus, retry = vi.fn()) {
  useAuthMock.mockReturnValue({ status, retry, session: null, admin: null, signOut: vi.fn() });
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Secret booking data</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('renders no protected content while auth is loading', () => {
    mockAuth('loading');
    renderProtected();

    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockAuth('unauthenticated');
    renderProtected();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('shows the unauthorised page for a non-admin session, never the protected content', () => {
    mockAuth('unauthorized');
    renderProtected();

    expect(screen.getByText(/not authorised/i)).toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('shows a retryable error screen when session verification fails, never the protected content', () => {
    mockAuth('error');
    renderProtected();

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('explains blocked preview setup without alleging missing admin access or mounting protected content', () => {
    const retry = vi.fn();
    mockAuth('preview-blocked', retry);
    renderProtected();
    expect(screen.getByRole('heading', { name: 'Preview setup required' })).toBeInTheDocument();
    expect(screen.getByText(/Your admin access has not been checked yet/)).toBeInTheDocument();
    expect(screen.queryByText(/not set up as an admin/)).not.toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('sends a rejected session back to sign-in without alleging missing admin access', () => {
    mockAuth('session-expired');
    renderProtected();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText(/not authorised/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('fails closed even for an unexpected runtime auth status', () => {
    mockAuth('unknown' as AuthStatus);
    renderProtected();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Secret booking data')).not.toBeInTheDocument();
  });

  it('renders protected content only once authenticated as a verified admin', () => {
    mockAuth('authenticated');
    renderProtected();

    expect(screen.getByText('Secret booking data')).toBeInTheDocument();
  });
});
