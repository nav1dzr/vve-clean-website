// Read-only booking details for confirmation.html.
// Called on page load to populate display fields (name, service, price, date).
// Also returns paid: true/false so the caller can make decisions, but the
// Google Ads conversion uses /api/verify-payment separately per the existing flow.
//
// GET /api/confirmation-details?ref=<booking_ref_or_stripe_session_id>
// Response: { paid, bookingRef, name, email, service, price, date }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function ok(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  const ref = new URL(req.url, 'https://x').searchParams.get('ref') || '';

  if (!ref) return ok(res, { paid: false });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Case 1: Stripe checkout session ID ───────────────────────────────
    if (/^cs_(live|test)_/.test(ref)) {
      const session = await stripe.checkout.sessions.retrieve(ref);
      const meta    = session.metadata || {};
      return ok(res, {
        paid:       session.payment_status === 'paid',
        bookingRef: meta.booking_ref || ref,
        name:       meta.fullName || '',
        email:      meta.email    || '',
        service:    meta.service  || '',
        price:      meta.price    || '',
        date:       meta.date     || '',
      });
    }

    // ── Case 2: booking reference (POSTCODE+DDMMYY) ───────────────────────
    const supabase = getSupabase();
    if (!supabase) return ok(res, { paid: false });

    const { data } = await supabase
      .from('bookings')
      .select('full_name, email, service, preferred_date, payment_status, stripe_session_id')
      .eq('booking_ref', ref)
      .maybeSingle();

    if (!data) return ok(res, { paid: false });

    let paid  = data.payment_status === 'paid';
    let price = '';

    // Retrieve the Stripe session to get the quote price (not stored in Supabase)
    // and resolve webhook-timing race (pending_payment → verify via Stripe directly).
    if (data.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(data.stripe_session_id);
        if (!paid) paid = session.payment_status === 'paid';
        price = (session.metadata || {}).price || '';
      } catch (e) {
        console.error('[confirmation-details] Stripe retrieve failed:', e.message);
      }
    }

    return ok(res, {
      paid,
      bookingRef: ref,
      name:    data.full_name      || '',
      email:   data.email          || '',
      service: data.service        || '',
      price,
      date:    data.preferred_date || '',
    });

  } catch (err) {
    console.error('[confirmation-details] error:', err.message);
    return ok(res, { paid: false });
  }
}
