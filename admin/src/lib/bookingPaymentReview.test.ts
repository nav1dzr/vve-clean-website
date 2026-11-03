import { describe, expect, it } from 'vitest';
import { reviewBookingPayments } from './bookingPaymentReview';

describe('booking payment review', () => {
  it('uses authoritative totals rather than adding a capped history', () => {
    expect(reviewBookingPayments({
      journey: { paid_pence: 18000, refunded_pence: 2500 },
      payments: [{ kind: 'manual_balance', amount_pence: 1000 }],
    })).toEqual({ status: 'recorded', hasBalancePayment: true, totals: { receivedPence: 18000, refundedPence: 2500, retainedPence: 15500 } });
  });
  it('shows deposits even when no balance payment exists', () => {
    expect(reviewBookingPayments({ journey: { paid_pence: 3000, refunded_pence: 0 }, payments: [{ kind: 'deposit', amount_pence: 3000 }] }))
      .toMatchObject({ status: 'recorded', hasBalancePayment: false, totals: { retainedPence: 3000 } });
  });
  it('retains the original payment and full refund without implying money is still held', () => {
    expect(reviewBookingPayments({ journey: { paid_pence: 3000, refunded_pence: 3000 }, payments: [] }))
      .toMatchObject({ status: 'recorded', totals: { receivedPence: 3000, refundedPence: 3000, retainedPence: 0 } });
  });
  it.each([
    { paid_pence: -1, refunded_pence: 0 },
    { paid_pence: 1.5, refunded_pence: 0 },
    { paid_pence: '3000', refunded_pence: 0 },
    { paid_pence: 3000 },
    { paid_pence: 3000, refunded_pence: 3001 },
    { paid_pence: Number.MAX_SAFE_INTEGER + 1, refunded_pence: 0 },
    { paid_pence: NaN, refunded_pence: 0 },
  ])('does not turn malformed financial data into a plausible total: %j', (journey) => {
    expect(reviewBookingPayments({ journey, payments: [{ kind: 'balance', amount_pence: 3000 }] })).toEqual({ status: 'unavailable' });
  });
  it('flags contradictory zero totals with a positive receipt', () => {
    expect(reviewBookingPayments({ journey: { paid_pence: 0, refunded_pence: 0 }, payments: [{ kind: 'balance', amount_pence: 3000 }] })).toEqual({ status: 'unavailable' });
  });
  it('never sums older partial history into an alleged complete total', () => {
    expect(reviewBookingPayments({ journey: { state: 'confirmed' }, payments: [{ kind: 'manual_balance', amount_pence: 10000 }] }))
      .toEqual({ status: 'recorded', hasBalancePayment: true, totals: null });
  });
  it.each([undefined, null, {}, { journey: { state: 'confirmed' } }])('keeps a missing response distinct from no payments: %j', (history) => {
    expect(reviewBookingPayments(history)).toEqual({ status: 'unavailable' });
  });
  it.each([{ journey: null }, { journey: { paid_pence: 0, refunded_pence: 0 }, payments: [] }])('accepts an explicit empty result: %j', (history) => {
    expect(reviewBookingPayments(history)).toEqual({ status: 'clear' });
  });
});
