import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AdminProfile {
  id: string;
  displayName: string;
  email: string;
}

// loading       — initial session resolution, or an admin-verification check in flight
// unauthenticated — no Supabase session at all
// unauthorized  — a valid Supabase session exists, but the user is not in admin_users
// authenticated — valid session, verified admin
// error         — the session is valid but /api/me could not be reached (network/server
//                 failure). Deliberately distinct from "unauthorized" — a transient
//                 network blip must never be presented to the admin as "you are not
//                 authorised", since that is a different, more alarming claim.
export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'unauthorized'
  | 'authenticated'
  | 'error';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  admin: AdminProfile | null;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchAdminProfile(accessToken: string): Promise<
  | { ok: true; admin: AdminProfile }
  | { ok: false; kind: 'unauthorized' | 'error' }
> {
  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 200) {
      const data = await res.json();
      return {
        ok: true,
        admin: { id: data.id, displayName: data.displayName, email: data.email },
      };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, kind: 'unauthorized' };
    }

    return { ok: false, kind: 'error' };
  } catch {
    return { ok: false, kind: 'error' };
  }
}

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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
