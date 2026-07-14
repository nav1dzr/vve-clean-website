// Read-only booking details for confirmation.html.
// Called on page load (with retry) to populate display fields.
//
// GET /api/confirmation-details?ref=<booking_ref>&token=<confirmation_token>&sid=<stripe_session_id>
//
// Lookup priority:
//  1. token provided → query Supabase WHERE booking_ref = ref AND confirmation_token = token
//  2. sid provided (Stripe session ID) → query Supabase WHERE stripe_session_id = sid;
//     fall back to Stripe direct when row is missing (handles timing / missing DB).
//  3. Neither token nor sid → { paid: false }  (generic — does not reveal whether ref exists)
//
// The booking_ref alone is NOT sufficient for lookup — it is guessable (POSTCODE+DDMMYY).
// Requiring a token prevents enumeration of booking details by guessing references.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

// Only expose these fields to the confirmation page — never return raw notes or full address.
const SAFE_SELECT = 'full_name, email, service, preferred_date, preferred_time, payment_status, status, stripe_session_id';

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

// Map a Stripe session to the standard response shape.
function fromStripeSession(session, overrideRef) {
  const meta = session.metadata || {};
  return {
    paid:       session.payment_status === 'paid',
    bookingRef: overrideRef || meta.booking_ref || session.id,
    name:       meta.fullName || '',
    service:    meta.service  || '',
    price:      meta.price    || '',
    date:       meta.date     || '',
    time:       meta.time     || '',
    // No Supabase row to read an operational status from — status is only
    // ever set/updated via the admin CRM, so treat as not-yet-confirmed.
    status:     '',
  };
}

// Validate that a token looks like a 64-char hex string (basic sanity / abuse guard).
function isValidTokenFormat(t) {
  return typeof t === 'string' && /^[0-9a-f]{64}$/.test(t);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  const params = new URL(req.url, 'https://x').searchParams;
  const ref    = params.get('ref')   || '';
  const token  = params.get('token') || '';
  const sid    = params.get('sid')   || '';

  // Must have a token or a Stripe session ID — ref alone is not enough.
  const hasToken = isValidTokenFormat(token);
  const hasSid   = /^cs_(live|test)_/.test(sid);

  if (!hasToken && !hasSid) {
    // Generic response — do not reveal whether the booking exists.
    return ok(res, { paid: false });
  }

  try {
    const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabase();

    // ── Path A: valid confirmation token ─────────────────────────────────────
    if (hasToken) {
      if (!supabase) {
        // Supabase not configured — can't verify token; fall through to Stripe sid.
        console.warn('[confirmation-details] No Supabase, cannot verify token');
      } else {
        const { data, error: dbErr } = await supabase
          .from('bookings')
          .select(SAFE_SELECT)
          .eq('booking_ref', ref)
          .eq('confirmation_token', token)
          .maybeSingle();

        if (dbErr) {
          console.error('[confirmation-details] token lookup error — code:', dbErr.code,
            '| message:', dbErr.message);
        }

        if (data) {
          // Token matched — row found.
          let paid    = data.payment_status === 'paid';
          let price   = '';
          let name    = data.full_name      || '';
          let service = data.service        || '';
          let date    = data.preferred_date || '';
          let time    = data.preferred_time || '';
          // Operational booking status — 'new' by default, only ever changed
          // to 'confirmed' etc. via the admin CRM. Never fabricated here.
          const status = data.status || '';

          const stripeId = data.stripe_session_id ||
            (hasSid ? sid : null);

          if (stripeId) {
            try {
              const session = await stripe.checkout.sessions.retrieve(stripeId);
              const meta    = session.metadata || {};
              if (!paid)    paid    = session.payment_status === 'paid';
              price                 = meta.price    || '';
              if (!name)    name    = meta.fullName || '';
              if (!service) service = meta.service  || '';
              if (!date)    date    = meta.date     || '';
              if (!time)    time    = meta.time     || '';
            } catch (e) {
              console.error('[confirmation-details] Stripe retrieve failed:', e.message);
            }
          }

          return ok(res, { paid, bookingRef: ref, name, service, price, date, time, status });
        }

        // Token not matched — could be a tampered token or pre-migration booking.
        // Fall through to Stripe sid if available.
        console.warn('[confirmation-details] token lookup: no match for ref/token pair');
      }
    }

    // ── Path B: Stripe session ID (no token, or token lookup failed) ─────────
    if (hasSid) {
      // First try Supabase by stripe_session_id (avoids Stripe API call when row exists).
      if (supabase) {
        const { data, error: dbErr } = await supabase
          .from('bookings')
          .select(SAFE_SELECT)
          .eq('stripe_session_id', sid)
          .maybeSingle();

        if (dbErr) {
          console.error('[confirmation-details] sid lookup error — code:', dbErr.code,
            '| message:', dbErr.message);
        }

        if (data) {
          let paid    = data.payment_status === 'paid';
          let price   = '';
          let name    = data.full_name      || '';
          let service = data.service        || '';
          let date    = data.preferred_date || '';
          let time    = data.preferred_time || '';
          const status = data.status || '';

          try {
            const session = await stripe.checkout.sessions.retrieve(sid);
            const meta    = session.metadata || {};
            if (!paid)    paid    = session.payment_status === 'paid';
            price                 = meta.price    || '';
            if (!name)    name    = meta.fullName || '';
            if (!service) service = meta.service  || '';
            if (!date)    date    = meta.date     || '';
            if (!time)    time    = meta.time     || '';
          } catch (e) {
            console.error('[confirmation-details] Stripe retrieve failed:', e.message);
          }

          return ok(res, {
            paid,
            bookingRef: data.booking_ref || ref,
            name,
            service,
            price,
            date,
            time,
            status,
          });
        }
      }

      // Supabase row missing or unavailable — fall back to Stripe directly.
      // This handles: webhook not yet landed, initial insert failed, Supabase unconfigured.
      console.warn('[confirmation-details] no Supabase row for sid:', sid,
        '— using Stripe direct fallback');
      try {
        const session = await stripe.checkout.sessions.retrieve(sid);
        return ok(res, fromStripeSession(session, ref));
      } catch (e) {
        console.error('[confirmation-details] Stripe direct fallback failed:', e.message);
      }
    }

    return ok(res, { paid: false });

  } catch (err) {
    console.error('[confirmation-details] unexpected error:', err.message);
    return ok(res, { paid: false });
  }
}
