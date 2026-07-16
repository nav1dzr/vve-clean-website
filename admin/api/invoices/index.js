import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import {
  INVOICE_CARD_SELECT, toInvoiceCard, toInvoiceDetail,
  INVOICE_DOCUMENT_STATUS_VALUES, INVOICE_PAYMENT_STATUS_VALUES, INVOICE_SORT_VALUES,
} from '../_lib/invoiceFields.js';
import { sanitiseFreeTextFilter, isValidDateString, isValidUuid } from '../_lib/normalise.js';
import { createDraftInvoice } from '../_lib/invoiceLifecycle.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_BODY_BYTES = 64 * 1024; // an editor payload with many line items is larger than a typical 8KB request

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Mirrors admin/api/bookings/index.js's buildQuery pattern exactly — every
// filter/sort value is validated against a fixed whitelist before this is
// ever called; free-text search is passed through Supabase's parameterised
// .or()/.ilike(), never string-concatenated SQL.
function buildQuery(supabase, filters) {
  let query = supabase.from('invoices').select(INVOICE_CARD_SELECT, { count: 'exact' });

  if (filters.documentStatus) query = query.eq('document_status', filters.documentStatus);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom);
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo);
  if (filters.bookingId) query = query.eq('booking_id', filters.bookingId);

  if (filters.q) {
    const escaped = filters.q.replace(/[%,]/g, '');
    query = query.or(
      [
        `invoice_number.ilike.%${escaped}%`,
        `customer_name.ilike.%${escaped}%`,
        `customer_email.ilike.%${escaped}%`,
        `customer_phone.ilike.%${escaped}%`,
        `customer_postcode.ilike.%${escaped}%`,
        `booking_ref_snapshot.ilike.%${escaped}%`,
      ].join(','),
    );
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'due_soonest':
      query = query.order('due_date', { ascending: true, nullsFirst: false });
      break;
    case 'highest_total':
      query = query.order('total', { ascending: false });
      break;
    case 'highest_outstanding':
      query = query.order('amount_due', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  return query;
}

async function handleList(req, res, headers) {
  const params = new URL(req.url, 'https://x').searchParams;

  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const sort = params.get('sort') || 'newest';
  if (!INVOICE_SORT_VALUES.includes(sort)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `sort must be one of: ${INVOICE_SORT_VALUES.join(', ')}` }));
  }

  const documentStatus = params.get('documentStatus') || null;
  if (documentStatus && !INVOICE_DOCUMENT_STATUS_VALUES.includes(documentStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `documentStatus must be one of: ${INVOICE_DOCUMENT_STATUS_VALUES.join(', ')}` }));
  }

  const paymentStatus = params.get('paymentStatus') || null;
  if (paymentStatus && !INVOICE_PAYMENT_STATUS_VALUES.includes(paymentStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `paymentStatus must be one of: ${INVOICE_PAYMENT_STATUS_VALUES.join(', ')}` }));
  }

  const bookingId = params.get('bookingId') || null;
  if (bookingId && !isValidUuid(bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'bookingId must be a valid UUID' }));
  }

  const rawQ = params.get('q');
  const q = rawQ ? sanitiseFreeTextFilter(rawQ) : null;
  if (rawQ && !q) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'q filter is invalid' }));
  }

  const dueFrom = params.get('dueFrom') || null;
  if (dueFrom && !isValidDateString(dueFrom)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dueFrom must be YYYY-MM-DD' }));
  }
  const dueTo = params.get('dueTo') || null;
  if (dueTo && !isValidDateString(dueTo)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dueTo must be YYYY-MM-DD' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await buildQuery(supabase, {
      documentStatus, paymentStatus, bookingId, q, dueFrom, dueTo, sort,
    }).range(from, to);

    if (error) {
      console.error('[admin/api] invoices list query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load invoices' }));
    }

    const totalCount = count ?? 0;
    const results = (data || []).map(toInvoiceCard);

    res.writeHead(200, headers);
    res.end(JSON.stringify({
      results, page, pageSize, totalCount, hasMore: from + results.length < totalCount,
    }));
  } catch (err) {
    console.error('[admin/api] invoices list unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleCreate(req, res, headers, auth) {
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  if (body.bookingId && !isValidUuid(body.bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'bookingId must be a valid UUID' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const result = await createDraftInvoice(supabase, body, auth.admin.id);
    if (!result.ok) {
      res.writeHead(result.status || 400, headers);
      return res.end(JSON.stringify({ error: result.error }));
    }

    const { data: created, error: fetchErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', result.invoiceId)
      .single();
    if (fetchErr) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Invoice created but failed to load it back' }));
    }

    res.writeHead(201, headers);
    res.end(JSON.stringify(toInvoiceDetail(created)));
  } catch (err) {
    console.error('[admin/api] invoice create unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// GET /api/invoices — filtered, sorted, paginated invoice list.
// POST /api/invoices — create a draft invoice (manual, or booking-based
// when bookingId is supplied — the booking itself is never modified).
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

  if (req.method === 'GET') return handleList(req, res, headers);
  return handleCreate(req, res, headers, auth);
}
