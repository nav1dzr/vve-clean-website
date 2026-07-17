import { describe, it, expect } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  normaliseEmailForDedup, normalisePhoneForDedup, validateCustomerInput,
  findDuplicateWarnings, createCustomer, updateCustomer, getCustomerDetail,
  listCustomers, createManualBooking,
} from '../../../api/_lib/customerLifecycle.js';

describe('normaliseEmailForDedup / normalisePhoneForDedup', () => {
  it('lowercases and trims email', () => {
    expect(normaliseEmailForDedup('  Jane@Example.COM ')).toBe('jane@example.com');
  });
  it('returns null for a non-string/empty email', () => {
    expect(normaliseEmailForDedup(null)).toBeNull();
    expect(normaliseEmailForDedup('')).toBeNull();
  });
  it('strips everything but digits from phone', () => {
    expect(normalisePhoneForDedup('+44 (0) 7700 900123')).toBe('4407700900123');
  });
  it('returns null for a non-string/empty phone', () => {
    expect(normalisePhoneForDedup(undefined)).toBeNull();
  });
});

describe('validateCustomerInput', () => {
  it('requires a name', () => {
    expect(validateCustomerInput({}).ok).toBe(false);
    expect(validateCustomerInput({ name: '   ' }).ok).toBe(false);
  });
  it('defaults customerType to individual and source to other', () => {
    const result = validateCustomerInput({ name: 'Jane Doe' });
    expect(result).toEqual({ ok: true, customerType: 'individual', source: 'other' });
  });
  it('rejects an invalid customerType/source/preferredContactMethod', () => {
    expect(validateCustomerInput({ name: 'A', customerType: 'wizard' }).ok).toBe(false);
    expect(validateCustomerInput({ name: 'A', source: 'carrier_pigeon' }).ok).toBe(false);
    expect(validateCustomerInput({ name: 'A', preferredContactMethod: 'telepathy' }).ok).toBe(false);
  });
  it('rejects an invalid email', () => {
    expect(validateCustomerInput({ name: 'A', email: 'not-an-email' }).ok).toBe(false);
  });
  it('accepts every documented customerType and source', () => {
    for (const customerType of ['individual', 'landlord', 'letting_agent', 'agency', 'business']) {
      expect(validateCustomerInput({ name: 'A', customerType }).ok).toBe(true);
    }
    for (const source of ['website', 'phone', 'whatsapp', 'email', 'referral', 'google', 'repeat_customer', 'other']) {
      expect(validateCustomerInput({ name: 'A', source }).ok).toBe(true);
    }
  });
});

describe('findDuplicateWarnings', () => {
  it('warns on an exact normalised email match', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, normalised_email: 'jane@example.com', normalised_phone: null }],
    });
    const warnings = await findDuplicateWarnings(supabase, { email: 'Jane@Example.com', phone: null, postcode: null, name: 'Someone Else' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('email');
    expect(warnings[0].customer.id).toBe('c-1');
  });

  it('warns on an exact normalised phone match', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: null, phone: '07700900123', postcode: null, normalised_email: null, normalised_phone: '07700900123' }],
    });
    const warnings = await findDuplicateWarnings(supabase, { email: null, phone: '+44 7700 900123'.replace('+44', '0'), postcode: null, name: 'X' });
    expect(warnings.some((w) => w.type === 'phone')).toBe(true);
  });

  it('warns on matching postcode plus a similar (not necessarily identical) name', () => {
    return (async () => {
      const supabase = createFakeSupabase({
        customers: [{ id: 'c-1', name: 'Jane Doe', email: null, phone: null, postcode: 'N15 2NG', normalised_email: null, normalised_phone: null }],
      });
      const warnings = await findDuplicateWarnings(supabase, { email: null, phone: null, postcode: 'N15 2NG', name: 'jane doe' });
      expect(warnings.some((w) => w.type === 'postcode_name')).toBe(true);
    })();
  });

  it('does NOT warn on name alone (no postcode) — never merge on name only', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: null, phone: null, postcode: null, normalised_email: null, normalised_phone: null }],
    });
    const warnings = await findDuplicateWarnings(supabase, { email: null, phone: null, postcode: null, name: 'Jane Doe' });
    expect(warnings).toHaveLength(0);
  });

  it('does not warn about a different postcode with a similar name', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: null, phone: null, postcode: 'N15 2NG', normalised_email: null, normalised_phone: null }],
    });
    const warnings = await findDuplicateWarnings(supabase, { email: null, phone: null, postcode: 'E1 6AN', name: 'Jane Doe' });
    expect(warnings).toHaveLength(0);
  });

  it('excludes the record itself via excludeId (used during update)', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, normalised_email: 'jane@example.com', normalised_phone: null }],
    });
    const warnings = await findDuplicateWarnings(supabase, { email: 'jane@example.com', phone: null, postcode: null, name: 'Jane Doe' }, 'c-1');
    expect(warnings).toHaveLength(0);
  });
});

