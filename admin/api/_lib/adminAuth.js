// Reusable server-side authentication/authorisation helper for every admin
// API route. Holds the only code path in this app that touches the
// service-role key — never imported from admin/src/.

import { createClient } from '@supabase/supabase-js';
import { checkServerEnv } from './env.js';

// Deliberately not cached at module scope — keeps each invocation's
// behaviour independent of what ran before it (important both for
// serverless cold/warm-start correctness and for test isolation), at the
// cost of one cheap client construction per request.
function getServiceClient() {
  if (!checkServerEnv()) return null;

  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

function extractBearerToken(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

// Verifies the caller's Supabase access token and confirms the resulting
// user is present in admin_users.
//
// Returns one of:
//   { ok: true, admin: { id, email, displayName } }
//   { ok: false, status: 401, error }   — missing/invalid/expired token
//   { ok: false, status: 403, error }   — valid account, not an admin
//   { ok: false, status: 500, error }   — server misconfigured / lookup failed
//
// The 500 branch never includes which env var is missing or any internal
// detail in the response body — only a generic message. Details are logged
// server-side only.
export async function verifyAdminRequest(req) {
  const supabase = getServiceClient();
  if (!supabase) {
    return { ok: false, status: 500, error: 'Server misconfiguration' };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Missing bearer token' };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }

  const user = userData.user;

  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (adminErr) {
    console.error('[admin/api] admin_users lookup failed:', adminErr.code, adminErr.message);
    return { ok: false, status: 500, error: 'Authorisation check failed' };
  }

  if (!adminRow) {
    return { ok: false, status: 403, error: 'Not an authorised admin' };
  }

  return {
    ok: true,
    admin: {
      id: user.id,
      email: user.email || '',
      displayName: adminRow.display_name,
    },
  };
}
