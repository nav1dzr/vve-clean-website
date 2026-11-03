// Phase 1B read-only policy. No database/provider calls or financial mutations.
// NOT a write authorization: a future transactional RPC must recheck all
// versions, source identities, allocation limits and permissions under locks.
const BALANCE_KINDS = new Set(['balance', 'manual_balance']);
const DEPOSIT_KINDS = new Set(['deposit', 'manual_deposit']);
const block = (code) => ({ state: 'needs_review', code });
const pence = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const id = (v) => typeof v === 'string' && v.length > 0 && v.length <= 240;
const gbp = (v) => typeof v === 'string' && v.toLowerCase() === 'gbp';
function pounds(value) {
  const text = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return pence(result) ? result : null;
}
function add(values) {
  const total = values.reduce((sum, v) => sum + v, 0);
  return pence(total) ? total : null;
}

export function buildBookingInvoiceAllocationPreview(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return block('incomplete_history');
  const { invoice: inv, journey: j, payments, invoicePayments, relatedInvoices, allocations,
    complete, sourcePaymentId, depositReviewed = false } = input;
  if (!['payments', 'invoicePayments', 'relatedInvoices', 'allocations'].every((key) => complete?.[key] === true)
      || ![payments, invoicePayments, relatedInvoices, allocations].every(Array.isArray)) return block('incomplete_history');
  if (!inv || !j || !id(inv.id) || !id(inv.booking_id) || inv.booking_id !== j.booking_id) return block('booking_link_required');
  if (inv.document_status !== 'issued' || inv.superseded_by_invoice_id) return block('active_issued_invoice_required');
  if (!gbp(inv.currency)) return block('currency_requires_review');
  if (!Number.isSafeInteger(j.revision) || j.revision < 0 || typeof inv.updated_at !== 'string'
      || !Number.isFinite(Date.parse(inv.updated_at))) return block('version_required');
  // No customer or payer is inferred from a matching email, address or amount.
  const related = relatedInvoices.filter((r) => r?.booking_id === inv.booking_id
    && ['draft', 'issued'].includes(r.document_status) && !r.superseded_by_invoice_id);
  if (related.length !== 1 || related[0].id !== inv.id) return block('multiple_invoices_require_review');
  const total = pounds(inv.total), deposit = pounds(inv.deposit_applied);
  const paid = pounds(inv.amount_paid), due = pounds(inv.amount_due);
  if ([total, deposit, paid, due].some((n) => n === null) || total <= 0 || deposit > total
      || total - deposit - paid !== due || !pence(j.paid_pence) || !pence(j.refunded_pence)
      || j.refunded_pence > j.paid_pence) return block('invalid_totals');
  if (j.refunded_pence !== 0 || payments.some((p) => p?.kind === 'refund')) return block('refund_requires_review');
  const seen = new Set();
  for (const payment of payments) {
    if (!payment || !id(payment.external_id) || payment.booking_id !== inv.booking_id
      || !gbp(payment.currency) || !pence(payment.amount_pence) || payment.amount_pence === 0
      || !BALANCE_KINDS.has(payment.kind) && !DEPOSIT_KINDS.has(payment.kind)
      || seen.has(payment.external_id)) return block('invalid_source_history');
    seen.add(payment.external_id);
  }
  const sourceTotal = add(payments.map((p) => p.amount_pence));
  if (sourceTotal === null || sourceTotal !== j.paid_pence) return block('source_totals_require_review');
  const source = payments.find((p) => p.external_id === sourcePaymentId);
  if (!source || !BALANCE_KINDS.has(source.kind)) return block('existing_balance_payment_required');
  if (allocations.some((a) => a?.source_payment_external_id === source.external_id)) return block('source_already_linked');
  // Until the write schema records immutable provenance, ordinary invoice
  // payments cannot be assumed to be different money. Reversed history also
  // needs deliberate reconciliation, not silent reuse.
  if (invoicePayments.length || paid !== 0 || allocations.length) return block('existing_invoice_activity_requires_review');
  const deposits = payments.filter((p) => DEPOSIT_KINDS.has(p.kind));
  const depositTotal = add(deposits.map((p) => p.amount_pence));
  if (depositTotal === null || depositTotal !== deposit) return block('deposit_credit_requires_review');
  if (deposit > 0 && depositReviewed !== true) return block('deposit_reference_review_required');
  if (due === 0 || source.amount_pence > due) return block('amount_requires_review');
  return {
    state: 'review_ready',
    invoiceId: inv.id, bookingId: inv.booking_id, sourcePaymentId: source.external_id,
    allocationPence: source.amount_pence, invoiceDueBeforePence: due,
    invoiceDueAfterPence: due - source.amount_pence,
    expectedInvoiceUpdatedAt: inv.updated_at, expectedJourneyRevision: j.revision,
    depositReviewed: deposit > 0,
    // This result deliberately cannot be passed to recordPayment as if new
    // money arrived. No transaction or receipt has happened.
    changesMoneyReceived: false,
  };
}
