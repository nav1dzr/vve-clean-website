import { verifyAdminRequest } from '../../_lib/adminAuth.js';
import { corsHeaders } from '../../_lib/cors.js';
import { getServiceClient } from '../../_lib/supabaseAdmin.js';
import { isValidUuid, isValidIsoTimestamp } from '../../_lib/normalise.js';
import { extractIdParam } from '../../_lib/routeParams.js';
import { readJsonBody } from '../../_lib/body.js';
import { BALANCE_STATUS_VALUES, BALANCE_PAYMENT_METHOD_VALUES } from '../../_lib/bookingFields.js';

export const config = { api: { bodyParser: false } };

// PATCH /api/bookings/:id/balance — an internal manual record only. Never
// calls Stripe (no Stripe import exists in this file at all), never charges
// anything, never touches payment_status/deposit_amount/total_price — only
// balance_status, balance_paid_at, balance_payment_method, and updated_at.
//
// Documented rule for balance_paid_at/balance_payment_method: they only
// ever reflect the most recent transition INTO 'paid'. Setting
// balanceStatus to anything other than 'paid' always clears both — a
// stale "paid at"/"paid via" value on a balance that is no longer marked
// paid would be misleading (ADMIN_CRM_PLAN.md Phase 3 spec).
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

  if (!BALANCE_STATUS_VALUES.includes(body.balanceStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `balanceStatus must be one of: ${BALANCE_STATUS_VALUES.join(', ')}` }));
  }

  let paymentMethod = null;
  if (body.balancePaymentMethod !== undefined && body.balancePaymentMethod !== null) {
    if (!BALANCE_PAYMENT_METHOD_VALUES.includes(body.balancePaymentMethod)) {
      res.writeHead(400, headers);
      return res.end(
        JSON.stringify({ error: `balancePaymentMethod must be one of: ${BALANCE_PAYMENT_METHOD_VALUES.join(', ')}` }),
      );
    }
    paymentMethod = body.balancePaymentMethod;
  }

  let paidAt = null;
  if (body.balanceStatus === 'paid') {
    if (body.balancePaidAt !== undefined && body.balancePaidAt !== null) {
      if (!isValidIsoTimestamp(body.balancePaidAt)) {
        res.writeHead(400, headers);
        return res.end(JSON.stringify({ error: 'balancePaidAt must be a valid timestamp' }));
      }
      paidAt = new Date(body.balancePaidAt).toISOString();
    } else {
      paidAt = new Date().toISOString();
    }
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        balance_status: body.balanceStatus,
        balance_paid_at: paidAt,
        balance_payment_method: body.balanceStatus === 'paid' ? paymentMethod : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select('id, balance_status, balance_paid_at, balance_payment_method, updated_at')
      .maybeSingle();

    if (error) {
      console.error('[admin/api] balance update failed:', error.code, error.message, '| booking:', bookingId, '| admin:', auth.admin.id);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to update balance' }));
    }

    if (!data) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Booking not found' }));
    }

    console.log('[admin/api] balance updated | booking:', bookingId, '| admin:', auth.admin.id, '| balanceStatus:', body.balanceStatus);

    res.writeHead(200, headers);
    res.end(
      JSON.stringify({
        id: data.id,
        balanceStatus: data.balance_status,
        balancePaidAt: data.balance_paid_at,
        balancePaymentMethod: data.balance_payment_method,
        updatedAt: data.updated_at,
      }),
    );
  } catch (err) {
    console.error('[admin/api] balance unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
