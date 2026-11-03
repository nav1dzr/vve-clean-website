import { describe, expect, it } from 'vitest';
import { buildBookingInvoiceAllocationPreview as preview } from '../../../api/_lib/bookingInvoiceAllocationPreview.js';

function fixture() {
  const bookingId = 'fixture-booking';
  const invoice = { id: 'fixture-invoice', booking_id: bookingId, document_status: 'issued',
    superseded_by_invoice_id: null, currency: 'GBP', total: '150.00', deposit_applied: '30.00',
    amount_paid: '0.00', amount_due: '120.00', updated_at: '2026-11-03T22:00:00Z' };
  return {
    invoice, journey: { booking_id: bookingId, revision: 7, paid_pence: 15000, refunded_pence: 0 },
    payments: [
      { external_id: 'fixture-deposit', booking_id: bookingId, kind: 'manual_deposit', amount_pence: 3000, currency: 'gbp' },
      { external_id: 'fixture-balance', booking_id: bookingId, kind: 'manual_balance', amount_pence: 12000, currency: 'gbp' },
    ],
    invoicePayments: [], relatedInvoices: [{ ...invoice }], allocations: [],
    complete: { payments: true, invoicePayments: true, relatedInvoices: true, allocations: true },
    sourcePaymentId: 'fixture-balance', depositReviewed: true,
  };
}

