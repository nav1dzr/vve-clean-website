// Core customer business logic, independent of HTTP concerns — same
// "lifecycle module + thin route adapter" split as invoiceLifecycle.js/
// receiptLifecycle.js.
//
// Booking history matching: `bookings` is intentionally NOT given a
// customer_id foreign key by this feature (see the migration file's
// header) — booking/invoice/receipt "customer history" is derived at
// query time instead. Bookings are matched to a customer by normalised
// email or normalised phone (the only identifiers a booking and a customer
// record can reliably share); invoices/receipts are matched by the
// `billing_customer_id`/`service_customer_id` FK added in this feature,
// which is exact. This means a booking made under a different email/phone
// than the one later saved on the customer record will not automatically
// appear in their history — a known, documented v1 limitation (see
// admin/INVOICES_USER_GUIDE.md), not a bug.
//
// Duplicate detection is warn-only, everywhere, by design (the original
// feature spec is explicit: never auto-merge, never merge on name alone).

import { isValidEmail } from './normalise.js';
import { CARD_SELECT as BOOKING_CARD_SELECT, toCard as toBookingCard } from './bookingFields.js';
import {
  CUSTOMER_TYPE_VALUES, CUSTOMER_SOURCE_VALUES, CUSTOMER_CONTACT_METHOD_VALUES,
  toDuplicateWarningCustomer,
} from './customerFields.js';
import { INVOICE_CARD_SELECT, toInvoiceCard, RECEIPT_CARD_SELECT, toReceiptCard } from './invoiceFields.js';

function nowIso() {
  return new Date().toISOString();
}

async function logEvent(supabase, { documentId, eventType, adminId, metadata }) {
  const { error } = await supabase.from('invoice_events').insert({
    document_type: 'customer',
    document_id: documentId,
    event_type: eventType,
    admin_id: adminId || null,
    metadata: metadata || null,
  });
  if (error) {
    console.error('[admin/api] invoice_events (customer) insert failed:', error.code, error.message);
  }
}

// Lowercase + trim only — good enough to catch the overwhelming majority
// of real duplicate entries (case/whitespace variants of the same
// address) without attempting full email-address canonicalisation.
export function normaliseEmailForDedup(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

// Digits only. Deliberately simple: does not attempt to reconcile a UK
// national "07..." form against an international "+447..." form beyond
// stripping the leading punctuation — a genuinely different-looking number
// for the same person will not be caught. Documented limitation, not a
// silent guarantee of correctness.
export function normalisePhoneForDedup(phone) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits || null;
}

