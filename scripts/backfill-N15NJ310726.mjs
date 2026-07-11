// ONE-TIME admin script: backfill booking N15NJ310726 into Supabase.
//
// IMPORTANT:
//   - This script is hardcoded to booking ref N15NJ310726 only.
//     It cannot process any other ref unless you edit BOOKING_REF below.
//   - Run with production environment variables (STRIPE_SECRET_KEY=sk_live_...).
//   - DELETE this file after successful use.
//   - Sends no email, Telegram, Google Sheets, or Google Ads event.
//   - Logs no customer personal information.
//
// Prerequisites: Node ≥ 20.6 (supports --env-file flag)
//
// Step 1 — Dry run (no writes):
//   node --env-file=.env scripts/backfill-N15NJ310726.mjs
//
// Step 2 — Verify the output matches the paid booking, then edit:
//   const DRY_RUN = false;   ← change this line
//
// Step 3 — Live upsert:
//   node --env-file=.env scripts/backfill-N15NJ310726.mjs
//
// Step 4 — In Supabase SQL Editor, confirm:
//   SELECT booking_ref, payment_status, stripe_session_id
//   FROM bookings WHERE booking_ref = 'N15NJ310726';
//
// Step 5 — Delete this file.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ── Configuration — only these two lines should ever need editing ─────────────
const BOOKING_REF = 'N15NJ310726'; // hardcoded; edit to change target (not recommended)
const DRY_RUN     = true;           // change to false only after verifying dry-run output
// ─────────────────────────────────────────────────────────────────────────────

const stripeKey    = process.env.STRIPE_SECRET_KEY;
const supabaseUrl  = process.env.VITE_SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeKey)   { console.error('[backfill] STRIPE_SECRET_KEY is not set'); process.exit(1); }
if (!supabaseUrl) { console.error('[backfill] VITE_SUPABASE_URL is not set');  process.exit(1); }
if (!supabaseKey) { console.error('[backfill] SUPABASE_SERVICE_ROLE_KEY is not set'); process.exit(1); }

if (!stripeKey.startsWith('sk_live_')) {
  console.error('[backfill] STRIPE_SECRET_KEY does not look like a live key (must start sk_live_).');
  console.error('[backfill] This script must run against the production Stripe account.');
  process.exit(1);
}

console.log('[backfill] mode:', DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE UPSERT');
console.log('[backfill] target ref:', BOOKING_REF);

const stripe   = new Stripe(stripeKey);
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// ── Find the paid Stripe session ──────────────────────────────────────────────
let session;
try {
  const results = await stripe.checkout.sessions.search({
    query: `metadata["booking_ref"]:"${BOOKING_REF}"`,
    limit: 5,
  });

  const paid = results.data.filter(
    (s) => s.payment_status === 'paid' &&
           s.currency       === 'gbp'  &&
           s.amount_total   === 3000,
  );

  if (paid.length === 0) {
    console.error('[backfill] No paid GBP £30 session found for ref', BOOKING_REF);
    process.exit(1);
  }
  if (paid.length > 1) {
    console.error('[backfill] Multiple matching sessions — cannot safely pick one:');
    paid.forEach((s) => console.error('  ', s.id));
    process.exit(1);
  }

  session = paid[0];
} catch (err) {
  console.error('[backfill] Stripe search failed:', err.message);
  process.exit(1);
}

// ── Verify invariants ─────────────────────────────────────────────────────────
const meta = session.metadata || {};

if (meta.booking_ref !== BOOKING_REF) {
  console.error('[backfill] metadata.booking_ref mismatch:', meta.booking_ref, '!==', BOOKING_REF);
  process.exit(1);
}
if (session.payment_status !== 'paid') {
  console.error('[backfill] payment_status is not paid:', session.payment_status);
  process.exit(1);
}
if (session.currency !== 'gbp') {
  console.error('[backfill] currency is not gbp:', session.currency);
  process.exit(1);
}
if (session.amount_total !== 3000) {
  console.error('[backfill] amount_total is not 3000:', session.amount_total);
  process.exit(1);
}

console.log('[backfill] Stripe session verified — id:', session.id, '| livemode:', session.livemode);

// ── Build upsert row ──────────────────────────────────────────────────────────
// Notification flags are set to true: these were sent manually before this
// script existed, so we do not want the webhook retry monitor to re-send them.
const row = {
  booking_ref:              BOOKING_REF,
  stripe_session_id:        session.id,
  stripe_payment_intent_id: session.payment_intent || null,
  payment_status:           'paid',
  deposit_amount:           30,
  service:                  meta.service       || null,
  preferred_date:           meta.date          || null,
  preferred_time:           meta.time          || null,
  confirmation_token:       null,
  email_customer_sent:      true,
  email_business_sent:      true,
  telegram_sent:            true,
  sheets_sent:              true,
};

// PII fields — present in Stripe metadata but not logged here.
if (meta.fullName)  row.full_name = meta.fullName;
if (meta.email)     row.email     = meta.email;
if (meta.phone)     row.phone     = meta.phone;
if (meta.address)   row.address   = meta.address;
if (meta.postcode)  row.postcode  = meta.postcode;
if (meta.message)   row.notes     = meta.message;

// ── Dry run ───────────────────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log('[backfill] DRY RUN — would upsert (PII fields omitted from log):');
  console.log(JSON.stringify({
    booking_ref:              row.booking_ref,
    stripe_session_id:        row.stripe_session_id,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    payment_status:           row.payment_status,
    deposit_amount:           row.deposit_amount,
    service:                  row.service,
    preferred_date:           row.preferred_date,
    preferred_time:           row.preferred_time,
    email_customer_sent:      row.email_customer_sent,
    email_business_sent:      row.email_business_sent,
    telegram_sent:            row.telegram_sent,
    sheets_sent:              row.sheets_sent,
    pii_fields_present:       ['full_name', 'email', 'phone', 'address', 'postcode', 'notes']
                                .filter((k) => row[k] != null),
  }, null, 2));
  console.log('[backfill] To write, change DRY_RUN = false in the script and run again.');
  process.exit(0);
}

// ── Live upsert ───────────────────────────────────────────────────────────────
try {
  const { error: dbErr } = await supabase
    .from('bookings')
    .upsert(row, { onConflict: 'stripe_session_id' });

  if (dbErr) {
    console.error('[backfill] Supabase upsert error:', dbErr.code, dbErr.message);
    process.exit(1);
  }

  console.log('[backfill] upserted successfully — booking_ref:', BOOKING_REF, '| session:', session.id);
  console.log('[backfill] Verify in Supabase:');
  console.log("  SELECT booking_ref, payment_status, stripe_session_id FROM bookings WHERE booking_ref = '" + BOOKING_REF + "';");
  console.log('[backfill] Then delete this file.');
} catch (dbEx) {
  console.error('[backfill] unexpected DB error:', dbEx.message);
  process.exit(1);
}
