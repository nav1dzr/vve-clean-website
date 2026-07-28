import { describe, it, expect } from 'vitest';
import { normaliseEmailForDedup, normalisePhoneForDedup, findOrCreateCustomerForPaidBooking } from '../../api/_lib/customerSync.js';

// Minimal in-memory fake scoped to exactly what findOrCreateCustomerForPaidBooking
// touches (customers + invoice_events) — real .or() filtering against a mutable
// backing array, so a "concurrent insert between SELECT and INSERT" race can be
// simulated by actually mutating the array mid-call, not just queuing canned
// responses.
function parseOrExpr(expr) {
  return expr.split(',').map((c) => {
    const [col, , ...rest] = c.split('.');
    return { col, value: rest.join('.') };
  });
}

function makeSupabase({ customers = [], insertError = null, simulateRaceInsert = null } = {}) {
  const state = customers.map((c) => ({ ...c }));
  const inserted = [];
  const eventInserts = [];
  let selectCallCount = 0;
  let idCounter = 1;

  return {
    from(table) {
      if (table === 'customers') {
        return {
          select: () => ({
            or: (expr) => {
              selectCallCount += 1;
              if (simulateRaceInsert && selectCallCount === 2) {
                state.push({ ...simulateRaceInsert });
              }
              const clauses = parseOrExpr(expr);
              const matches = state
                .filter((c) => clauses.some(({ col, value }) => c[col] === value))
                .map((c) => ({ id: c.id }));
              return Promise.resolve({ data: matches, error: null });
            },
          }),
          insert: (row) => ({
            select: () => ({
              single: () => {
                inserted.push(row);
                if (insertError) return Promise.resolve({ data: null, error: insertError });
                const id = `new-cust-${idCounter++}`;
                state.push({ id, ...row });
                return Promise.resolve({ data: { id }, error: null });
              },
            }),
          }),
        };
      }
      if (table === 'invoice_events') {
        return {
          insert: (row) => {
            eventInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    _inserted: inserted,
    _eventInserts: eventInserts,
  };
}

describe('normaliseEmailForDedup / normalisePhoneForDedup', () => {
  it('lowercases and trims email', () => {
    expect(normaliseEmailForDedup('  Jane@Example.COM ')).toBe('jane@example.com');
  });
  it('strips everything but digits from phone', () => {
    expect(normalisePhoneForDedup('+44 (0) 7700 900123')).toBe('4407700900123');
  });
});

describe('findOrCreateCustomerForPaidBooking', () => {
  it('creates a new customer from a paid booking when no existing match', async () => {
    const supabase = makeSupabase({ customers: [] });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: 'Jane@Example.com', phone: '07700 900123',
      address: '1 Test St', postcode: 'N15 2NG', booking_ref: 'N152NG160726',
    });

    expect(result).toEqual({ ok: true, customerId: 'new-cust-1', created: true });
    expect(supabase._inserted).toHaveLength(1);
    expect(supabase._inserted[0]).toMatchObject({
      name: 'Jane Doe', email: 'Jane@Example.com', phone: '07700 900123',
      normalised_email: 'jane@example.com', normalised_phone: '07700900123',
      source: 'website', customer_type: 'individual', created_by_admin_id: null,
    });
  });

  it('logs an invoice_events "created" row for a newly created customer, tagged as an automatic sync', async () => {
    const supabase = makeSupabase({ customers: [] });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: 'jane@example.com', phone: null,
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(supabase._eventInserts).toHaveLength(1);
    expect(supabase._eventInserts[0]).toMatchObject({
      document_type: 'customer', document_id: result.customerId, event_type: 'created',
      admin_id: null, metadata: { source: 'stripe_webhook_auto', bookingRef: 'N152NG160726' },
    });
  });

  it('reuses an existing customer matched by normalised email, without inserting a new one', async () => {
    const supabase = makeSupabase({
      customers: [{ id: 'c-1', normalised_email: 'jane@example.com', normalised_phone: null }],
    });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: 'JANE@EXAMPLE.COM', phone: null,
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result).toEqual({ ok: true, customerId: 'c-1', created: false });
    expect(supabase._inserted).toHaveLength(0);
  });

  it('reuses an existing customer matched by normalised phone, across a different stored format', async () => {
    const supabase = makeSupabase({
      customers: [{ id: 'c-1', normalised_email: null, normalised_phone: '447700900123' }],
    });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: null, phone: '+44 7700 900123',
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result).toEqual({ ok: true, customerId: 'c-1', created: false });
    expect(supabase._inserted).toHaveLength(0);
  });

  it('creates using phone alone when the booking has no email on file', async () => {
    const supabase = makeSupabase({ customers: [] });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: null, phone: '07700900123',
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(supabase._inserted[0].email).toBeNull();
    expect(supabase._inserted[0].phone).toBe('07700900123');
    expect(supabase._inserted[0].normalised_phone).toBe('07700900123');
  });

  it('is skipped (not created, not linked) when the booking has neither email nor phone', async () => {
    const supabase = makeSupabase({ customers: [] });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: null, phone: null,
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result).toEqual({ ok: false, skipped: true, reason: 'no_email_or_phone' });
    expect(supabase._inserted).toHaveLength(0);
  });

  it('re-checks and returns the concurrently-created match instead of erroring, when insert races another invocation (23505-style)', async () => {
    const supabase = makeSupabase({
      customers: [],
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
      simulateRaceInsert: { id: 'c-race', normalised_email: 'jane@example.com', normalised_phone: null },
    });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: 'jane@example.com', phone: null,
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result).toEqual({ ok: true, customerId: 'c-race', created: false });
  });

  it('surfaces a genuine insert failure (no concurrent match found on re-check) without throwing', async () => {
    const supabase = makeSupabase({
      customers: [],
      insertError: { code: '42501', message: 'permission denied for table customers' },
    });
    const result = await findOrCreateCustomerForPaidBooking(supabase, {
      full_name: 'Jane Doe', email: 'jane@example.com', phone: null,
      address: null, postcode: null, booking_ref: 'N152NG160726',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission denied/);
  });
});
