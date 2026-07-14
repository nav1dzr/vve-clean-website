import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders protected content only once authenticated as a verified admin', () => {
    mockAuth('authenticated');
    renderProtected();

    expect(screen.getByText('Secret booking data')).toBeInTheDocument();
  });
});
