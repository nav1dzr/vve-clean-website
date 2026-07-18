// Best-effort customer find/create for genuinely PAID website bookings —
// called only from api/stripe-webhook.js, only after the paid booking row
// has already been durably persisted. Never called for pending_payment,
// failed, or abandoned checkout attempts (those never reach the webhook's
// "payment completed" branch at all), and never called for a superseded
// booking (superseded is a derived, read-time-only label computed by
// admin/api/bookings/index.js over pending_payment rows — it does not
// exist as a stored property, and never applies to a paid booking).
//
// normaliseEmailForDedup/normalisePhoneForDedup are deliberately duplicated
// from admin/api/_lib/customerLifecycle.js (identical algorithm) rather
// than imported — the admin project and this public-site project are two
// independent Vercel deployments that do not share code (see that file's
// own header, and admin/api/_lib/escHtml.js's header for the same
// rationale).
//
// `bookings` has no customer_id FK (by design — see customerLifecycle.js's
// header): a customer's "booking history" is derived at query time by
// matching normalised email/phone. So "linking" a paid booking to a
// customer is exactly this function's job: make sure a customers row with
// a matching normalised email or phone exists. Nothing on `bookings` itself
// needs to change.

export function normaliseEmailForDedup(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

export function normalisePhoneForDedup(phone) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits || null;
}

async function findMatchingCustomer(supabase, orClauses) {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .or(orClauses.join(','));
  return { data, error };
}

// booking: { full_name, email, phone, address, postcode, booking_ref }
// Returns:
//   { ok: true, customerId, created: boolean }
//   { ok: false, skipped: true, reason: 'no_email_or_phone' }
//   { ok: false, error: string }
export async function findOrCreateCustomerForPaidBooking(supabase, booking) {
  const email = booking.email || null;
  const phone = booking.phone || null;
  const normalisedEmail = normaliseEmailForDedup(email);
  const normalisedPhone = normalisePhoneForDedup(phone);

  if (!normalisedEmail && !normalisedPhone) {
    return { ok: false, skipped: true, reason: 'no_email_or_phone' };
  }

  const orClauses = [];
  if (normalisedEmail) orClauses.push(`normalised_email.eq.${normalisedEmail}`);
  if (normalisedPhone) orClauses.push(`normalised_phone.eq.${normalisedPhone}`);

  const { data: matches, error: findErr } = await findMatchingCustomer(supabase, orClauses);
  if (findErr) return { ok: false, error: findErr.message };

  if (matches && matches.length > 0) {
    return { ok: true, customerId: matches[0].id, created: false };
  }

  const { data: row, error: insertErr } = await supabase
    .from('customers')
    .insert({
      name: booking.full_name || email || phone || 'Website booking',
      email,
      phone,
      address: booking.address || null,
      postcode: booking.postcode || null,
      customer_type: 'individual',
      source: 'website',
      normalised_email: normalisedEmail,
      normalised_phone: normalisedPhone,
      created_by_admin_id: null,
    })
    .select('id')
    .single();

  if (insertErr) {
    // Idempotency backstop: the primary guard against duplicate customer
    // creation is the webhook's own event-claim table (a genuine Stripe
    // retry of the same event never reaches this function twice — see
    // claimStripeEvent in stripe-webhook.js). This is a secondary guard for
    // a narrower race — e.g. two different paid bookings for the same new
    // customer landing in the same instant — where another invocation may
    // have inserted a matching customer between the SELECT above and this
    // INSERT. `customers` has no unique constraint on normalised_email/
    // normalised_phone (see the 20260723000000 migration), so this re-check
    // reduces, but does not fully eliminate, that race — consistent with
    // this codebase's existing "warn/best-effort, never guaranteed atomic"
    // duplicate-detection stance (see findDuplicateWarnings's own header).
    const { data: retryMatches } = await findMatchingCustomer(supabase, orClauses);
    if (retryMatches && retryMatches.length > 0) {
      return { ok: true, customerId: retryMatches[0].id, created: false };
    }
    return { ok: false, error: insertErr.message };
  }

  try {
    await supabase.from('invoice_events').insert({
      document_type: 'customer',
      document_id: row.id,
      event_type: 'created',
      admin_id: null,
      metadata: { source: 'stripe_webhook_auto', bookingRef: booking.booking_ref || null },
    });
  } catch (logEx) {
    console.warn('[customerSync] invoice_events insert failed (non-fatal):', logEx.message);
  }

  return { ok: true, customerId: row.id, created: true };
}