function normalisedNameForCompare(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Basic (not fuzzy) name similarity: exact match, or one name containing
// the other as a substring once both are lowercased/whitespace-collapsed.
// Intentionally conservative — a false negative (missed duplicate) is
// preferred over a false positive that trains admins to ignore warnings.
function namesLookSimilar(a, b) {
  const na = normalisedNameForCompare(a);
  const nb = normalisedNameForCompare(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function validateCustomerInput(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim()) {
    return { ok: false, error: 'name is required' };
  }
  if (input.email && !isValidEmail(input.email)) {
    return { ok: false, error: 'email must be a valid email address' };
  }
  const customerType = input.customerType || 'individual';
  if (!CUSTOMER_TYPE_VALUES.includes(customerType)) {
    return { ok: false, error: `customerType must be one of: ${CUSTOMER_TYPE_VALUES.join(', ')}` };
  }
  const source = input.source || 'other';
  if (!CUSTOMER_SOURCE_VALUES.includes(source)) {
    return { ok: false, error: `source must be one of: ${CUSTOMER_SOURCE_VALUES.join(', ')}` };
  }
  if (input.preferredContactMethod && !CUSTOMER_CONTACT_METHOD_VALUES.includes(input.preferredContactMethod)) {
    return { ok: false, error: `preferredContactMethod must be one of: ${CUSTOMER_CONTACT_METHOD_VALUES.join(', ')}` };
  }
  return { ok: true, customerType, source };
}

// Never auto-merges — always returns a list of *warnings* for the caller
// (route layer) to surface to the admin. `excludeId` omits the record
// itself when checking during an update.
export async function findDuplicateWarnings(supabase, { email, phone, postcode, name }, excludeId = null) {
  const warnings = [];
  const normalisedEmail = normaliseEmailForDedup(email);
  const normalisedPhone = normalisePhoneForDedup(phone);

  if (normalisedEmail) {
    let query = supabase.from('customers').select('id, name, email, phone, postcode').eq('normalised_email', normalisedEmail);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    for (const row of data || []) warnings.push({ type: 'email', customer: toDuplicateWarningCustomer(row) });
  }

  if (normalisedPhone) {
    let query = supabase.from('customers').select('id, name, email, phone, postcode').eq('normalised_phone', normalisedPhone);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    for (const row of data || []) warnings.push({ type: 'phone', customer: toDuplicateWarningCustomer(row) });
  }

  if (postcode && name) {
    let query = supabase.from('customers').select('id, name, email, phone, postcode').eq('postcode', postcode);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    for (const row of data || []) {
      if (namesLookSimilar(row.name, name) && !warnings.some((w) => w.customer.id === row.id)) {
        warnings.push({ type: 'postcode_name', customer: toDuplicateWarningCustomer(row) });
      }
    }
  }

  return warnings;
}

export async function createCustomer(supabase, input, adminId) {
  const check = validateCustomerInput(input);
  if (!check.ok) return { ok: false, error: check.error };

  const duplicateWarnings = await findDuplicateWarnings(supabase, {
    email: input.email, phone: input.phone, postcode: input.postcode, name: input.name,
  });

  const { data: row, error } = await supabase
    .from('customers')
    .insert({
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      postcode: input.postcode || null,
      customer_type: check.customerType,
      source: check.source,
      preferred_contact_method: input.preferredContactMethod || null,
      notes: input.notes || null,
      normalised_email: normaliseEmailForDedup(input.email),
      normalised_phone: normalisePhoneForDedup(input.phone),
      created_by_admin_id: adminId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[admin/api] customer create failed:', error.code, error.message);
    return { ok: false, error: 'Failed to create customer' };
  }

  await logEvent(supabase, { documentId: row.id, eventType: 'created', adminId });

  return { ok: true, customerId: row.id, duplicateWarnings };
}

export async function updateCustomer(supabase, customerId, input, adminId) {
  const { data: existing, error: fetchErr } = await supabase
    .from('customers').select('id').eq('id', customerId).maybeSingle();
  if (fetchErr) return { ok: false, error: 'Failed to load customer' };
  if (!existing) return { ok: false, error: 'Customer not found', status: 404 };

  const check = validateCustomerInput(input);
  if (!check.ok) return { ok: false, error: check.error };

  const duplicateWarnings = await findDuplicateWarnings(supabase, {
    email: input.email, phone: input.phone, postcode: input.postcode, name: input.name,
  }, customerId);

  const { error } = await supabase
    .from('customers')
    .update({
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      postcode: input.postcode || null,
      customer_type: check.customerType,
      source: check.source,
      preferred_contact_method: input.preferredContactMethod || null,
      notes: input.notes || null,
      normalised_email: normaliseEmailForDedup(input.email),
      normalised_phone: normalisePhoneForDedup(input.phone),
      updated_at: nowIso(),
    })
    .eq('id', customerId);

  if (error) {
    console.error('[admin/api] customer update failed:', error.code, error.message);
    return { ok: false, error: 'Failed to update customer' };
  }

  await logEvent(supabase, { documentId: customerId, eventType: 'updated', adminId });

  return { ok: true, duplicateWarnings };
}

// Customer detail + history. Balances/totals are only summed across
// issued, non-void invoices — draft totals are not "owed" yet, and a void
// invoice was never really billed, so both are excluded from
// outstandingBalance/totalPaid to keep those two numbers meaningful.
export async function getCustomerDetail(supabase, customerId) {
  const { data: customer, error: customerErr } = await supabase
    .from('customers').select('*').eq('id', customerId).maybeSingle();
  if (customerErr) return { ok: false, error: 'Failed to load customer' };
  if (!customer) return { ok: false, error: 'Customer not found', status: 404 };

  const normalisedEmail = normaliseEmailForDedup(customer.email);
  const normalisedPhone = normalisePhoneForDedup(customer.phone);

  let bookings = [];
  if (customer.email || customer.phone) {
    let query = supabase.from('bookings').select(BOOKING_CARD_SELECT);
    const filters = [];
    if (customer.email) filters.push(`email.ilike.${customer.email}`);
    if (customer.phone) filters.push(`phone.eq.${customer.phone}`);
    if (filters.length) query = query.or(filters.join(','));
    const { data } = await query.order('created_at', { ascending: false });
    bookings = (data || []).map(toBookingCard);
  }

  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select(INVOICE_CARD_SELECT)
    .or(`billing_customer_id.eq.${customerId},service_customer_id.eq.${customerId}`)
    .order('created_at', { ascending: false });
  const invoices = (invoiceRows || []).map(toInvoiceCard);

  const invoiceIds = invoices.map((i) => i.id);
  let receipts = [];
  if (invoiceIds.length) {
    const { data: receiptRows } = await supabase
      .from('receipts')
      .select(RECEIPT_CARD_SELECT)
      .in('invoice_id', invoiceIds)
      .order('created_at', { ascending: false });
    receipts = (receiptRows || []).map(toReceiptCard);
  }

  const billableInvoices = invoices.filter((i) => i.documentStatus === 'issued');
  const outstandingBalance = Math.round(billableInvoices.reduce((sum, i) => sum + (i.amountDue || 0), 0) * 100) / 100;
  const totalPaid = Math.round(billableInvoices.reduce((sum, i) => sum + (i.total - i.amountDue), 0) * 100) / 100;

  return {
    ok: true,
    customer,
    bookings,
    invoices,
    receipts,
    outstandingBalance,
    totalPaid,
    _normalisedEmail: normalisedEmail,
    _normalisedPhone: normalisedPhone,
  };
}

export function listCustomers(supabase, filters) {
  let query = supabase.from('customers').select('id, name, email, phone, postcode, customer_type, source, created_at', { count: 'exact' });

  if (filters.customerType) query = query.eq('customer_type', filters.customerType);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.q) {
    const escaped = filters.q.replace(/[%,]/g, '');
    query = query.or([
      `name.ilike.%${escaped}%`,
      `email.ilike.%${escaped}%`,
      `phone.ilike.%${escaped}%`,
      `postcode.ilike.%${escaped}%`,
    ].join(','));
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  return query;
}

// Builds a POSTCODE+DDMMYY-style booking_ref, same convention as
// api/create-checkout-session.js's buildBookingRef — duplicated locally
// rather than imported (the admin project and the public-site project are
// two independent Vercel deployments that do not share code; see
// admin/api/_lib/escHtml.js's header for the same rationale). Appends
// -1/-2/... if the base ref already exists, exactly like the original.
async function buildManualBookingRef(supabase, postcode, dateStr) {
  const pc = (postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!pc) return null;
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const dd = `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCFullYear()).slice(2)}`;
  const base = pc + dd;

  const { data } = await supabase.from('bookings').select('booking_ref').like('booking_ref', `${base}%`);
  const existing = new Set((data || []).map((r) => r.booking_ref));
  if (!existing.has(base)) return base;
  let n = 1;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// Creates a manually-entered booking from a customer's record — for work
// arranged by phone/WhatsApp/email that never goes through the public
// quote/checkout flow. Deliberately narrow: it inserts only the columns
// the public checkout flow itself would fill in for a paid booking (see
// api/create-checkout-session.js), leaving every Stripe-specific column
// (stripe_session_id, stripe_payment_intent_id) and every attribution
// column untouched/NULL, and setting deposit_amount to 0 — no online
// deposit was taken, so the booking must never look like one was. This
// never writes to, reads from, or otherwise touches the Stripe checkout
// session, webhook, or public booking flow — a manual booking is
// structurally indistinguishable from any other CRM-created row except by
// its first_source/last_source value.
export async function createManualBooking(supabase, customerId, input, adminId) {
  const { data: customer, error: customerErr } = await supabase
    .from('customers').select('*').eq('id', customerId).maybeSingle();
  if (customerErr) return { ok: false, error: 'Failed to load customer' };
  if (!customer) return { ok: false, error: 'Customer not found', status: 404 };

  if (typeof input.service !== 'string' || !input.service.trim()) {
    return { ok: false, error: 'service is required' };
  }
  if (!customer.email && !customer.phone && !input.phone && !input.email) {
    return { ok: false, error: 'customer must have an email or phone on file to create a booking' };
  }

  const postcode = input.postcode || customer.postcode || null;
  const bookingRef = await buildManualBookingRef(supabase, postcode, input.serviceDate);

  const { data: row, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: bookingRef,
      full_name: customer.name,
      email: input.email || customer.email || null,
      phone: input.phone || customer.phone || null,
      address: input.address || customer.address || null,
      postcode,
      service: input.service.trim(),
      service_date: input.serviceDate || null,
      preferred_date: input.serviceDate || null,
      total_price: typeof input.totalPrice === 'number' ? input.totalPrice : null,
      deposit_amount: 0,
      notes: input.notes || null,
      status: 'new',
      payment_status: 'pending_payment',
      first_source: 'admin_manual',
      last_source: 'admin_manual',
    })
    .select('id, booking_ref')
    .single();

  if (error) {
    console.error('[admin/api] manual booking create failed:', error.code, error.message);
    return { ok: false, error: 'Failed to create booking' };
  }

  const { error: noteErr } = await supabase.from('internal_notes').insert({
    booking_id: row.id,
    author_admin_id: adminId,
    note: `Booking created manually from customer record "${customer.name}".`,
  });
  if (noteErr) {
    console.error('[admin/api] manual booking audit note failed:', noteErr.code, noteErr.message);
  }

  return { ok: true, bookingId: row.id, bookingRef: row.booking_ref };
}
