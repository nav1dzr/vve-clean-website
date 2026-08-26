import { describe, expect, it } from 'vitest';
import { hasFailedNotification, toCard } from '../../../api/_lib/bookingFields.js';

// BACKEND_AUDIT_2026-08-03.md finding 6: `sendMail` returns { ok: false }
// rather than throwing, so a confirmation that never reached the customer is
// logged and swallowed. The booking row already records the outcome; this is
// the logic that turns those columns into something staff can act on.

const paidRow = {
  id: 'b1',
  payment_status: 'paid',
  email_customer_sent: true,
  email_business_sent: true,
};

describe('hasFailedNotification', () => {
  it('reports a failure when the customer confirmation did not send', () => {
    expect(hasFailedNotification({ ...paidRow, email_customer_sent: false })).toBe(true);
  });

  it('reports a failure when the business alert did not send', () => {
    expect(hasFailedNotification({ ...paidRow, email_business_sent: false })).toBe(true);
  });

  it('reports no failure when both emails sent', () => {
    expect(hasFailedNotification(paidRow)).toBe(false);
  });

  // A null is "we do not know", not "it failed". Rows created before
  // 20260712000000_add_security_columns.sql have null flags, and treating
  // those as failures would bury the real ones in historical noise.
  it('does not treat unknown (null) flags as a failure', () => {
    expect(
      hasFailedNotification({ ...paidRow, email_customer_sent: null, email_business_sent: null }),
    ).toBe(false);
  });

  // pending_payment rows are inserted by create-checkout-session.js before any
  // email is attempted, so their flags are legitimately false.
  it('ignores unpaid bookings, whose flags are false before any email is attempted', () => {
    expect(
      hasFailedNotification({
        ...paidRow,
        payment_status: 'pending_payment',
        email_customer_sent: false,
        email_business_sent: false,
      }),
    ).toBe(false);
  });
});

describe('toCard exposes notification delivery to the booking list', () => {
  it('flags a paid booking whose customer confirmation failed', () => {
    const card = toCard({ ...paidRow, email_customer_sent: false });

    expect(card.notificationFailed).toBe(true);
    expect(card.emailCustomerSent).toBe(false);
    expect(card.emailBusinessSent).toBe(true);
  });

  it('leaves a healthy booking unflagged', () => {
    expect(toCard(paidRow).notificationFailed).toBe(false);
  });

  it('normalises a missing flag to null rather than undefined', () => {
    const card = toCard({ id: 'b2', payment_status: 'paid' });

    expect(card.emailCustomerSent).toBeNull();
    expect(card.emailBusinessSent).toBeNull();
    expect(card.notificationFailed).toBe(false);
  });

  // CARD_SELECT is an explicit column allowlist that deliberately excludes
  // customer contact details; adding the delivery booleans must not have
  // widened it.
  it('still withholds detail-only customer fields from the card', () => {
    const card = toCard({
      ...paidRow,
      email: 'customer@example.com',
      address: '12 Example Road',
      notes: 'Private note',
    });

    expect(card).not.toHaveProperty('email');
    expect(card).not.toHaveProperty('address');
    expect(card).not.toHaveProperty('notes');
  });
});
