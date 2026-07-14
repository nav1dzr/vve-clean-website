import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

// Split from AuthProvider.tsx/useAuth.ts (Phase 4) purely to satisfy
// react-refresh/only-export-components — this file exports no component,
// so Fast Refresh has nothing to warn about. No behavioural change from
// the original single-file version.

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

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  admin: AdminProfile | null;
  signOut: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export async function fetchAdminProfile(accessToken: string): Promise<
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
