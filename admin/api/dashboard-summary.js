import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';
import { getServiceClient } from './_lib/supabaseAdmin.js';
import { CARD_SELECT, toCard, applyJourneyReadState } from './_lib/bookingFields.js';

export const config = { api: { bodyParser: false } };

const PREVIEW_LIMIT = 5;

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// GET /api/dashboard-summary — operational counts for the dashboard home
// page. Every number here comes from a direct, indexed query against
// `bookings` (never a per-row Stripe lookup — ADMIN_CRM_PLAN.md Phase 2
// spec). "Today" and "upcoming" are driven exclusively by the structured
// `service_date` column, never by parsing the free-text `preferred_date` —
// a booking with no `service_date` simply doesn't appear in either list,
// and is counted separately as `unscheduledCount` instead of being guessed
// at. Cancelled jobs are excluded from these operational queues only; recent
// history and financial counts still include them. The service day is London
// local time, including BST. `outstandingBalances.dataAvailable` distinguishes "zero outstanding
// balances" from "no balance data has been recorded yet", since
// `balance_status` is a brand new nullable column with no historical data.
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

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  const today = todayIsoDate();

  try {
    const [
      todayResult,
      upcomingResult,
      recentResult,
      depositsPaidResult,
      outstandingResult,
      trackedBalanceResult,
      unscheduledResult,
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select(CARD_SELECT, { count: 'exact' })
        .eq('service_date', today)
        .neq('status', 'cancelled')
        .order('preferred_time', { ascending: true })
        .limit(PREVIEW_LIMIT),
      supabase
        .from('bookings')
        .select(CARD_SELECT, { count: 'exact' })
        .gt('service_date', today)
        .neq('status', 'cancelled')
        .order('service_date', { ascending: true })
        .limit(PREVIEW_LIMIT),
      supabase
        .from('bookings')
        .select(CARD_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(PREVIEW_LIMIT),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('balance_status', 'outstanding'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).not('balance_status', 'is', null),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).is('service_date', null).neq('status', 'cancelled'),
    ]);

    const results = [
      todayResult, upcomingResult, recentResult,
      depositsPaidResult, outstandingResult, trackedBalanceResult, unscheduledResult,
    ];
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error('[admin/api] dashboard-summary query failed:', failed.error.code, failed.error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load dashboard summary' }));
    }

    const payload = {
      today: { count: todayResult.count ?? 0, bookings: (todayResult.data || []).map(toCard) },
      upcoming: { count: upcomingResult.count ?? 0, bookings: (upcomingResult.data || []).map(toCard) },
      recent: { count: recentResult.count ?? 0, bookings: (recentResult.data || []).map(toCard) },
      depositsPaid: { count: depositsPaidResult.count ?? 0 },
      outstandingBalances: {
        count: outstandingResult.count ?? 0,
        dataAvailable: (trackedBalanceResult.count ?? 0) > 0,
      },
      unscheduledCount: unscheduledResult.count ?? 0,
    };

    const cards = await applyJourneyReadState(supabase, [
      ...payload.today.bookings, ...payload.upcoming.bookings, ...payload.recent.bookings,
    ]);
    const byId = new Map(cards.map(card => [card.id, card]));
    for (const section of [payload.today, payload.upcoming, payload.recent]) {
      section.bookings = section.bookings.map(card => byId.get(card.id) || card);
    }

    res.writeHead(200, headers);
    res.end(JSON.stringify(payload));
  } catch (err) {
    console.error('[admin/api] dashboard-summary unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
