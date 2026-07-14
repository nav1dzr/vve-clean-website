import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';
import { getServiceClient } from './_lib/supabaseAdmin.js';
import { readJsonBody } from './_lib/body.js';
import { validateSearchQuery } from './_lib/normalise.js';
import { toCard } from './_lib/bookingFields.js';

export const config = { api: { bodyParser: false } };

const RESULT_LIMIT = 50;

// POST /api/search { "q": "..." } — the only path the admin app ever uses
// to search bookings. Delegates all matching/normalisation logic to the
// search_bookings() SQL function (supabase/migrations/
// 20260718000000_add_booking_search_support.sql), which is parameterised,
// has a fixed search_path, and is only callable by service_role. This route
// never builds a query string by hand and never returns confirmation_token
// or any field outside the result-card shape.
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const validated = validateSearchQuery(body.q);
  if (!validated.ok) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: validated.error }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase.rpc('search_bookings', {
      search_query: validated.value,
      result_limit: RESULT_LIMIT,
    });

    if (error) {
      console.error('[admin/api] search_bookings failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Search failed' }));
    }

    res.writeHead(200, headers);
    res.end(JSON.stringify({ results: (data || []).map(toCard) }));
  } catch (err) {
    console.error('[admin/api] search unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
