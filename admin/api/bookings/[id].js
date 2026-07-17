import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { DETAIL_SELECT, toDetail, BOOKING_STATUS_VALUES } from '../_lib/bookingFields.js';
import { isValidUuid } from '../_lib/normalise.js';
import { extractIdParam } from '../_lib/routeParams.js';
import { readJsonBody } from '../_lib/body.js';

export const config = { api: { bodyParser: false } };

// GET   /api/bookings/:id               — booking detail by internal UUID
//       only (never the human booking_ref, which is guessable —
//       ADMIN_CRM_PLAN.md §4). Returns the explicit DETAIL_SELECT column
//       list, which excludes confirmation_token entirely.
// PATCH /api/bookings/:id?action=status — updates ONLY bookings.status and
//       updated_at (see handleStatus below). Dispatched via a `?action=`
//       query-string parameter rather than a `/status` path segment or a
//       bracket catch-all — folded in from the former, separate
//       admin/api/bookings/[id]/status.js specifically to free a function
//       slot for admin/api/customers/[id].js's fix for the confirmed
//       ellipsis-catch-all Vercel bug (see admin/INVOICES_SETUP.md's
//       "Vercel function count" section for the full history of that bug).
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  // Method-vs-action validation happens before auth, matching each of the
  // two routes' original, separate-file behaviour exactly (an
  // unauthenticated caller sending the wrong method still gets 405, not
  // 401) — this only needs req.method/req.url, not a verified admin.
  const action = new URL(req.url, 'https://x').searchParams.get('action');
  if (action === 'status') return handleStatus(req, res, headers);
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const id = extractIdParam(req);
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

// PATCH /api/bookings/:id?action=status — updates ONLY bookings.status and
// updated_at. Never touches payment_status, never calls Stripe, never
// issues a refund, never sends a customer notification, never alters any
// date field (ADMIN_CRM_PLAN.md Phase 3 spec). No transition-graph
// validation beyond the whitelist itself — version one deliberately allows
// any whitelisted status to follow any other, since a real cancellation/
// reschedule/reopen workflow doesn't fit a strict linear state machine.
async function handleStatus(req, res, headers) {
  if (req.method !== 'PATCH') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const bookingId = extractIdParam(req);
  if (!isValidUuid(bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid booking id' }));
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  if (!BOOKING_STATUS_VALUES.includes(body.status)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `status must be one of: ${BOOKING_STATUS_VALUES.join(', ')}` }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('id, status, updated_at')
      .maybeSingle();

    if (error) {
      console.error('[admin/api] status update failed:', error.code, error.message, '| booking:', bookingId, '| admin:', auth.admin.id);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to update status' }));
    }

    if (!data) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Booking not found' }));
    }

    // Safe operational metadata only — never customer phone/email/address/
    // note text/tokens.
    console.log('[admin/api] status updated | booking:', bookingId, '| admin:', auth.admin.id, '| status:', body.status);

    res.writeHead(200, headers);
    res.end(JSON.stringify({ id: data.id, status: data.status, updatedAt: data.updated_at }));
  } catch (err) {
    console.error('[admin/api] status unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
