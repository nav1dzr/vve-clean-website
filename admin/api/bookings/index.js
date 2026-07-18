import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import {
  CARD_SELECT, toCard, BOOKING_STATUS_VALUES, PAYMENT_STATUS_VALUES, BALANCE_STATUS_VALUES, SORT_VALUES,
} from '../_lib/bookingFields.js';
import { sanitiseFreeTextFilter, isValidDateString } from '../_lib/normalise.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Note: the postcode filter here is a case-insensitive partial match on the
// stored column as-is — it does not fully normalise away spacing
// differences between the query and stored data the way the dedicated
// search_bookings() function does (ADMIN_CRM_PLAN.md §17). Use /api/search
// when a customer's postcode format is uncertain; use this filter when
// narrowing an already-known area (e.g. "N15").
function buildQuery(supabase, filters) {
  let query = supabase.from('bookings').select(CARD_SELECT, { count: 'exact' });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.balanceStatus) query = query.eq('balance_status', filters.balanceStatus);
  if (filters.service) query = query.eq('service', filters.service);
  if (filters.source) query = query.eq('last_source', filters.source);
  if (filters.postcode) query = query.ilike('postcode', `%${filters.postcode}%`);
  if (filters.dateFrom) query = query.gte('service_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('service_date', filters.dateTo);

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'service_date':
      query = query.order('service_date', { ascending: true, nullsFirst: false });
      break;
    case 'highest_value':
      query = query.order('total_price', { ascending: false, nullsFirst: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  return query;
}

// A customer who starts checkout, abandons it, and then successfully
// re-books (typically after changing their quote) leaves behind a still-
// pending row alongside the real paid one — see api/create-checkout-
// session.js, which inserts a `pending_payment` row on every session
// created, before payment happens. Neither row is ever deleted (this is
// purely a read-time label, not a data change — see Phase 3 of the
// booking-list cleanup work), but a `pending_payment` row with a same-
// phone `paid` sibling created within a day is almost certainly that
// abandoned attempt rather than a genuinely separate, still-awaiting-
// payment booking, so it's flagged here as `superseded: true` for the UI
// to visually de-emphasise/hide by default. A 24-hour window is
// deliberately narrow — a repeat customer's two genuinely distinct future
// bookings are realistically at least days apart, so this should not
// mislabel real, separate, still-outstanding pending bookings.
const SUPERSEDED_WINDOW_MS = 24 * 60 * 60 * 1000;

async function markSupersededPendingBookings(supabase, cards) {
  const pending = cards.filter((c) => c.paymentStatus === 'pending_payment' && c.phone);
  if (pending.length === 0) return cards.map((c) => ({ ...c, superseded: false }));

  const phones = [...new Set(pending.map((c) => c.phone))];
  const { data: paidSiblings, error } = await supabase
    .from('bookings')
    .select('phone, created_at')
    .eq('payment_status', 'paid')
    .in('phone', phones);

  if (error || !paidSiblings) {
    console.error('[admin/api] superseded-booking lookup failed:', error?.code, error?.message);
    return cards;
  }

  const supersededIds = new Set();
  for (const card of pending) {
    const pendingTime = new Date(card.createdAt).getTime();
    const hasPaidSibling = paidSiblings.some(
      (p) => p.phone === card.phone && Math.abs(new Date(p.created_at).getTime() - pendingTime) <= SUPERSEDED_WINDOW_MS,
    );
    if (hasPaidSibling) supersededIds.add(card.id);
  }

  return cards.map((c) => (supersededIds.has(c.id) ? { ...c, superseded: true } : { ...c, superseded: false }));
}

// GET /api/bookings — filtered, sorted, paginated booking list.
// Every filter/sort value is validated against a fixed whitelist before it
// ever reaches a query; free-text filters (service/source/postcode) are
// still only ever passed through Supabase's parameterised query builder
// (.eq/.ilike), never concatenated into raw SQL.
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

  const sort = params.get('sort') || 'newest';
  if (!SORT_VALUES.includes(sort)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `sort must be one of: ${SORT_VALUES.join(', ')}` }));
  }

  const status = params.get('status') || null;
  if (status && !BOOKING_STATUS_VALUES.includes(status)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `status must be one of: ${BOOKING_STATUS_VALUES.join(', ')}` }));
  }

  const paymentStatus = params.get('paymentStatus') || null;
  if (paymentStatus && !PAYMENT_STATUS_VALUES.includes(paymentStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `paymentStatus must be one of: ${PAYMENT_STATUS_VALUES.join(', ')}` }));
  }

  const balanceStatus = params.get('balanceStatus') || null;
  if (balanceStatus && !BALANCE_STATUS_VALUES.includes(balanceStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `balanceStatus must be one of: ${BALANCE_STATUS_VALUES.join(', ')}` }));
  }

  const rawService = params.get('service');
  const service = rawService ? sanitiseFreeTextFilter(rawService) : null;
  if (rawService && !service) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'service filter is invalid' }));
  }

  const rawSource = params.get('source');
  const source = rawSource ? sanitiseFreeTextFilter(rawSource) : null;
  if (rawSource && !source) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'source filter is invalid' }));
  }

  const rawPostcode = params.get('postcode');
  const postcode = rawPostcode ? sanitiseFreeTextFilter(rawPostcode) : null;
  if (rawPostcode && !postcode) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'postcode filter is invalid' }));
  }

  const dateFrom = params.get('dateFrom') || null;
  if (dateFrom && !isValidDateString(dateFrom)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dateFrom must be YYYY-MM-DD' }));
  }

  const dateTo = params.get('dateTo') || null;
  if (dateTo && !isValidDateString(dateTo)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dateTo must be YYYY-MM-DD' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const query = buildQuery(supabase, {
      status, paymentStatus, balanceStatus, service, source, postcode, dateFrom, dateTo, sort,
    }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[admin/api] bookings list query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load bookings' }));
    }

    const totalCount = count ?? 0;
    const results = await markSupersededPendingBookings(supabase, (data || []).map(toCard));

    res.writeHead(200, headers);
    res.end(
      JSON.stringify({
        results,
        page,
        pageSize,
        totalCount,
        hasMore: from + results.length < totalCount,
      }),
    );
  } catch (err) {
    console.error('[admin/api] bookings list unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
