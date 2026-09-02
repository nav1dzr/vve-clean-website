import { createClient } from '@supabase/supabase-js';
import { checkServerEnv } from './env.js';

// Deliberately not cached at module scope — see the comment in adminAuth.js
// for the rationale (serverless invocation independence + test isolation).
// Shared by every admin API route that needs to read/write bookings after
// verifyAdminRequest() has already confirmed the caller is an authorised
// admin — never imported from admin/src/.
export function getServiceClient() {
  if (!checkServerEnv()) return null;

  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

// This client is used exclusively by the Preview media handlers. It has its
// own server-only URL so the temporary VVE OS data connection can never leak
// into a browser configuration. During the transition, the existing
// branch-scoped service key remains the fallback: it is server-only and is
// removed from the browser-facing VITE variables by the accompanying Preview
// environment change.
export function getMediaServiceClient() {
  const url = process.env.MEDIA_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.MEDIA_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('[admin/media] missing server-only media Supabase configuration');
    return null;
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

// Verifying a CRM access token only needs the CRM project's public anon key;
// it does not grant table access. This is intentionally separate from the
// VVE OS media service client above.
export function getCrmAuthClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('[admin/media] missing CRM Auth configuration');
    return null;
  }

  return createClient(url, anonKey, { auth: { persistSession: false } });
}
