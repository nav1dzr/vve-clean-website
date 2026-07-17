import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import { extractIdParam } from '../_lib/routeParams.js';
import { isValidUuid } from '../_lib/normalise.js';
import { toCustomerDetail } from '../_lib/customerFields.js';
import { updateCustomer, getCustomerDetail, createManualBooking } from '../_lib/customerLifecycle.js';
import { toInvoiceEvent } from '../_lib/invoiceFields.js';

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 16 * 1024;

// This file is a single, ordinary dynamic segment — `[id].js`, no
// ellipsis — the exact same proven shape as admin/api/bookings/[id].js and
// admin/api/invoices/[id].js. Actions are dispatched via a `?action=`
// QUERY STRING parameter, never an additional path segment, for the same
// reason invoices was fixed this way: this Vercel deployment does not
// interpret `[...x]`/`[[...x]]` ellipsis bracket syntax as a catch-all at
// all (confirmed root cause — see admin/INVOICES_SETUP.md's "Vercel
// function count" section), so any route shape relying on it is
// unreliable. list/create live in admin/api/customers/index.js.
//
// Routes:
//   GET   /api/customers/:id                  — detail + booking/invoice/receipt history
//   PATCH /api/customers/:id                  — edit (returns duplicateWarnings)
//   POST  /api/customers/:id?action=bookings  — create a manual booking for this customer
//   GET   /api/customers/:id?action=events    — audit trail (created/updated)
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const customerId = extractIdParam(req);
  if (!isValidUuid(customerId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid customer id' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  const action = new URL(req.url, 'https://x').searchParams.get('action');

  try {
    if (action === 'bookings') return await handleCreateBooking(req, res, headers, supabase, customerId, auth);
    if (action === 'events') return await handleEvents(req, res, headers, supabase, customerId);

    if (req.method === 'GET') return await handleDetail(req, res, headers, supabase, customerId);
    if (req.method === 'PATCH') return await handleUpdate(req, res, headers, supabase, customerId, auth);

    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    console.error('[admin/api] customer detail route unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// GET /api/customers/:id — detail plus derived history (bookings matched
// by email/phone, invoices/receipts matched by the billing/service
// customer FK — see customerLifecycle.js's file header for why bookings
// are matched differently) and balances. Never returns a confirmation
// token or any service-role/credential value — toCustomerDetail() and the
// booking/invoice/receipt card mappers are the same explicit allowlists
// used everywhere else in this API.
async function handleDetail(req, res, headers, supabase, customerId) {
  const result = await getCustomerDetail(supabase, customerId);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }

  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    ...toCustomerDetail(result.customer),
    bookings: result.bookings,
    invoices: result.invoices,
    receipts: result.receipts,
    outstandingBalance: result.outstandingBalance,
    totalPaid: result.totalPaid,
  }));
}

async function handleUpdate(req, res, headers, supabase, customerId, auth) {
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const result = await updateCustomer(supabase, customerId, body, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, duplicateWarnings: result.duplicateWarnings }));
}

async function handleEvents(req, res, headers, supabase, customerId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data, error } = await supabase
    .from('invoice_events')
    .select('*')
    .eq('document_type', 'customer')
    .eq('document_id', customerId)
    .order('created_at', { ascending: false });
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load customer history' }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ results: (data || []).map(toInvoiceEvent) }));
}

// POST /api/customers/:id?action=bookings — creates a manual booking for
// work arranged outside the public quote/checkout flow (phone/WhatsApp/
// email). See customerLifecycle.js's createManualBooking() header for
// exactly what this does and does not touch — never the Stripe checkout
// session, webhook, or public booking flow.
async function handleCreateBooking(req, res, headers, supabase, customerId, auth) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const result = await createManualBooking(supabase, customerId, body, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }

  res.writeHead(201, headers);
  return res.end(JSON.stringify({ ok: true, bookingId: result.bookingId, bookingRef: result.bookingRef }));
}
