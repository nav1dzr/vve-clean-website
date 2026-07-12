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
