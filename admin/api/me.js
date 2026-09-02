import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';

export const config = { api: { bodyParser: false } };

// GET /api/me — the first server-side auth check in the admin app.
// Returns only safe profile fields. Never returns service-role credentials,
// and never returns booking/customer data (there is no booking data path in
// Phase 1 at all).
export default async function handler(req, res) {
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
    return res.end(JSON.stringify({ error: result.error }));
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
