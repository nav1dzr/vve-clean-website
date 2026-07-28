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
// purely a read-time label, not a data change), but a `pending_payment`
// row that looks like that abandoned attempt is flagged `superseded: true`
// for the UI to hide by default.
//
// Matching on phone alone within a time window (the original version of
// this function) is too broad — verified against the actual motivating
// example (two "Natalie Ashton" rows, NW3 7AJ, both 2026-07-17 Morning):
// a same-phone `paid` booking for a different property, a different
// requested date, or made *before* the pending attempt is NOT the same
// booking and must never be hidden. A pending booking is only flagged
// when ALL of the following hold against some paid sibling:
//   1. same normalised phone OR same normalised email (contact identity)
//   2. same normalised postcode (same property)
//   3. same preferred_date (same requested day — the "quote change" this
//      is modelling is a price/detail change, not a different day)
//   4. same broad service category (text before the first "·" — e.g.
//      "Carpet & upholstery · 2 items" and "Carpet & upholstery · 1 item"
//      both reduce to "carpet & upholstery"; "Window Cleaning" does not
//      match that). This is deliberately looser than an exact string
//      match: the real example above has *different* item counts between
//      the abandoned and the retried attempt, which an exact match would
//      have missed entirely.
//   5. the pending row was created BEFORE the paid row (an abandoned
//      attempt necessarily happens before its successful retry — this
//      alone rules out the case where a customer pays for one job then,
//      hours later, separately starts and abandons an unrelated one)
//   6. the paid row followed within SUPERSEDED_WINDOW_MS (24h) — a repeat
//      customer's two genuinely distinct future bookings are realistically
//      at least days apart.
// Every one of these is a display hint only; nothing is ever deleted or
// altered.
const SUPERSEDED_WINDOW_MS = 24 * 60 * 60 * 1000;

function normaliseKey(value) {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

function normalisePostcodeKey(value) {
  const key = normaliseKey(value);
  return key ? key.replace(/\s+/g, '') : null;
}

// "Carpet & upholstery · 2 items" -> "carpet & upholstery". A plain string
// with no "·" (e.g. "Window Cleaning") passes through unchanged.
function serviceCategoryKey(value) {
  const key = normaliseKey(value);
  return key ? key.split('·')[0].trim() || null : null;
}

async function markSupersededPendingBookings(supabase, cards) {
  const pendingIds = cards.filter((c) => c.paymentStatus === 'pending_payment').map((c) => c.id);
  if (pendingIds.length === 0) return cards.map((c) => ({ ...c, superseded: false }));

  const DETAIL_COLUMNS = 'id, phone, email, postcode, preferred_date, service, created_at';

  const { data: pendingDetails, error: pendingErr } = await supabase
    .from('bookings')
    .select(DETAIL_COLUMNS)
    .in('id', pendingIds);

  if (pendingErr || !pendingDetails) {
    console.error('[admin/api] superseded-booking lookup failed (pending detail):', pendingErr?.code, pendingErr?.message);
    return cards.map((c) => ({ ...c, superseded: false }));
  }

  const phones = [...new Set(pendingDetails.map((p) => p.phone).filter(Boolean))];
  const emails = [...new Set(pendingDetails.map((p) => p.email).filter(Boolean))];
  if (phones.length === 0 && emails.length === 0) return cards.map((c) => ({ ...c, superseded: false }));

  const orClauses = [];
  if (phones.length) orClauses.push(`phone.in.(${phones.join(',')})`);
  if (emails.length) orClauses.push(`email.in.(${emails.join(',')})`);

  const { data: paidCandidates, error: paidErr } = await supabase
    .from('bookings')
    .select(DETAIL_COLUMNS)
    .eq('payment_status', 'paid')
    .or(orClauses.join(','));

  if (paidErr || !paidCandidates) {
    console.error('[admin/api] superseded-booking lookup failed (paid candidates):', paidErr?.code, paidErr?.message);
    return cards.map((c) => ({ ...c, superseded: false }));
  }

  const supersededIds = new Set();
  for (const pending of pendingDetails) {
    const pendingPhone = normaliseKey(pending.phone);
    const pendingEmail = normaliseKey(pending.email);
    const pendingPostcode = normalisePostcodeKey(pending.postcode);
    const pendingService = serviceCategoryKey(pending.service);
    const pendingTime = new Date(pending.created_at).getTime();
    if (!pendingPostcode || !pending.preferred_date || !pendingService) continue;

    const hasMatch = paidCandidates.some((paid) => {
      const contactMatches =
        (pendingPhone && normaliseKey(paid.phone) === pendingPhone) ||
        (pendingEmail && normaliseKey(paid.email) === pendingEmail);
      if (!contactMatches) return false;
      if (normalisePostcodeKey(paid.postcode) !== pendingPostcode) return false;
      if (paid.preferred_date !== pending.preferred_date) return false;
      if (serviceCategoryKey(paid.service) !== pendingService) return false;

      const paidTime = new Date(paid.created_at).getTime();
      return paidTime > pendingTime && paidTime - pendingTime <= SUPERSEDED_WINDOW_MS;
    });

    if (hasMatch) supersededIds.add(pending.id);
  }

  return cards.map((c) => ({ ...c, superseded: supersededIds.has(c.id) }));
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
