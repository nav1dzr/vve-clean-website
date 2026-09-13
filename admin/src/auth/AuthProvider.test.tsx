import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import RequireAuth from './RequireAuth';
import { useAuth } from './useAuth';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), subscribe: vi.fn(), signOut: vi.fn(), verify: vi.fn(), clear: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: {
  getSession: mocks.getSession, onAuthStateChange: mocks.subscribe, signOut: mocks.signOut,
} } }));
vi.mock('../lib/invoiceDraftRecovery', () => ({ clearInvoiceDraftRecoveries: mocks.clear }));
vi.mock('./AuthContext', async (original) => ({
  ...await original<typeof import('./AuthContext')>(), fetchAdminProfile: mocks.verify,
}));

function session(id = 'owner-a', token = 'token-a') {
  return { access_token: token, user: { id } } as Session;
}
const verified = (id = 'owner-a') => ({ ok: true as const, admin: { id, displayName: id, email: `${id}@example.invalid` } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let notify: (event: string, next: Session | null) => void;

function WorkingForm() {
  const [value, setValue] = useState('');
  return <input aria-label="Unsaved invoice note" value={value} onChange={event => setValue(event.target.value)} />;
}
function Controls() {
  const auth = useAuth();
  return <><output aria-label="Auth status">{auth.status}</output><button onClick={() => void auth.signOut()}>Sign out now</button></>;
}
function renderApp() {
  return render(<MemoryRouter><AuthProvider><Controls /><Routes><Route path="/" element={<RequireAuth><WorkingForm /></RequireAuth>} /><Route path="/login" element={<p>Login</p>} /></Routes></AuthProvider></MemoryRouter>);
}
async function editedForm() {
  renderApp();
  const input = await screen.findByLabelText('Unsaved invoice note');
  fireEvent.change(input, { target: { value: 'Keep these invoice edits' } });
  return input;
}

describe('AuthProvider phone return and access boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mocks.verify.mockResolvedValue(verified());
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.subscribe.mockImplementation(callback => {
      notify = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('does not mount a form before initial admin verification finishes', async () => {
    const pending = deferred<ReturnType<typeof verified>>();
    mocks.verify.mockReturnValue(pending.promise);
    renderApp();
    await waitFor(() => expect(mocks.verify).toHaveBeenCalled());
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    await act(async () => pending.resolve(verified()));
    expect(await screen.findByLabelText('Unsaved invoice note')).toBeInTheDocument();
  });

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED'])('keeps the exact working form mounted during a same-user %s recheck', async event => {
    const input = await editedForm();
    const pending = deferred<ReturnType<typeof verified>>();
    mocks.verify.mockReturnValueOnce(pending.promise);
    act(() => notify(event, session('owner-a', 'renewed-token')));
    expect(mocks.verify).toHaveBeenLastCalledWith('renewed-token', expect.any(AbortSignal));
    expect(screen.getByLabelText('Unsaved invoice note')).toBe(input);
    expect(input).toHaveValue('Keep these invoice edits');
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('authenticated');
    await act(async () => pending.resolve(verified()));
    expect(screen.getByLabelText('Unsaved invoice note')).toBe(input);
    expect(input).toHaveValue('Keep these invoice edits');
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('removes protected content and recovery when a background check denies access', async () => {
    await editedForm();
    mocks.verify.mockResolvedValueOnce({ ok: false, kind: 'unauthorized' });
    await act(async () => notify('TOKEN_REFRESHED', session()));
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthorized');
    expect(mocks.clear).toHaveBeenCalled();
  });

  it('fails closed on a network failure but retains recoverable edits for a successful retry', async () => {
    await editedForm();
    mocks.verify.mockResolvedValueOnce({ ok: false, kind: 'error' });
    await act(async () => notify('SIGNED_IN', session()));
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(mocks.clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByLabelText('Unsaved invoice note')).toBeInTheDocument();
  });

  it('gates the old user immediately when the session identity changes', async () => {
    await editedForm();
    const pending = deferred<ReturnType<typeof verified>>();
    mocks.verify.mockReturnValueOnce(pending.promise);
    act(() => notify('SIGNED_IN', session('owner-b', 'token-b')));
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('loading');
    expect(mocks.clear).toHaveBeenCalled();
    await act(async () => pending.resolve(verified('owner-b')));
    expect(await screen.findByLabelText('Unsaved invoice note')).toHaveValue('');
  });

  it('a pending same-user success cannot restore access after SIGNED_OUT', async () => {
    await editedForm();
    const pending = deferred<ReturnType<typeof verified>>();
    mocks.verify.mockReturnValueOnce(pending.promise);
    act(() => notify('TOKEN_REFRESHED', session()));
    const signal = mocks.verify.mock.lastCall![1] as AbortSignal;
    act(() => notify('SIGNED_OUT', null));
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(verified()));
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthenticated');
  });

  it('explicit sign-out gates immediately and invalidates pending checks before its network request completes', async () => {
    await editedForm();
    const pending = deferred<ReturnType<typeof verified>>();
    const signingOut = deferred<{ error: null }>();
    mocks.verify.mockReturnValueOnce(pending.promise);
    mocks.signOut.mockReturnValueOnce(signingOut.promise);
    act(() => notify('TOKEN_REFRESHED', session()));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out now' }));
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
    await act(async () => {
      notify('SIGNED_IN', session());
      pending.resolve(verified());
    });
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthenticated');
    await act(async () => signingOut.resolve({ error: null }));
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthenticated');
  });

  it('ignores an older successful check after a newer user is denied', async () => {
    await editedForm();
    const oldCheck = deferred<ReturnType<typeof verified>>();
    mocks.verify.mockReturnValueOnce(oldCheck.promise).mockResolvedValueOnce({ ok: false, kind: 'unauthorized' });
    act(() => notify('TOKEN_REFRESHED', session()));
    await act(async () => notify('SIGNED_IN', session('owner-b', 'token-b')));
    await act(async () => oldCheck.resolve(verified()));
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthorized');
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
  });

  it('ignores a late bootstrap session after a newer auth event', async () => {
    const bootstrap = deferred<{ data: { session: Session }; error: null }>();
    mocks.getSession.mockReturnValueOnce(bootstrap.promise);
    renderApp();
    act(() => notify('SIGNED_OUT', null));
    await act(async () => bootstrap.resolve({ data: { session: session() }, error: null }));
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('unauthenticated');
  });

  it('shows a retryable error if initial session loading rejects', async () => {
    mocks.getSession.mockRejectedValueOnce(new Error('Synthetic network failure'));
    renderApp();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Unsaved invoice note')).not.toBeInTheDocument();
  });
});
