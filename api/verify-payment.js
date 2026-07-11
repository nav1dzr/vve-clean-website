// Read-only payment verification for Google Ads conversion gating.
// Never modifies any data — only reads from Supabase and Stripe.
//
// GET /api/verify-payment?ref=<booking_ref>&token=<confirmation_token>&sid=<stripe_session_id>
// Response: { paid: true } or { paid: false }
//
// The booking_ref alone is NOT sufficient — a token or Stripe session ID is required.
// This prevents arbitrary verification of guessable booking references.
//
// Resolution order:
//  1. token provided → query Supabase WHERE booking_ref = ref AND confirmation_token = token
//  2. sid provided   → query Supabase WHERE stripe_session_id = sid; Stripe direct if row missing
//  3. Neither        → { paid: false }

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

  const hasToken = isValidTokenFormat(token);
  const hasSid   = /^cs_(live|test)_/.test(sid);

  if (!hasToken && !hasSid) {
    return respond(res, false);
  }

  try {
    const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabase();

    // ── Path A: confirmation token ────────────────────────────────────────────
    if (hasToken && supabase) {
      const { data, error: dbErr } = await supabase
        .from('bookings')
        .select('payment_status, stripe_session_id')
        .eq('booking_ref', ref)
        .eq('confirmation_token', token)
        .maybeSingle();

      if (dbErr) {
        console.error('[verify-payment] token lookup error — code:', dbErr.code,
          '| message:', dbErr.message);
      }

      if (data) {
        if (data.payment_status === 'paid') return respond(res, true);

        // Row exists but still pending — verify via Stripe (handles webhook timing).
        const stripeId = data.stripe_session_id || (hasSid ? sid : null);
        if (stripeId && /^cs_(live|test)_/.test(stripeId)) {
          const session = await stripe.checkout.sessions.retrieve(stripeId);
          return respond(res, session.payment_status === 'paid');
        }
        return respond(res, false);
      }

      // Token not matched — fall through to sid if available.
      console.warn('[verify-payment] token lookup: no match for ref/token pair');
    }

    // ── Path B: Stripe session ID ─────────────────────────────────────────────
    if (hasSid) {
      if (supabase) {
        const { data, error: dbErr } = await supabase
          .from('bookings')
          .select('payment_status, stripe_session_id')
          .eq('stripe_session_id', sid)
          .maybeSingle();

        if (dbErr) {
          console.error('[verify-payment] sid lookup error — code:', dbErr.code,
            '| message:', dbErr.message);
        }

        if (data) {
          if (data.payment_status === 'paid') return respond(res, true);

          // Pending — verify via Stripe.
          const stripeId = data.stripe_session_id || sid;
          if (/^cs_(live|test)_/.test(stripeId)) {
            const session = await stripe.checkout.sessions.retrieve(stripeId);
            return respond(res, session.payment_status === 'paid');
          }
          return respond(res, false);
        }
      }

      // No Supabase row — fall back to Stripe directly (webhook not yet landed).
      console.warn('[verify-payment] no Supabase row for sid:', sid, '— Stripe direct fallback');
      const session = await stripe.checkout.sessions.retrieve(sid);
      return respond(res, session.payment_status === 'paid');
    }

    return respond(res, false);

  } catch (err) {
    console.error('[verify-payment] error:', err.message);
    return respond(res, false);
  }
}
