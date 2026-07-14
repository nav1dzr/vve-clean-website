import { verifyAdminRequest } from '../../_lib/adminAuth.js';
import { corsHeaders } from '../../_lib/cors.js';
import { getServiceClient } from '../../_lib/supabaseAdmin.js';
import { isValidUuid } from '../../_lib/normalise.js';
import { extractIdParam } from '../../_lib/routeParams.js';
import { readJsonBody } from '../../_lib/body.js';
import { BOOKING_STATUS_VALUES } from '../../_lib/bookingFields.js';

export const config = { api: { bodyParser: false } };

// PATCH /api/bookings/:id/status — updates ONLY bookings.status and
// updated_at. Never touches payment_status, never calls Stripe, never
// issues a refund, never sends a customer notification, never alters any
// date field (ADMIN_CRM_PLAN.md Phase 3 spec). No transition-graph
// validation beyond the whitelist itself — version one deliberately allows
// any whitelisted status to follow any other, since a real cancellation/
// reschedule/reopen workflow doesn't fit a strict linear state machine.
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'PATCH') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const bookingId = extractIdParam(req, 1);
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
