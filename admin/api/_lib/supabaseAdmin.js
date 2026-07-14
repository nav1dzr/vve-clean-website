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
