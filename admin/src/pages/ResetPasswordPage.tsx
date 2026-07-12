import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Mode = 'request' | 'update';

// Single route handling both the "request a reset link" step and, when
// arrived at via a Supabase recovery link (which fires a PASSWORD_RECOVERY
// auth event), the "set a new password" completion step. Approved as one
// route rather than two — ADMIN_CRM_PLAN.md §13.
export default function ResetPasswordPage() {
  const [mode, setMode] = useState<Mode>('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const redirectTo = `${window.location.origin}/reset-password`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setSubmitting(false);
    // Same message regardless of whether the account exists — never confirms
    // or denies a registered admin email to an unauthenticated caller.
    setMessage("If that email is registered, we've sent a password reset link.");
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (updateError) {
      setError('Could not update your password. Request a new reset link and try again.');
      return;
    }

    setMessage('Password updated. You can now sign in with your new password.');
  }

  if (mode === 'update') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-silver-100 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center font-semibold text-lg text-navy-950">
            Set a new password
          </h1>
          <form onSubmit={handleUpdate} noValidate>
            <div className="mb-5">
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-navy-900">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-silver-300 px-3.5 py-2.5 text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            {error && (
              <p role="alert" className="mb-4 text-sm text-red-600">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="mb-4 text-sm text-green-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 w-full items-center justify-center rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-silver-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center font-semibold text-lg text-navy-950">Reset password</h1>
        <p className="mb-6 text-center text-sm text-navy-700">
          Enter your admin email and we'll send you a reset link.
        </p>
        <form onSubmit={handleRequest} noValidate>
          <div className="mb-5">
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

          {message && (
            <p role="status" className="mb-4 text-sm text-green-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>

          <p className="mt-5 text-center text-sm text-navy-700">
            <Link to="/login" className="text-sky-600 hover:text-sky-700">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
