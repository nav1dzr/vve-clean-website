import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { DETAIL_SELECT, toDetail } from '../_lib/bookingFields.js';
import { isValidUuid } from '../_lib/normalise.js';

export const config = { api: { bodyParser: false } };

// GET /api/bookings/:id — booking detail by internal UUID only (never the
// human booking_ref, which is guessable — ADMIN_CRM_PLAN.md §4). Returns
// the explicit DETAIL_SELECT column list, which excludes
// confirmation_token entirely. No status/notes editing here — that's
// Phase 3.
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

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  // Vercel populates req.query for a [id].js dynamic route; also accept a
  // manually parsed path segment as a fallback so this handler is testable
  // (and correct) independent of the Vercel routing layer.
  const id = req.query?.id || new URL(req.url, 'https://x').pathname.split('/').filter(Boolean).pop();

  if (!isValidUuid(id)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid booking id' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[admin/api] booking detail query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load booking' }));
    }

    if (!data) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Booking not found' }));
    }

    res.writeHead(200, headers);
    res.end(JSON.stringify(toDetail(data)));
  } catch (err) {
    console.error('[admin/api] booking detail unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
