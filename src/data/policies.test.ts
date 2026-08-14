import { describe, it, expect } from 'vitest';
import { DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT } from './policies';

// There is no automated Stripe refund flow yet — refunds on an unavailable
// slot are issued manually. This constant is the single source reused by
// BookingPage, the FAQ and the Terms of Service, so a false "automatically"
// claim or an invented business-day number can only ever be introduced once,
// here, rather than drifting independently across three pages.
describe('DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT', () => {
  it('never claims the refund happens automatically', () => {
    expect(DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT.toLowerCase()).not.toMatch(/\bautomatically\b/);
  });

  it('never invents a specific number of business days', () => {
    expect(DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT).not.toMatch(/\d+\s*business days/i);
  });

  it('states the refund goes to the original payment method', () => {
    expect(DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT).toMatch(/refunded to your original payment method/i);
  });

  it('mentions bank processing times vary, without promising a number', () => {
    expect(DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT).toMatch(/bank processing times vary/i);
  });
});