describe('createCustomer / updateCustomer', () => {
  it('creates a customer, normalises email/phone, and returns duplicate warnings', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-existing', name: 'Existing', email: 'dup@example.com', phone: null, postcode: null, normalised_email: 'dup@example.com', normalised_phone: null }],
    });
    const result = await createCustomer(supabase, { name: 'New Person', email: 'DUP@Example.com', customerType: 'landlord', source: 'phone' }, 'admin-1');
    expect(result.ok).toBe(true);
    expect(result.duplicateWarnings).toHaveLength(1);

    const row = supabase._tables.customers.find((c) => c.id === result.customerId);
    expect(row.normalised_email).toBe('dup@example.com');
    expect(row.customer_type).toBe('landlord');

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === result.customerId);
    expect(events.map((e) => e.event_type)).toEqual(['created']);
    expect(events[0].document_type).toBe('customer');
  });

  it('rejects an invalid create input', async () => {
    const supabase = createFakeSupabase();
    const result = await createCustomer(supabase, { name: '' }, 'admin-1');
    expect(result.ok).toBe(false);
  });

  it('updates a customer and logs an "updated" event', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane', email: 'jane@example.com', phone: null, postcode: null, normalised_email: 'jane@example.com', normalised_phone: null, customer_type: 'individual', source: 'other' }],
    });
    const result = await updateCustomer(supabase, 'c-1', { name: 'Jane Updated', email: 'jane@example.com', customerType: 'business', source: 'referral' }, 'admin-1');
    expect(result.ok).toBe(true);

    const row = supabase._tables.customers.find((c) => c.id === 'c-1');
    expect(row.name).toBe('Jane Updated');
    expect(row.customer_type).toBe('business');

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === 'c-1');
    expect(events.map((e) => e.event_type)).toEqual(['updated']);
  });

  it('returns 404 updating a non-existent customer', async () => {
    const supabase = createFakeSupabase();
    const result = await updateCustomer(supabase, 'missing', { name: 'X' }, 'admin-1');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });
});

