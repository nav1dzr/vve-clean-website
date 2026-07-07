// Read-only payment verification for Google Ads conversion gating.
// Called by confirmation.html before firing the conversion event.
// Never modifies any data — only reads from Stripe and Supabase.
//
// GET /api/verify-payment?ref=<booking_ref_or_stripe_session_id>
// Response: { paid: true } or { paid: false }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function respond(res, paid) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ paid: !!paid }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  const ref = new URL(req.url, 'https://x').searchParams.get('ref') || '';

  // No ref — definitely not from our checkout flow.
  if (!ref) return respond(res, false);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Case 1: ref is a Stripe checkout session ID ───────────────────────
    if (/^cs_(live|test)_/.test(ref)) {
      const session = await stripe.checkout.sessions.retrieve(ref);
      return respond(res, session.payment_status === 'paid');
    }

    // ── Case 2: ref is a booking reference (POSTCODE+DDMMYY[[-N]]) ────────
    // Primary check: Supabase (authoritative once webhook lands).
    // Fallback: Stripe session via stripe_session_id (handles webhook delay).
    const supabase = getSupabase();
    if (!supabase) {
      // Supabase not configured — cannot verify booking ref.
      return respond(res, false);
    }

    const { data } = await supabase
      .from('bookings')
      .select('payment_status, stripe_session_id')
      .eq('booking_ref', ref)
      .maybeSingle();

    // Ref not in our database at all — reject.
    if (!data) return respond(res, false);

    // Webhook has already marked it paid — trust Supabase.
    if (data.payment_status === 'paid') return respond(res, true);

    // Webhook hasn't landed yet (still 'pending_payment') but we have the
    // Stripe session ID. Verify directly with Stripe — this is authoritative.
    const sid = data.stripe_session_id;
    if (sid && /^cs_(live|test)_/.test(sid)) {
      const session = await stripe.checkout.sessions.retrieve(sid);
      return respond(res, session.payment_status === 'paid');
    }

    // Booking exists but no way to verify payment yet.
    return respond(res, false);

  } catch (err) {
    console.error('[verify-payment] error:', err.message);
    // On any error: refuse to fire conversion rather than silently trust.
    return respond(res, false);
  }
}
