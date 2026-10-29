import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';

// Deliberately generic — never reveals whether an email is registered, or
// whether the failure was a bad password vs. an unknown account.
const GENERIC_ERROR = 'Invalid email or password.';

function returnAfterSignIn(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from;
  const pathname = from?.pathname;
  // Only local CRM paths: never allow an external destination or a login loop.
  if (!from || typeof pathname !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(pathname) || /^\/login\/?$/.test(pathname)) return '/';
  const search = typeof from.search === 'string' && /^\?[^#\r\n\\]*$/.test(from.search) ? from.search : '';
  const hash = typeof from.hash === 'string' && /^#[^\r\n\\]*$/.test(from.hash) ? from.hash : '';
  return pathname + search + hash;
}

export default function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = returnAfterSignIn(location.state);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Belt-and-braces alongside the `required` HTML attribute — some
    // browsers (and test environments) don't block a synthetic submit on an
    // empty required field, and sign-in should never be attempted with
    // blank credentials regardless.
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(GENERIC_ERROR);
        return;
      }
      navigate(returnTo, { replace: true });
    } catch {
      setError('Could not connect. Please try signing in again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-silver-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center font-semibold text-lg tracking-wide text-navy-950">
          VVE CLEAN
        </h1>
        <p className="mb-6 text-center text-sm text-navy-700">Admin sign in</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-silver-300 px-3.5 py-2.5 text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="mb-2">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy-900">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-silver-300 px-3.5 py-2.5 text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="mb-5 text-right">
            <Link to="/reset-password" className="text-sm text-sky-600 hover:text-sky-700">
              Forgot password?
            </Link>
          </div>

          {error && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

        </form>
      </div>
    </div>
  );
}