describe('booking/invoice allocation preview — read-only policy', () => {
  it.each([undefined, null, [], 'bad snapshot'])('fails closed for an absent or invalid snapshot: %j', (input) => {
    expect(preview(input)).toEqual({ state: 'needs_review', code: 'incomplete_history' });
  });
  it('previews linking an existing balance without receiving money twice', () => {
    const input = fixture(), before = structuredClone(input);
    expect(preview(input)).toEqual({
      state: 'review_ready', invoiceId: 'fixture-invoice', bookingId: 'fixture-booking',
      sourcePaymentId: 'fixture-balance', allocationPence: 12000,
      invoiceDueBeforePence: 12000, invoiceDueAfterPence: 0,
      expectedInvoiceUpdatedAt: '2026-11-03T22:00:00Z', expectedJourneyRevision: 7,
      depositReviewed: true, changesMoneyReceived: false,
    });
    expect(input).toEqual(before);
  });
  it('supports a no-deposit booking using the existing balance payment', () => {
    const x = fixture();
    x.invoice.deposit_applied = '0.00'; x.invoice.amount_due = '150.00';
    x.payments = [x.payments[1]]; x.payments[0].amount_pence = 15000;
    x.depositReviewed = false;
    expect(preview(x)).toMatchObject({ state: 'review_ready', allocationPence: 15000, depositReviewed: false });
  });
  it('can preview a smaller full source payment without inventing a full settlement', () => {
    const x = fixture(); x.payments[1].amount_pence = 6000; x.journey.paid_pence = 9000;
    expect(preview(x)).toMatchObject({ state: 'review_ready', invoiceDueAfterPence: 6000 });
  });
  it.each(['payments', 'invoicePayments', 'relatedInvoices', 'allocations'])('rejects incomplete %s history', (key) => {
    const x = fixture(); x.complete[key] = false;
    expect(preview(x).code).toBe('incomplete_history');
  });
  it('rejects missing completeness flags rather than trusting the capped journey screen', () => {
    const x = fixture(); delete x.complete;
    expect(preview(x).code).toBe('incomplete_history');
  });
  it.each(['draft', 'void', 'cancelled'])('rejects an invoice in state %s', (state) => {
    const x = fixture(); x.invoice.document_status = state;
    expect(preview(x).code).toBe('active_issued_invoice_required');
  });
  it('rejects a superseded invoice', () => {
    const x = fixture(); x.invoice.superseded_by_invoice_id = 'replacement';
    expect(preview(x).code).toBe('active_issued_invoice_required');
  });
  it('does not infer a link from a similar customer or amount', () => {
    const x = fixture(); x.invoice.booking_id = 'another-booking';
    expect(preview(x).code).toBe('booking_link_required');
  });
  it('holds multiple active invoices, including competing drafts', () => {
    const x = fixture(); x.relatedInvoices.push({ ...x.invoice, id: 'other', document_status: 'draft' });
    expect(preview(x).code).toBe('multiple_invoices_require_review');
  });
  it('requires an expected invoice version and booking revision', () => {
    const x = fixture(); x.invoice.updated_at = '';
    expect(preview(x).code).toBe('version_required');
    const y = fixture(); y.journey.revision = NaN;
    expect(preview(y).code).toBe('version_required');
  });
  it('holds non-GBP invoices and source payments', () => {
    const x = fixture(); x.invoice.currency = 'USD';
    expect(preview(x).code).toBe('currency_requires_review');
    const y = fixture(); y.payments[1].currency = 'usd';
    expect(preview(y).code).toBe('invalid_source_history');
  });
  it.each(['NaN', '-1.00', '120.001', '1e2', 'Infinity', '9007199254740992.00'])('rejects malformed invoice money %s', (amount) => {
    const x = fixture(); x.invoice.amount_due = amount;
    expect(preview(x).code).toBe('invalid_totals');
  });
  it('requires invoice arithmetic to reconcile', () => {
    const x = fixture(); x.invoice.amount_due = '119.99';
    expect(preview(x).code).toBe('invalid_totals');
  });
  it('holds refunded bookings, including fully refunded receipts', () => {
    for (const amount of [1, 15000]) {
      const x = fixture(); x.journey.refunded_pence = amount;
      expect(preview(x).code).toBe('refund_requires_review');
    }
  });
  it('holds a refund row even when counters are stale', () => {
    const x = fixture(); x.payments.push({ ...x.payments[0], external_id: 'refund', kind: 'refund', amount_pence: -3000 });
    expect(preview(x).code).toBe('refund_requires_review');
  });
  it('holds a capped or inconsistent source ledger', () => {
    const x = fixture(); x.payments.pop();
    expect(preview(x).code).toBe('source_totals_require_review');
  });
  it.each([
    (x) => { x.payments[1].amount_pence = 12000.5; },
    (x) => { x.payments[1].amount_pence = -12000; },
    (x) => { x.payments[1].booking_id = 'other'; },
    (x) => { x.payments[1].kind = 'unknown'; },
    (x) => { x.payments[1].external_id = x.payments[0].external_id; },
  ])('holds invalid source provenance %#', (change) => {
    const x = fixture(); change(x);
    expect(preview(x).code).toBe('invalid_source_history');
  });
  it('does not reuse an allocation, including an allocation later reversed', () => {
    const x = fixture(); x.allocations = [{ source_payment_external_id: 'fixture-balance', reversed_at: '2026-11-03' }];
    expect(preview(x).code).toBe('source_already_linked');
  });
  it('holds unlinked invoice payment activity rather than guessing it is separate money', () => {
    const x = fixture(); x.invoicePayments = [{ amount: 120, reversed_at: null }];
    expect(preview(x).code).toBe('existing_invoice_activity_requires_review');
  });
  it('holds reversed invoice history too', () => {
    const x = fixture(); x.invoicePayments = [{ amount: 120, reversed_at: '2026-11-03' }];
    expect(preview(x).code).toBe('existing_invoice_activity_requires_review');
  });
  it('requires review of applied deposit references even if amounts match', () => {
    const x = fixture(); x.depositReviewed = false;
    expect(preview(x).code).toBe('deposit_reference_review_required');
  });
  it('holds a deposit credit that does not match the complete source ledger', () => {
    const x = fixture(); x.invoice.deposit_applied = '20.00'; x.invoice.amount_due = '130.00';
    expect(preview(x).code).toBe('deposit_credit_requires_review');
  });
  it('does not treat a deposit as another balance receipt', () => {
    const x = fixture(); x.sourcePaymentId = 'fixture-deposit';
    expect(preview(x).code).toBe('existing_balance_payment_required');
  });
  it('does not split an oversized source automatically', () => {
    const x = fixture(); x.payments[1].amount_pence = 13000; x.journey.paid_pence = 16000;
    expect(preview(x).code).toBe('amount_requires_review');
  });
  it('repeated previews are deterministic and make no mutation', () => {
    const x = fixture();
    expect(preview(x)).toEqual(preview(x));
    expect(x.allocations).toEqual([]);
    expect(x.invoice.amount_due).toBe('120.00');
  });
});
