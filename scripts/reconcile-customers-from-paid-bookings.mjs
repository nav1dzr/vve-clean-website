// ONE-TIME reconciliation: find or create a `customers` row for every
// existing PAID booking that predates the webhook's automatic customer
// sync (see api/stripe-webhook.js's "Customer sync" block and
// api/_lib/customerSync.js).
//
// Safety, per the standing project rules for this script:
//   - DRY RUN BY DEFAULT. Reports counts only; writes nothing.
//   - Requires the explicit --apply flag to write anything.
//   - Never auto-merges an ambiguous match (a booking whose email points to
//     one existing customer and whose phone points to a DIFFERENT existing
//     customer is always skipped and listed for manual review — same as
//     this project's everywhere-else "warn, never auto-merge" stance; see
//     admin/api/_lib/customerLifecycle.js's findDuplicateWarnings header).
//   - Sends no customer-facing message of any kind.
//   - Makes no Stripe API call at all — reads only from Supabase.
//   - Never updates or deletes an existing booking or customer row; the
//     only write this script can ever make is INSERT INTO customers.
//
// Usage:
//   Dry run (default, no writes):
//     node --env-file=.env scripts/reconcile-customers-from-paid-bookings.mjs
//
//   Apply (after reviewing the dry-run report):
//     node --env-file=.env scripts/reconcile-customers-from-paid-bookings.mjs --apply

import { createClient } from '@supabase/supabase-js';
import {
  normaliseEmailForDedup, normalisePhoneForDedup, findOrCreateCustomerForPaidBooking,
} from '../api/_lib/customerSync.js';

const APPLY = process.argv.includes('--apply');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) { console.error('[reconcile] VITE_SUPABASE_URL is not set'); process.exit(1); }
if (!supabaseKey) { console.error('[reconcile] SUPABASE_SERVICE_ROLE_KEY is not set'); process.exit(1); }

console.log('[reconcile] mode:', APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)');
if (!APPLY) {
  console.log('[reconcile] Pass --apply after reviewing this report to actually create/link customers.');
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// ── Load every paid booking ─────────────────────────────────────────────────
const { data: bookings, error: bookingsErr } = await supabase
  .from('bookings')
  .select('id, booking_ref, full_name, email, phone, address, postcode, payment_status')
  .eq('payment_status', 'paid');

if (bookingsErr) {
  console.error('[reconcile] Failed to load bookings:', bookingsErr.code, bookingsErr.message);
  process.exit(1);
}

// ── Load every existing customer once, build normalised lookup maps ────────
const { data: customers, error: customersErr } = await supabase
  .from('customers')
  .select('id, normalised_email, normalised_phone');

if (customersErr) {
  console.error('[reconcile] Failed to load customers:', customersErr.code, customersErr.message);
  process.exit(1);
}

const emailMap = new Map(); // normalised_email -> Set<customerId>
const phoneMap = new Map(); // normalised_phone -> Set<customerId>
for (const c of customers || []) {
  if (c.normalised_email) {
    if (!emailMap.has(c.normalised_email)) emailMap.set(c.normalised_email, new Set());
    emailMap.get(c.normalised_email).add(c.id);
  }
  if (c.normalised_phone) {
    if (!phoneMap.has(c.normalised_phone)) phoneMap.set(c.normalised_phone, new Set());
    phoneMap.get(c.normalised_phone).add(c.id);
  }
}

// ── Classify each paid booking ──────────────────────────────────────────────
// would_link       — exactly one existing customer matches (by email and/or phone)
// would_create     — no existing customer matches, but there's an email or phone to key on
// skip_no_contact  — no email and no phone on the booking at all
// skip_ambiguous   — email and phone point to two DIFFERENT existing customers,
//                     or either identifier alone matches more than one existing
//                     customer (a pre-existing duplicate) — never auto-merged
const results = { would_link: [], would_create: [], skip_no_contact: [], skip_ambiguous: [] };

for (const b of bookings || []) {
  const normalisedEmail = normaliseEmailForDedup(b.email);
  const normalisedPhone = normalisePhoneForDedup(b.phone);

  if (!normalisedEmail && !normalisedPhone) {
    results.skip_no_contact.push(b);
    continue;
  }

  const emailMatches = normalisedEmail ? (emailMap.get(normalisedEmail) || new Set()) : new Set();
  const phoneMatches = normalisedPhone ? (phoneMap.get(normalisedPhone) || new Set()) : new Set();
  const allMatches = new Set([...emailMatches, ...phoneMatches]);

  if (allMatches.size > 1) {
    results.skip_ambiguous.push(b);
  } else if (allMatches.size === 1) {
    results.would_link.push(b);
  } else {
    results.would_create.push(b);
  }
}

// ── Report (no PII beyond booking_ref, which is already low-sensitivity
// postcode+date and appears in every other log line in this project) ───────
console.log('[reconcile] paid bookings scanned:', (bookings || []).length);
console.log('[reconcile] existing customers loaded:', (customers || []).length);
console.log('[reconcile] would link to an existing customer:', results.would_link.length);
console.log('[reconcile] would create a new customer:       ', results.would_create.length);
console.log('[reconcile] skipped — no email or phone on file:', results.skip_no_contact.length);
console.log('[reconcile] skipped — ambiguous match (needs manual review):', results.skip_ambiguous.length);

if (results.skip_ambiguous.length > 0) {
  console.log('[reconcile] Ambiguous booking refs (manual review — never auto-merged):');
  for (const b of results.skip_ambiguous) console.log('  -', b.booking_ref);
}

if (!APPLY) {
  console.log('[reconcile] Dry run complete — no writes made.');
  process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
// Reuses the exact same find-or-create logic the live webhook uses, so an
// "apply" run behaves identically to what would have happened automatically
// at payment time — it does its own fresh search immediately before each
// insert, so it stays correct even if two of these bookings share a contact
// (the first iteration's insert becomes the second iteration's match).
console.log('[reconcile] Applying —', results.would_link.length + results.would_create.length, 'bookings to process...');

let linked = 0;
let created = 0;
let failed = 0;

for (const b of [...results.would_link, ...results.would_create]) {
  const outcome = await findOrCreateCustomerForPaidBooking(supabase, {
    full_name:   b.full_name,
    email:       b.email,
    phone:       b.phone,
    address:     b.address,
    postcode:    b.postcode,
    booking_ref: b.booking_ref,
  });
  if (!outcome.ok) {
    failed += 1;
    console.warn('[reconcile] failed for', b.booking_ref, '—', outcome.error || outcome.reason);
    continue;
  }
  if (outcome.created) created += 1; else linked += 1;
}

console.log('[reconcile] Apply complete — created:', created, '| linked:', linked, '| failed:', failed);