describe('getCustomerDetail', () => {
  it('returns customer + matched bookings + invoices/receipts + balances', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane', email: 'jane@example.com', phone: '07700900123', postcode: null, customer_type: 'individual', source: 'other' }],
      bookings: [
        { id: 'b-1', booking_ref: 'REF1', full_name: 'Jane', email: 'jane@example.com', phone: '07700900123', postcode: 'N15', service: 'Deep clean', preferred_date: null, preferred_time: null, service_date: null, status: 'new', payment_status: 'paid', balance_status: 'not_due', total_price: 200, created_at: '2026-01-01T00:00:00Z' },
        { id: 'b-2', booking_ref: 'REF2', full_name: 'Someone Else', email: 'other@example.com', phone: '000', postcode: 'E1', service: 'Other', preferred_date: null, preferred_time: null, service_date: null, status: 'new', payment_status: 'paid', balance_status: 'not_due', total_price: 50, created_at: '2026-01-02T00:00:00Z' },
      ],
      invoices: [
        {
          id: 'inv-1', invoice_number: 'INV-2026-000001', customer_name: 'Jane', total: 100, amount_due: 40, document_status: 'issued', payment_status: 'partially_paid', due_date: null, issue_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', billing_customer_id: 'c-1', service_customer_id: null,
        },
        {
          id: 'inv-2', invoice_number: null, customer_name: 'Jane', total: 500, amount_due: 500, document_status: 'draft', payment_status: 'unpaid', due_date: null, issue_date: null, created_at: '2026-01-03T00:00:00Z', billing_customer_id: 'c-1', service_customer_id: null,
        },
      ],
      receipts: [
        { id: 'r-1', receipt_number: 'REC-2026-000001', invoice_id: 'inv-1', customer_name: 'Jane', total_paid: 60, payment_date: '2026-01-05', created_at: '2026-01-05T00:00:00Z' },
      ],
    });

    const result = await getCustomerDetail(supabase, 'c-1');
    expect(result.ok).toBe(true);
    expect(result.bookings.map((b) => b.id)).toEqual(['b-1']);
    expect(result.invoices.map((i) => i.id).sort()).toEqual(['inv-1', 'inv-2']);
    expect(result.receipts.map((r) => r.id)).toEqual(['r-1']);
    // Only the issued invoice counts toward balances — the draft (500 due)
    // is excluded, matching the "only issued/non-void is reliably owed" rule.
    expect(result.outstandingBalance).toBe(40);
    expect(result.totalPaid).toBe(60);
  });

  it('returns 404 for a missing customer', async () => {
    const supabase = createFakeSupabase();
    const result = await getCustomerDetail(supabase, 'missing');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });
});

describe('listCustomers', () => {
  it('filters by customerType and searches by name/email/phone/postcode', async () => {
    const supabase = createFakeSupabase({
      customers: [
        { id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: '07700900123', postcode: 'N15', customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' },
        { id: 'c-2', name: 'Acme Lettings', email: 'ops@acme.example.com', phone: '02000000000', postcode: 'E1', customer_type: 'letting_agent', source: 'referral', created_at: '2026-01-02T00:00:00Z' },
      ],
    });
    const { data: onlyAgents } = await listCustomers(supabase, { customerType: 'letting_agent', source: null, q: null, sort: 'newest' });
    expect(onlyAgents.map((c) => c.id)).toEqual(['c-2']);

    const { data: searched } = await listCustomers(supabase, { customerType: null, source: null, q: 'Acme', sort: 'newest' });
    expect(searched.map((c) => c.id)).toEqual(['c-2']);
  });
});

describe('createManualBooking', () => {
  it('creates a booking with no online deposit and admin_manual source, and logs an internal note', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: '07700900123', address: '1 Test St', postcode: 'N15 2NG' }],
    });
    const result = await createManualBooking(supabase, 'c-1', { service: 'Deep clean', serviceDate: '2026-08-01', totalPrice: 150 }, 'admin-1');
    expect(result.ok).toBe(true);
    expect(result.bookingRef).toMatch(/^N152NG010826/);

    const booking = supabase._tables.bookings.find((b) => b.id === result.bookingId);
    expect(booking.deposit_amount).toBe(0);
    expect(booking.payment_status).toBe('pending_payment');
    expect(booking.first_source).toBe('admin_manual');
    expect(booking.last_source).toBe('admin_manual');
    expect(booking.stripe_session_id).toBeUndefined();

    const notes = supabase._tables.internal_notes.filter((n) => n.booking_id === result.bookingId);
    expect(notes).toHaveLength(1);
    expect(notes[0].author_admin_id).toBe('admin-1');
  });

  it('rejects when service is missing', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com' }],
    });
    const result = await createManualBooking(supabase, 'c-1', {}, 'admin-1');
    expect(result.ok).toBe(false);
  });

  it('rejects when the customer has neither email nor phone on file or supplied', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: null, phone: null }],
    });
    const result = await createManualBooking(supabase, 'c-1', { service: 'Deep clean' }, 'admin-1');
    expect(result.ok).toBe(false);
  });

  it('returns 404 for a missing customer', async () => {
    const supabase = createFakeSupabase();
    const result = await createManualBooking(supabase, 'missing', { service: 'Deep clean' }, 'admin-1');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });
});
