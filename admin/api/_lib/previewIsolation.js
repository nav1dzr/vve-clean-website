// Keep this deployment-local copy identical to admin/api/_lib/previewIsolation.js.
// NODE_ENV is deliberately ignored: Vercel preview functions also use production.
const ACTIVE_PROJECTS = new Set(['temlphabsqukkiqmrvhl', 'spbrstpxrimuuorkbsbo']);
export const PREVIEW_ISOLATION_ERROR = 'This preview is read-only until approved isolated test resources are connected.';

export function isHostedPreview(env = process.env) {
  return (env.VERCEL === '1' || Boolean(env.VERCEL_ENV)) && env.VERCEL_ENV !== 'production';
}

export function previewTestInbox(env = process.env) {
  const email = env.VVE_PREVIEW_TEST_EMAIL || '';
  return /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email) ? email : null;
}

export function previewIsolation(env = process.env) {
  const hosted = env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
  if (!hosted || env.VERCEL_ENV === 'production') return { ok: true, preview: false };
  const blocked = { ok: false, preview: true, status: 403, error: PREVIEW_ISOLATION_ERROR };
  if (env.VVE_PREVIEW_ISOLATION_APPROVED !== 'true') return blocked;
  if (!previewTestInbox(env)) return blocked;
  const ref = env.VVE_PREVIEW_SUPABASE_PROJECT_REF || '';
  if (!/^[a-z0-9]{20}$/.test(ref) || ACTIVE_PROJECTS.has(ref)) return blocked;
  const urls = [env.VITE_SUPABASE_URL, env.SUPABASE_URL].filter(Boolean);
  if (!urls.length) return blocked;
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co` || url.username || url.password || url.port || !['', '/'].includes(url.pathname) || url.search || url.hash) return blocked;
    } catch { return blocked; }
  }
  // A staging database never makes a live Stripe key or live journey mode safe.
  if (/^(?:sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '') || env.BOOKING_JOURNEY_MODE === 'live') return blocked;
  return { ok: true, preview: true };
}

export function rejectUnsafePreview(res, { legacy = false } = {}) {
  const isolation = previewIsolation();
  if (isolation.ok && !(legacy && isolation.preview)) return false;
  res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: isolation.error || 'Legacy payment and backfill endpoints are disabled in previews. Use the isolated test booking journey.' }));
  return true;
}
