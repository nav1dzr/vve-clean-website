// One-time backfill for a specific paid booking that predates the Supabase
// bookings table. Searches Stripe for the session, verifies payment details,
// and upserts a single Supabase row.
//
// SECURITY:
//   - Disabled when BACKFILL_SECRET env var is not set (returns 404).
//   - Requires ?secret=<BACKFILL_SECRET> on every request.
//   - Remove this file (or unset BACKFILL_SECRET) after use.
//   - No customer PII is written to logs or the response.
//   - Does NOT resend emails, Telegram, or Google Sheets rows.
//
// Usage:
//   GET /api/backfill-paid-booking?secret=SECRET&ref=N15NJ310726&dry_run=true
//   GET /api/backfill-paid-booking?secret=SECRET&ref=N15NJ310726
//
// dry_run=true  → reports what would be inserted; does not write to DB.
// dry_run=false → performs the upsert (default when omitted).
//
// Exact instructions:
//   1. Add BACKFILL_SECRET=<random string> to Vercel env (preview only).
//   2. Deploy to preview.
//   3. Run with dry_run=true first. Verify the output matches the paid booking.
//   4. Run without dry_run=true to upsert.
//   5. Verify the row in Supabase: SELECT booking_ref, payment_status FROM bookings WHERE booking_ref='N15NJ310726';
//   6. Remove BACKFILL_SECRET from Vercel env (or delete this file and redeploy).

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  // Disabled when secret not configured — returns 404 to avoid revealing existence.
  const backfillSecret = process.env.BACKFILL_SECRET;
  if (!backfillSecret) {
    res.writeHead(404);
    return res.end('Not found');
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  const params  = new URL(req.url, 'https://x').searchParams;
  const secret  = params.get('secret')   || '';
  const ref     = params.get('ref')      || '';
  const dryRun  = params.get('dry_run') !== 'false';

  // Constant-time comparison to avoid timing oracle on the secret.
  const { timingSafeEqual } = await import('node:crypto');
  const secretBuf    = Buffer.from(backfillSecret);
  const providedBuf  = Buffer.from(secret.padEnd(backfillSecret.length).slice(0, backfillSecret.length));
  const secretsMatch = secretBuf.length === providedBuf.length &&
                       timingSafeEqual(secretBuf, providedBuf);

  if (!secretsMatch || !secret) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  if (!ref) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'ref is required' }));
  }

  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();

  if (!supabase) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Supabase not configured' }));
  }

  // ── Find the Stripe session via metadata search ───────────────────────────
  // Stripe Checkout Search API: https://stripe.com/docs/api/checkout/sessions/search
  let session;
  try {
    const results = await stripe.checkout.sessions.search({
      query: `metadata["booking_ref"]:"${ref}"`,
      limit: 5,
    });

    const paid = results.data.filter(
      (s) => s.payment_status === 'paid' &&
             s.currency === 'gbp' &&
             s.amount_total === 3000,
    );

    if (paid.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No paid GBP £30 session found for ref', ref }));
    }
    if (paid.length > 1) {
      // Report session IDs only — no PII
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error:      'Multiple matching sessions — cannot safely pick one',
        sessionIds: paid.map((s) => s.id),
      }));
    }

    session = paid[0];
  } catch (err) {
    console.error('[backfill] Stripe search error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Stripe search failed: ' + err.message }));
  }

  // ── Verify invariants ─────────────────────────────────────────────────────
  const meta = session.metadata || {};

  if (meta.booking_ref !== ref) {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'metadata.booking_ref mismatch' }));
  }
  if (session.payment_status !== 'paid') {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'payment_status is not paid' }));
  }
  if (session.currency !== 'gbp') {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'currency is not gbp' }));
  }
  if (session.amount_total !== 3000) {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'amount_total is not 3000 (£30)' }));
  }

  // ── Build upsert row — no PII in any log lines ────────────────────────────
  const row = {
    booking_ref:              ref,
    stripe_session_id:        session.id,
    stripe_payment_intent_id: session.payment_intent || null,
    payment_status:           'paid',
    deposit_amount:           30,
    service:                  meta.service       || null,
    preferred_date:           meta.date          || null,
    preferred_time:           meta.time          || null,
    // Backfill token is unavailable (pre-dates the token scheme)
    confirmation_token:       null,
    // Notification flags: already sent; mark true to prevent re-sends.
    email_customer_sent:      true,
    email_business_sent:      true,
    telegram_sent:            true,
    sheets_sent:              true,
  };

  // Include contact/address fields from metadata (present on older sessions).
  if (meta.fullName)  row.full_name = meta.fullName;
  if (meta.email)     row.email     = meta.email;
  if (meta.phone)     row.phone     = meta.phone;
  if (meta.address)   row.address   = meta.address;
  if (meta.postcode)  row.postcode  = meta.postcode;
  if (meta.message)   row.notes     = meta.message;

  // ── Dry run — report what would be inserted without writing ───────────────
  if (dryRun) {
    // Omit PII fields from dry-run response
    const safeRow = {
      booking_ref:              row.booking_ref,
      stripe_session_id:        row.stripe_session_id,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
      payment_status:           row.payment_status,
      deposit_amount:           row.deposit_amount,
      service:                  row.service,
      preferred_date:           row.preferred_date,
      email_customer_sent:      row.email_customer_sent,
      email_business_sent:      row.email_business_sent,
      telegram_sent:            row.telegram_sent,
      sheets_sent:              row.sheets_sent,
      // PII fields present: (not shown)
      pii_fields_present: ['full_name','email','phone','address','postcode','notes']
        .filter((k) => row[k] != null),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ dry_run: true, would_upsert: safeRow }));
  }

  // ── Live upsert ───────────────────────────────────────────────────────────
  try {
    const { error: dbErr } = await supabase
      .from('bookings')
      .upsert(row, { onConflict: 'stripe_session_id' });

    if (dbErr) {
      console.error('[backfill] Supabase upsert error:', dbErr.code, dbErr.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'DB upsert failed: ' + dbErr.message }));
    }

    console.log('[backfill] upserted booking_ref:', ref, '| session:', session.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success:            true,
      booking_ref:        ref,
      stripe_session_id:  session.id,
      payment_status:     'paid',
      note:               'Remove BACKFILL_SECRET from env and redeploy after verifying.',
    }));
  } catch (dbEx) {
    console.error('[backfill] unexpected DB error:', dbEx.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unexpected DB error: ' + dbEx.message }));
  }
}
