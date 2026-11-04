import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { createBookingFromEnquiry, readEnquiryBooking } from '../../../api/_lib/enquiryBooking.js';

const id = '123e4567-e89b-42d3-a456-426614174100';
const primary = '123e4567-e89b-42d3-a456-426614174101';
const tenant = '123e4567-e89b-42d3-a456-426614174102';
const payer = '123e4567-e89b-42d3-a456-426614174103';
const updated = '2026-11-04T12:00:00.123456+00:00';
const source = { id, updated_at: updated, status: 'qualified', message: 'Private sample message' };
const input = { enquiryId: id, requestId: id, expectedEnquiryUpdatedAt: updated, service: 'End of tenancy',
  paymentPlan: 'after_clean', contactRoles: { tenant, payer, agent: primary } };
const fixture = () => createFakeSupabase({ contact_enquiries: [source], customers: [
  { id: primary, name: 'Sample agent', email: 'agent@example.invalid', address: 'Agency billing address', postcode: 'E1' },
  { id: tenant, name: 'Sample tenant' }, { id: payer, name: 'Sample company', phone: '02000000000' },
] });

describe('booking drafts from an enquiry', () => {
  it('keeps the original enquiry and explicit roles, with no deposit or assumed cleaning address', async () => {
    const db = fixture();
    expect(await createBookingFromEnquiry(db, primary, input, 'staff')).toMatchObject({ ok: true, bookingId: id });
    const saved = db._tables.bookings[0];
    expect(saved).toMatchObject({
      id, address: null, postcode: null, deposit_amount: 0, status: 'new', payment_status: 'pending_payment',
      email: 'agent@example.invalid', notes: null,
      quote_config: { sourceEnquiryId: id, bookingContactRoles: input.contactRoles,
        manualPaymentPlan: 'after_clean', manualCustomerId: primary },
    });
    expect(saved.stripe_session_id).toBeUndefined();
    expect(db._tables.contact_enquiries).toEqual([source]);
    expect(db._tables.customers).toHaveLength(3);
    expect(await readEnquiryBooking(db, id)).toMatchObject({ ok: true, booking: { id } });
    expect(await createBookingFromEnquiry(db, payer, { ...input, paymentPlan: 'deposit_after_agreement' }, 'other staff'))
      .toMatchObject({ ok: true, bookingId: id, alreadyExisted: true });
    expect(db._tables.bookings).toHaveLength(1);
    expect(saved.quote_config.manualPaymentPlan).toBe('after_clean');
  });

  it('retains an explicit cleaning address and a deposit arrangement without collecting payment', async () => {
    const db = fixture();
    expect(await createBookingFromEnquiry(db, primary, {
      ...input, paymentPlan: 'deposit_after_agreement', address: 'Sample service address', postcode: 'n15 5nj',
    }, 'staff')).toMatchObject({ ok: true });
    expect(db._tables.bookings[0]).toMatchObject({
      address: 'Sample service address', postcode: 'N15 5NJ', deposit_amount: 0,
      quote_config: { manualPaymentPlan: 'deposit_after_agreement' },
    });
  });

  it.each([
    [{ expectedEnquiryUpdatedAt: '2026-11-03T00:00:00Z' }, 412],
    [{ contactRoles: { agent: '123e4567-e89b-42d3-a456-426614174109' } }, 400],
    [{ contactRoles: { billingEmail: 'someone@example.invalid' } }, 400],
    [{ requestId: '123e4567-e89b-42d3-a456-426614174109' }, 400],
    [{ paymentPlan: undefined }, 400],
  ])('rejects invalid or stale details %j without creating a booking', async (overrides, status) => {
    const db = fixture();
    expect(await createBookingFromEnquiry(db, primary, { ...input, ...overrides }, 'staff'))
      .toMatchObject({ ok: false, status });
    expect(db._tables.bookings || []).toHaveLength(0);
  });

  it('never opens an unrelated booking if the ID is already occupied', async () => {
    const db = fixture();
    await db.from('bookings').insert({ id, booking_ref: 'UNRELATED', quote_config: {} });
    expect(await createBookingFromEnquiry(db, primary, input, 'staff')).toMatchObject({ ok: false, status: 409 });
    expect(db._tables.bookings).toHaveLength(1);
  });

  it('reconciles concurrent saves with the database primary-key constraint', async () => {
    const db = fixture();
    const from = db.from;
    db.from = (table) => {
      const builder = from(table);
      if (table === 'bookings') {
        const insert = builder.insert;
        builder.insert = (row) => {
          insert(row);
          const single = builder.single;
          builder.single = async () => db._tables.bookings.some((saved) => saved.id === row.id)
            ? { data: null, error: { code: '23505' } } : single();
          return builder;
        };
      }
      return builder;
    };
    const results = await Promise.all([
      createBookingFromEnquiry(db, primary, input, 'staff'),
      createBookingFromEnquiry(db, payer, { ...input, service: 'Carpet cleaning' }, 'other staff'),
    ]);
    expect(results.every((result) => result.ok && result.bookingId === id)).toBe(true);
    expect(results.filter((result) => result.alreadyExisted)).toHaveLength(1);
    expect(db._tables.bookings).toHaveLength(1);
  });
});
