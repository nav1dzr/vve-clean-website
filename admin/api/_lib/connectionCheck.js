// Temporary VVE-20261022-MEASUREMENT-CONNECTION-CHECK-V1 diagnostic only.
// CLOSED during review. Set exact absolute UTC bounds in a reviewed follow-up
// only when CI and the browser are ready; never derive them from startup time.
export const CHECK_WINDOW = Object.freeze({ opensAt: null, closesAt: null });
export const CRM_ORIGIN = 'https://admin.vveclean.co.uk';
export const WEBSITE_CHECK_URL = 'https://www.vveclean.co.uk/api/connection-check';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datamanager';

export class CheckError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export function assertClosedGuards(env, window, now) {
  if (env.VERCEL_ENV !== 'production') throw new CheckError(403, 'production_only');
  if (env.BOOKING_MEASUREMENT_MODE !== 'disabled') throw new CheckError(403, 'reporting_not_disabled');
  const start = Date.parse(window.opensAt), end = Date.parse(window.closesAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start !== 30 * 60_000)
    throw new CheckError(503, 'window_not_scheduled');
  if (now < start) throw new CheckError(403, 'window_not_open');
  if (now >= end) throw new CheckError(410, 'window_expired');
}
export function projectRef(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.search || url.hash || url.pathname !== '/') return null;
    return /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)?.[1] || null;
  } catch { return null; }
}
export function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  return res.end(JSON.stringify(body));
}
export function fail(res, error) {
  return reply(res, error instanceof CheckError ? error.status : 500,
    { status: error instanceof CheckError ? error.code : 'check_unavailable' });
}
export async function validateRequest(req, { browser }) {
  if (req.method !== 'POST') throw new CheckError(405, 'method_not_allowed');
  const origin = req.headers.origin;
  if ((browser && origin !== CRM_ORIGIN) || (!browser && origin && origin !== CRM_ORIGIN))
    throw new CheckError(403, 'origin_not_allowed');
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
    throw new CheckError(415, 'json_required');
  let raw = '';
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 1024) throw new CheckError(413, 'body_too_large');
  }
  if (Buffer.byteLength(raw) > 1024) throw new CheckError(413, 'body_too_large');
  let body;
  try { body = JSON.parse(raw); } catch { throw new CheckError(400, 'invalid_body'); }
  if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || body.action !== 'check')
    throw new CheckError(400, 'invalid_body');
  const bearer = req.headers.authorization;
  if (typeof bearer !== 'string' || !/^Bearer [^\s]+$/.test(bearer) || bearer.length > 8192)
    throw new CheckError(401, 'unauthorised');
  return bearer;
}
export async function authorised(req, verify) {
  let auth;
  try { auth = await verify(req, { redactErrors: true }); }
  catch { throw new CheckError(503, 'authorisation_unavailable'); }
  if (!auth?.ok || typeof auth.admin?.id !== 'string')
    throw new CheckError(auth?.status === 401 ? 401 : auth?.status === 403 ? 403 : 503,
      auth?.status === 401 ? 'unauthorised' : auth?.status === 403 ? 'not_an_admin' : 'authorisation_unavailable');
  return auth.admin.id;
}
// Deliberately per-instance, NOT a distributed or global cap. Fixed expiry and
// the one manual invocation approval also apply. Reserve before network I/O.
export function createLimiter() {
  const entries = new Map();
  return (id, now) => {
    const item = entries.get(id) || { count: 0, last: -Infinity, busy: false };
    if (item.busy || item.count >= 3 || now - item.last < 60_000 || (!entries.has(id) && entries.size >= 100))
      throw new CheckError(429, 'check_limited');
    item.count++; item.last = now; item.busy = true; entries.set(id, item);
    return () => { item.busy = false; };
  };
}
export async function refreshOnly(env, fetchFn) {
  if (!env.GOOGLE_DATA_MANAGER_CLIENT_ID || !env.GOOGLE_DATA_MANAGER_CLIENT_SECRET || !env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN)
    return { status: 'credentials_missing', refreshSucceeded: false, scopeKnown: false };
  try {
    const response = await fetchFn(GOOGLE_TOKEN_URL, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({ client_id: env.GOOGLE_DATA_MANAGER_CLIENT_ID,
        client_secret: env.GOOGLE_DATA_MANAGER_CLIENT_SECRET, refresh_token: env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN,
        grant_type: 'refresh_token' }) });
    if (!response.ok || response.redirected) return { status: 'refresh_rejected', refreshSucceeded: false, scopeKnown: false };
    const data = await response.json();
    if (typeof data?.access_token !== 'string' || !data.access_token)
      return { status: 'refresh_unverified', refreshSucceeded: false, scopeKnown: false };
    // Never return/log/cache the token, provider object, email or claims.
    const scopeKnown = typeof data.scope === 'string';
    return { status: 'refresh_succeeded', refreshSucceeded: true, scopeKnown,
      ...(scopeKnown ? { datamanagerScopePresent: data.scope.split(/\s+/).includes(SCOPE) } : {}) };
  } catch { return { status: 'refresh_outcome_unknown', refreshSucceeded: false, scopeKnown: false }; }
}
export function sanitiseWebsiteResult(data) {
  const statuses = ['credentials_missing', 'refresh_rejected', 'refresh_unverified', 'refresh_succeeded', 'refresh_outcome_unknown'];
  const ref = value => typeof value === 'string' && /^[a-z0-9]{20}$/.test(value) ? value : null;
  if (!data || data.runtime !== 'website' || !statuses.includes(data.status) || typeof data.refreshSucceeded !== 'boolean' ||
      typeof data.scopeKnown !== 'boolean' || (data.scopeKnown && typeof data.datamanagerScopePresent !== 'boolean'))
    throw new CheckError(502, 'website_result_unknown');
  return { runtime: 'website', databaseRef: ref(data.databaseRef), contactDatabaseRef: ref(data.contactDatabaseRef),
    status: data.status, refreshSucceeded: data.refreshSucceeded, scopeKnown: data.scopeKnown,
    ...(data.scopeKnown ? { datamanagerScopePresent: data.datamanagerScopePresent } : {}) };
}
