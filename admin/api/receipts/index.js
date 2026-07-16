import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { RECEIPT_CARD_SELECT, toReceiptCard } from '../_lib/invoiceFields.js';
import { sanitiseFreeTextFilter, isValidUuid } from '../_lib/normalise.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET /api/receipts — filtered, sorted, paginated receipt list. There is
// no POST here — receipts are never created directly by an admin; they are
// only ever generated automatically when an invoice reaches a zero
// balance (admin/api/_lib/receiptLifecycle.js, called from
// admin/api/invoices/[id]/[[...action]].js's payments handler).
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

  const params = new URL(req.url, 'https://x').searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const invoiceId = params.get('invoiceId') || null;
  if (invoiceId && !isValidUuid(invoiceId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'invoiceId must be a valid UUID' }));
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

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    let query = supabase.from('receipts').select(RECEIPT_CARD_SELECT, { count: 'exact' });
    if (invoiceId) query = query.eq('invoice_id', invoiceId);
    if (bookingId) query = query.eq('booking_id', bookingId);
    if (q) {
      const escaped = q.replace(/[%,]/g, '');
      query = query.or([
        `receipt_number.ilike.%${escaped}%`,
        `customer_name.ilike.%${escaped}%`,
      ].join(','));
    }
    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error('[admin/api] receipts list query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load receipts' }));
    }

    const totalCount = count ?? 0;
    const results = (data || []).map(toReceiptCard);

    res.writeHead(200, headers);
    res.end(JSON.stringify({
      results, page, pageSize, totalCount, hasMore: from + results.length < totalCount,
    }));
  } catch (err) {
    console.error('[admin/api] receipts list unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
