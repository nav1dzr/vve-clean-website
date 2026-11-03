export type BookingPaymentHistory = {
  journey?: unknown;
  payments?: { kind?: string; amount_pence?: number }[];
};

export type BookingPaymentTotals = {
  receivedPence: number;
  refundedPence: number;
  retainedPence: number;
};

export type BookingPaymentReview =
  | { status: 'clear' | 'unavailable'; totals?: never; hasBalancePayment?: never }
  | { status: 'recorded'; totals: BookingPaymentTotals | null; hasBalancePayment: boolean };

function validPence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

// History is capped at 50 rows by the API. Use the journey's authoritative
// totals; never sum that partial list, infer invoice allocations, or match
// payments from equal amounts/references.
export function reviewBookingPayments(history: BookingPaymentHistory | null | undefined): BookingPaymentReview {
  if (!history || typeof history !== 'object') return { status: 'unavailable' };
  const payments = Array.isArray(history.payments) ? history.payments : null;
  const hasBalancePayment = !!payments?.some((p) =>
    (p?.kind === 'manual_balance' || p?.kind === 'balance')
    && validPence(p.amount_pence) && p.amount_pence > 0,
  );
  const hasReceipt = !!payments?.some((p) =>
    ['manual_balance', 'balance', 'manual_deposit', 'deposit'].includes(p?.kind || '')
    && validPence(p.amount_pence) && p.amount_pence > 0,
  );
  const journey = history.journey;
  if (journey && typeof journey === 'object') {
    const data = journey as Record<string, unknown>;
    const received = data.paid_pence;
    const refunded = data.refunded_pence;
    if ('paid_pence' in data || 'refunded_pence' in data) {
      if (!validPence(received) || !validPence(refunded) || refunded > received) return { status: 'unavailable' };
      if (received === 0 && hasReceipt) return { status: 'unavailable' };
      if (received === 0) return { status: 'clear' };
      return {
        status: 'recorded', hasBalancePayment,
        totals: { receivedPence: received, refundedPence: refunded, retainedPence: received - refunded },
      };
    }
  }
  // Older responses can still establish that a payment exists, but cannot
  // establish a complete total from a limited history.
  if (hasReceipt) return { status: 'recorded', totals: null, hasBalancePayment };
  return payments || journey === null ? { status: 'clear' } : { status: 'unavailable' };
}
