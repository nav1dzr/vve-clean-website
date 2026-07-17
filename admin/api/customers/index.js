import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import { sanitiseFreeTextFilter } from '../_lib/normalise.js';
import {
  CUSTOMER_TYPE_VALUES, CUSTOMER_SOURCE_VALUES, CUSTOMER_SORT_VALUES,
  toCustomerCard, toCustomerDetail,
} from '../_lib/customerFields.js';
import { createCustomer, listCustomers } from '../_lib/customerLifecycle.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_BODY_BYTES = 16 * 1024;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET  /api/customers — filtered, sorted, paginated list
// POST /api/customers — create (returns duplicateWarnings)
//
// A plain literal file, no dynamic segment — the same proven-safe shape as
// admin/api/invoices/index.js. Was previously folded into
// admin/api/customers/[[...segments]].js (a root-level optional catch-all)
// alongside detail/update/action routes; that shape turned out not to be
// reliable on this Vercel deployment for any request at all (a genuine
// 404 for the *zero-segment* root list request specifically — the same
// confirmed root cause documented in admin/INVOICES_SETUP.md's "Vercel
// function count" section for the invoices routing saga: this deployment's
// router does not interpret `[...x]`/`[[...x]]` ellipsis syntax as a
// catch-all at all, it treats the bracket interior literally as an
// ordinary *exactly-one-segment* parameter name, so a zero-segment request
// simply never matches the file). Detail/update/actions now live in
// admin/api/customers/[id].js, split out the same way invoices was fixed.
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
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

  try {
    if (req.method === 'GET') return await handleList(req, res, headers, supabase);
    return await handleCreate(req, res, headers, supabase, auth);
  } catch (err) {
    console.error('[admin/api] customers route unexpected error:', err?.message);
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
