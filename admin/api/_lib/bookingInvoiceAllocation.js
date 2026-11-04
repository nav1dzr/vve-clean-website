import { isValidUuid, isValidDateString } from './normalise.js';
import { buildBookingInvoiceAllocationPreview } from './bookingInvoiceAllocationPreview.js';

export function bookingInvoiceAllocationEnabled() {
  return process.env.BOOKING_INVOICE_ALLOCATION_ENABLED === 'true';
}
const unknownResult = {
  ok: false,
  outcome: 'unknown',
  error: 'The result is still pending. Retry this saved request to check its status.',
};

function savedAllocation(data) {
  const validAmount = (value) =>
    (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value))) &&
    Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 500000;
  if (!data || !isValidUuid(data.allocationId) || !isValidUuid(data.paymentId) ||
    (data.receiptId !== null && !isValidUuid(data.receiptId)) ||
    typeof data.replayed !== 'boolean' || !validAmount(data.amountDue) || !validAmount(data.amountPaid) ||
    !['paid', 'partially_paid'].includes(data.paymentStatus) ||
    (data.paymentStatus === 'paid') !== (Number(data.amountDue) === 0)) return unknownResult;
  return {
    ok: true,
    allocationId: data.allocationId,
    paymentId: data.paymentId,
    receiptId: data.receiptId,
    amountDue: Number(data.amountDue),
    amountPaid: Number(data.amountPaid),
    paymentStatus: data.paymentStatus,
    replayed: data.replayed,
  };
}

const messages = {
  allocation_stale: 'The booking or invoice changed. Refresh the review before applying a payment.',
  allocation_admin_required: 'Admin access is required.',
  allocation_booking_link_required: 'This invoice needs an explicit link to its booking.',
  allocation_invoice_missing: 'Invoice not found.',
  allocation_active_invoice_required: 'Choose a current issued invoice.',
  allocation_completed_booking_required: 'Complete the booking before applying its balance payment.',
  allocation_multiple_invoices: 'More than one invoice is linked to this booking. Review them together first.',
  allocation_refund_review: 'This booking has a refund. Review its payment and invoice history first.',
  allocation_totals_invalid: 'The recorded totals need review before linking a payment.',
  allocation_existing_activity: 'This invoice or booking already has allocation or payment activity. Review it first.',
  allocation_source_history_invalid: 'The complete booking payment history could not be verified.',
  allocation_source_totals_invalid: 'The booking payment record and its total do not agree.',
  allocation_deposit_review: 'Check the source references for the deposit already applied to this invoice.',
  allocation_source_invalid: 'This source payment cannot be applied to this invoice.',
  allocation_multiple_balance_payments: 'Review the multiple balance payments on this booking together first.',
  allocation_currency_invalid: 'The payment currency needs review.',
  allocation_input_invalid: 'Check the original payment method, payment date and review details.',
  allocation_test_booking: 'Test bookings cannot create formal payment allocations.',
  allocation_operation_conflict: 'This request already exists with different details. Review the saved payment history.',
  allocation_source_already_linked: 'This booking payment has already been linked. Review its saved allocation.',
};
export async function getBookingInvoiceAllocationReview(db, invoiceId, adminId) {
  let response;
  try {
    response = await db.rpc('booking_invoice_allocation_snapshot', { p_invoice_id: invoiceId, p_admin_id: adminId });
  } catch { return { ok: false, error: 'Could not load the payment review. Please retry.' }; }
  if (response.error || !response.data?.invoice || !Array.isArray(response.data.payments)) {
    return { ok: false, error: 'Could not load the complete payment review. Please retry.' };
  }
  const snapshot=response.data;
  const inv=snapshot.invoice, j=snapshot.journey;
  return {
    ok: true, invoiceId, expectedInvoiceUpdatedAt: inv.updated_at,
    expectedJourneyRevision: j?.revision ?? null,
    invoiceDuePence: Math.round(Number(inv.amount_due)*100),
    depositAppliedPence: Math.round(Number(inv.deposit_applied)*100),
    depositSources: snapshot.payments
      .filter((payment) => ['deposit', 'manual_deposit'].includes(payment?.kind))
      .map((payment) => ({
        sourcePaymentId: payment.external_id,
        amountPence: payment.amount_pence,
        recordedAt: payment.created_at,
      })),
    candidates: snapshot.payments.filter((p)=>['balance','manual_balance'].includes(p?.kind)).map((p)=>({
      sourcePaymentId:p.external_id, kind:p.kind, amountPence:p.amount_pence, recordedAt:p.created_at,
      // Prospective eligibility only. Actual owner acknowledgement is mandatory
      // on POST and checked again by SQL; this GET never supplies that consent.
      requiresDepositReview:Number(inv.deposit_applied)>0,
      decision:buildBookingInvoiceAllocationPreview({...snapshot,sourcePaymentId:p.external_id,depositReviewed:true}),
    })),
  };
}

export async function lookupBookingInvoiceAllocation(db, invoiceId, operationId, adminId) {
  if (!isValidUuid(operationId)) return unknownResult;
  try {
    const { data, error } = await db.rpc('booking_invoice_allocation_snapshot', {
      p_invoice_id: invoiceId,
      p_admin_id: adminId,
      p_operation_id: operationId,
    });
    if (error) return unknownResult;
    if (!data) return {
      ok: false,
      outcome: 'unknown',
      error: 'There is no saved result for this request yet. Check the invoice payment history before proceeding.',
    };
    return savedAllocation(data);
  } catch {
    return unknownResult;
  }
}

export async function applyExistingBookingPayment(db, invoiceId, input, adminId) {
  const invalid = !input || !isValidUuid(input.operationId) || typeof input.sourcePaymentId !== 'string'
    || !input.sourcePaymentId.trim() || input.sourcePaymentId.length>300
    || typeof input.expectedInvoiceUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.expectedInvoiceUpdatedAt))
    || !Number.isSafeInteger(input.expectedJourneyRevision) || input.expectedJourneyRevision<0
    || typeof input.depositReviewed !== 'boolean' || input.reviewedSource !== true
    || !['bank_transfer','cash','card','stripe','other'].includes(input.method) || !isValidDateString(input.paymentDate)
    || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length>1000;
  if (invalid) return {ok:false,outcome:'not_applied',code:'allocation_input_invalid',error:messages.allocation_input_invalid};
  let result;
  try {
    result=await db.rpc('apply_booking_invoice_allocation',{
      p_invoice_id:invoiceId,p_source_payment_external_id:input.sourcePaymentId,p_operation_id:input.operationId,
      p_expected_invoice_updated_at:input.expectedInvoiceUpdatedAt,p_expected_journey_revision:input.expectedJourneyRevision,
      p_deposit_reviewed:input.depositReviewed,p_payment_method:input.method,p_payment_date:input.paymentDate,
      p_review_reason:input.reason.trim(),p_admin_id:adminId,
    });
  } catch {
    return unknownResult;
  }
  if (result.error) {
    const code=result.error.message;
    if (Object.hasOwn(messages,code)) return {
      ok:false,code,outcome:['allocation_operation_conflict','allocation_source_already_linked','allocation_existing_activity'].includes(code)?'needs_review':'not_applied',
      error:messages[code],
    };
    return unknownResult;
  }
  return savedAllocation(result.data);
}
