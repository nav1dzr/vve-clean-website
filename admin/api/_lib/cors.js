import { isProduction } from './env.js';

// Development-only fallback origins — the admin app's own Vite dev server
// ports (5174/4174), deliberately different from the public site's
// (5173/4173) so the two apps never share an allowed-origin list by accident.
const DEV_ORIGINS = ['http://localhost:5174', 'http://localhost:4174'];

function configuredOrigins() {
  return (process.env.ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Restricted CORS — only an explicitly configured origin (or, outside
// production, the admin app's own dev server) may call admin/api/* with
// credentials. Never falls back to a wildcard.
export function corsHeaders(origin) {
  const allowed = configuredOrigins();
  const devAllowed = isProduction() ? [] : DEV_ORIGINS;
  const allowSet = new Set([...allowed, ...devAllowed]);
  const useOrigin = origin && allowSet.has(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': useOrigin || 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}
