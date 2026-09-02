// Validates required server-only environment variables at runtime. Never
// returns or logs the values themselves — only which names are missing, and
// only to the server log, never in an API response.

const REQUIRED_SERVER_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export function checkServerEnv() {
  const missing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('[admin/api] missing required env vars:', missing.join(', '));
    return false;
  }
  return true;
}

export function isProduction() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

// The media-system branch is a deliberately narrow Preview-only surface. Its
// temporary media database is VVE OS, but neither the CRM browser nor normal
// CRM API routes may use that project. Keeping the switch server-only avoids
// shipping the implementation detail to the browser bundle.
export function isMediaPreview() {
  return process.env.MEDIA_PREVIEW_MODE === 'true';
}
