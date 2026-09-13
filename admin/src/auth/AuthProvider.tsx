import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearInvoiceDraftRecoveries } from '../lib/invoiceDraftRecovery';
import { AuthContext, fetchAdminProfile, type AdminProfile, type AuthStatus } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const requestId = useRef(0);
  const verification = useRef<AbortController | null>(null);
  const verifiedUserId = useRef<string | null>(null);
  const sessionUserId = useRef<string | null>(null);
  const signingOut = useRef(false);
  const invalidateVerification = useCallback(() => {
    ++requestId.current;
    verification.current?.abort();
    verification.current = null;
  }, []);

  const verify = useCallback(async (nextSession: Session | null) => {
    const myRequestId = ++requestId.current;
    verification.current?.abort();
    verification.current = null;
    const nextUserId = nextSession?.user.id ?? null;

    if (sessionUserId.current && sessionUserId.current !== nextUserId) {
      clearInvoiceDraftRecoveries();
    }
    sessionUserId.current = nextUserId;

    if (!nextSession) {
      verifiedUserId.current = null;
      clearInvoiceDraftRecoveries();
      setStatus('unauthenticated');
      setAdmin(null);
      return;
    }

    // Supabase emits SIGNED_IN when a tab becomes visible again, including
    // for the same session. Recheck access without unmounting that user's
    // working form. First login and identity changes still gate all content.
    if (verifiedUserId.current !== nextUserId) {
      verifiedUserId.current = null;
      setAdmin(null);
      setStatus('loading');
    }

    const controller = new AbortController();
    verification.current = controller;
    const result = await fetchAdminProfile(nextSession.access_token, controller.signal);
    if (myRequestId !== requestId.current) return;
    verification.current = null;

    if (result.ok) {
      verifiedUserId.current = nextUserId;
      setAdmin(result.admin);
      setStatus('authenticated');
    } else {
      verifiedUserId.current = null;
      setAdmin(null);
      if (result.kind === 'unauthorized') {
        clearInvoiceDraftRecoveries();
        setStatus('unauthorized');
      } else {
        // Keep local recovery on a network failure, but fail closed until
        // the server can verify access again.
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      receivedAuthEvent = true;
      if (signingOut.current && nextSession) return;
      setSession(nextSession);
      void verify(nextSession);
    });

    const bootstrapRequestId = requestId.current;
    void supabase.auth.getSession().then(({ data, error }) => {
      // A late bootstrap snapshot must not overwrite a newer sign-in/out.
      if (!mounted || receivedAuthEvent || signingOut.current || bootstrapRequestId !== requestId.current) return;
      if (error) {
        setStatus('error');
        return;
      }
      setSession(data.session);
      void verify(data.session);
    }).catch(() => {
      if (mounted && !receivedAuthEvent && !signingOut.current && bootstrapRequestId === requestId.current) setStatus('error');
    });

    return () => {
      mounted = false;
      invalidateVerification();
      subscription.subscription.unsubscribe();
    };
  }, [verify, invalidateVerification]);

  const signOut = useCallback(async () => {
    // Invalidate pending verification before waiting for the network. A
    // late successful response must never restore a signed-out user's UI.
    signingOut.current = true;
    invalidateVerification();
    verifiedUserId.current = null;
    sessionUserId.current = null;
    clearInvoiceDraftRecoveries();
    setAdmin(null);
    setSession(null);
    setStatus('unauthenticated');
    try {
      await supabase.auth.signOut();
    } finally {
      signingOut.current = false;
    }
  }, [invalidateVerification]);

  const retry = useCallback(() => {
    void verify(session);
  }, [session, verify]);

  return (
    <AuthContext.Provider value={{ status, session, admin, signOut, retry }}>
      {children}
    </AuthContext.Provider>
  );
}
