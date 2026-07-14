import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContext, fetchAdminProfile, type AdminProfile, type AuthStatus } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  // Guards against a stale verification response overwriting state after a
  // newer session change (e.g. rapid sign-out immediately after sign-in).
  const requestId = useRef(0);

  const verify = useCallback(async (nextSession: Session | null) => {
    const myRequestId = ++requestId.current;

    if (!nextSession) {
      setStatus('unauthenticated');
      setAdmin(null);
      return;
    }

    setStatus('loading');
    const result = await fetchAdminProfile(nextSession.access_token);
    if (myRequestId !== requestId.current) return; // superseded by a newer change

    if (result.ok) {
      setAdmin(result.admin);
      setStatus('authenticated');
    } else if (result.kind === 'unauthorized') {
      setAdmin(null);
      setStatus('unauthorized');
    } else {
      setAdmin(null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      void verify(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void verify(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [verify]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange fires SIGNED_OUT with a null session, which drives
    // verify(null) above and clears `admin` — but clear it here too so no
    // in-memory admin data survives even a moment longer than necessary.
    setAdmin(null);
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const retry = useCallback(() => {
    void verify(session);
  }, [session, verify]);

  return (
    <AuthContext.Provider value={{ status, session, admin, signOut, retry }}>
      {children}
    </AuthContext.Provider>
  );
}
