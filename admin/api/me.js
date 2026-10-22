import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';
import connectionCheck from './_lib/connectionCheckHandler.js';
import { reply } from './_lib/connectionCheck.js';

export const config = { api: { bodyParser: false } };

// GET /api/me — the first server-side auth check in the admin app.
// Returns only safe profile fields. Never returns service-role credentials,
// and never returns booking/customer data (there is no booking data path in
// Phase 1 at all).
export default async function handler(req, res) {
  // Vercel may expose the original path plus the rewrite selector in req.query.
  // Inspect both representations; reject ambiguous diagnostic requests before
  // they can reach either the diagnostic or the ordinary profile response.
  const url = new URL(req.url || '/api/me', 'https://admin.vveclean.co.uk');
  const query = req.query || {};
  const raw = url.searchParams.getAll('diagnostic');
  const hasQuery = Object.prototype.hasOwnProperty.call(query, 'diagnostic');
  const diagnosticKey = key => /^diagnostic(?:\[|$)/.test(key);
  if (url.pathname === '/api/connection-check' || raw.length || hasQuery
    || [...url.searchParams.keys(), ...Object.keys(query)].some(diagnosticKey)) {
    const selector = 'connection-check-v1';
    const invalid = raw.length > 1 || raw.some(value => value !== selector)
      || (hasQuery && query.diagnostic !== selector)
      || (!raw.length && !hasQuery)
      || [...url.searchParams.keys()].some(key => key !== 'diagnostic')
      || Object.keys(query).some(key => key !== 'diagnostic');
    if (invalid) return reply(res, 400, { status: 'invalid_diagnostic_selector' });
    return connectionCheck(req, res);
  }
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const result = await verifyAdminRequest(req);

  if (!result.ok) {
    res.writeHead(result.status, headers);
    return res.end(JSON.stringify({ error: result.error, ...(result.code ? { code: result.code } : {}) }));
  }

  res.writeHead(200, headers);
  res.end(
    JSON.stringify({
      id: result.admin.id,
      displayName: result.admin.displayName,
      email: result.admin.email,
    }),
  );
}
