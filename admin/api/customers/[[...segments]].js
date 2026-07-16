import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import { extractSegments } from '../_lib/routeParams.js';
import { isValidUuid, sanitiseFreeTextFilter } from '../_lib/normalise.js';
import {
  CUSTOMER_TYPE_VALUES, CUSTOMER_SOURCE_VALUES, CUSTOMER_SORT_VALUES,
  toCustomerCard, toCustomerDetail,
} from '../_lib/customerFields.js';
import {
  createCustomer, updateCustomer, getCustomerDetail, listCustomers, createManualBooking,
} from '../_lib/customerLifecycle.js';
import { toInvoiceEvent } from '../_lib/invoiceFields.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_BODY_BYTES = 16 * 1024;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// One dispatcher file for the entire `customers` resource — list, create,
// detail (+ history), update, and "create a manual booking from this
// customer" — via a *root-level* optional catch-all (extractSegments()),
// the same budget-conscious consolidation as
// admin/api/receipts/[[...segments]].js. This is a new resource added
// without a single extra deployable file beyond this one, keeping the
// admin Vercel project at 12/12 functions (see admin/INVOICES_SETUP.md).
//
// Routes:
//   GET  /api/customers            — filtered, sorted, paginated list
//   POST /api/customers            — create (returns duplicateWarnings)
//   GET  /api/customers/:id        — detail + booking/invoice/receipt history
//   PATCH /api/customers/:id       — edit (returns duplicateWarnings)
//   POST /api/customers/:id/bookings — create a manual booking for this customer
//   GET  /api/customers/:id/events — audit trail (created/updated)
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

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  const segments = extractSegments(req, 'segments', 2);

  try {
    if (segments.length === 0) {
      if (req.method === 'GET') return await handleList(req, res, headers, supabase);
      if (req.method === 'POST') return await handleCreate(req, res, headers, supabase, auth);
      res.writeHead(405, headers);
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    const customerId = segments[0];
    if (!isValidUuid(customerId)) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: 'Invalid customer id' }));
    }
    const action = segments.slice(1);

    if (action.length === 0) {
      if (req.method === 'GET') return await handleDetail(req, res, headers, supabase, customerId);
      if (req.method === 'PATCH') return await handleUpdate(req, res, headers, supabase, customerId, auth);
      res.writeHead(405, headers);
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    if (action.length === 1 && action[0] === 'bookings') return await handleCreateBooking(req, res, headers, supabase, customerId, auth);
    if (action.length === 1 && action[0] === 'events') return await handleEvents(req, res, headers, supabase, customerId);

    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('[admin/api] customer route unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Mirrors admin/api/bookings/index.js's buildQuery pattern — every
// filter/sort value is validated against a fixed whitelist before this is
// ever called; free-text search is passed through Supabase's
// parameterised .or()/.ilike(), never string-concatenated SQL.
async function handleList(req, res, headers, supabase) {
  const params = new URL(req.url, 'https://x').searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const sort = params.get('sort') || 'newest';
  if (!CUSTOMER_SORT_VALUES.includes(sort)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `sort must be one of: ${CUSTOMER_SORT_VALUES.join(', ')}` }));
  }

  const customerType = params.get('customerType') || null;
  if (customerType && !CUSTOMER_TYPE_VALUES.includes(customerType)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `customerType must be one of: ${CUSTOMER_TYPE_VALUES.join(', ')}` }));
  }

  const source = params.get('source') || null;
  if (source && !CUSTOMER_SOURCE_VALUES.includes(source)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `source must be one of: ${CUSTOMER_SOURCE_VALUES.join(', ')}` }));
  }

  const rawQ = params.get('q');
  const q = rawQ ? sanitiseFreeTextFilter(rawQ) : null;
  if (rawQ && !q) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'q filter is invalid' }));
  }

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await listCustomers(supabase, { customerType, source, q, sort }).range(from, to);

    if (error) {
      console.error('[admin/api] customers list query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load customers' }));
    }

    const totalCount = count ?? 0;
    const results = (data || []).map(toCustomerCard);

    res.writeHead(200, headers);
    res.end(JSON.stringify({
      results, page, pageSize, totalCount, hasMore: from + results.length < totalCount,
    }));
  } catch (err) {
    console.error('[admin/api] customers list unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleCreate(req, res, headers, supabase, auth) {
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const result = await createCustomer(supabase, body, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }

  const { data: created, error: fetchErr } = await supabase
    .from('customers').select('*').eq('id', result.customerId).single();
  if (fetchErr) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Customer created but failed to load it back' }));
  }

  res.writeHead(201, headers);
  return res.end(JSON.stringify({ ...toCustomerDetail(created), duplicateWarnings: result.duplicateWarnings }));
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

// POST /api/customers/:id/bookings — creates a manual booking for work
// arranged outside the public quote/checkout flow (phone/WhatsApp/email).
// See customerLifecycle.js's createManualBooking() header for exactly
// what this does and does not touch — never the Stripe checkout session,
// webhook, or public booking flow.
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
