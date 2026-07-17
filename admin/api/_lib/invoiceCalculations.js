// Server-authoritative invoice/receipt calculations. The browser may show a
// live preview while editing, but every number that is ever written to the
// database or printed on a PDF is recomputed here, from raw input, on the
// server — never trusted from the client.
//
// All arithmetic happens in integer pence internally (per
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §10) to avoid IEEE-754 float
// rounding errors on money; callers pass/receive pounds (numbers with up to
// 2 decimal places) and this module converts at the boundary.

const MAX_LINE_TOTAL_POUNDS = 100000; // sanity ceiling, not a business rule
const MAX_DOCUMENT_TOTAL_POUNDS = 500000;
const MAX_QUANTITY = 1000;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function poundsToPence(pounds) {
  return Math.round(pounds * 100);
}

function penceToPounds(pence) {
  return Math.round(pence) / 100;
}

// Validates and computes a single line item's total, in pence.
// Returns { ok: true, linePence } or { ok: false, error }.
export function calculateLineItemPence(item) {
  const quantity = item?.quantity;
  const unitPrice = item?.unitPrice;
  const lineDiscount = item?.lineDiscount ?? 0;

  if (!isFiniteNumber(quantity) || quantity <= 0) {
    return { ok: false, error: 'quantity must be a positive number' };
  }
  if (quantity > MAX_QUANTITY) {
    return { ok: false, error: `quantity must be ${MAX_QUANTITY} or fewer` };
  }
  if (!isFiniteNumber(unitPrice) || unitPrice < 0) {
    return { ok: false, error: 'unitPrice must be a non-negative number' };
  }
  if (!isFiniteNumber(lineDiscount) || lineDiscount < 0) {
    return { ok: false, error: 'lineDiscount must be a non-negative number' };
  }

  const grossPence = Math.round(poundsToPence(unitPrice) * quantity);
  const discountPence = poundsToPence(lineDiscount);

  if (discountPence > grossPence) {
    return { ok: false, error: 'lineDiscount cannot exceed quantity × unitPrice' };
  }

  const linePence = grossPence - discountPence;

  if (penceToPounds(linePence) > MAX_LINE_TOTAL_POUNDS) {
    return { ok: false, error: `line total must not exceed £${MAX_LINE_TOTAL_POUNDS}` };
  }

  return { ok: true, linePence };
}

// Validates and computes full invoice totals from raw items + document-
// level inputs. Returns { ok: true, totals } or { ok: false, error }.
//
// totals (all in pounds, 2dp):
//   subtotal, documentDiscount, taxTotal, total, depositApplied,
//   amountPaid, amountDue, lineItems: [{ ...item, lineTotal }]
export function calculateInvoiceTotals({
  items,
  documentDiscount = 0,
  vatEnabled = false,
  vatRatePercent = 0,
  depositApplied = 0,
  payments = [],
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'invoice must have at least one line item' };
  }

  let subtotalPence = 0;
  const lineItems = [];

  for (const item of items) {
    const result = calculateLineItemPence(item);
    if (!result.ok) return { ok: false, error: result.error };
    subtotalPence += result.linePence;
    lineItems.push({ ...item, lineTotal: penceToPounds(result.linePence) });
  }

  if (!isFiniteNumber(documentDiscount) || documentDiscount < 0) {
    return { ok: false, error: 'documentDiscount must be a non-negative number' };
  }
  const documentDiscountPence = poundsToPence(documentDiscount);
  if (documentDiscountPence > subtotalPence) {
    return { ok: false, error: 'documentDiscount cannot exceed the subtotal' };
  }

  const afterDiscountPence = subtotalPence - documentDiscountPence;

  // VAT is disabled by default (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §3)
  // — no tax is ever calculated or printed unless vatEnabled is explicitly
  // true, which itself is only ever true when a verified business setting
  // enables it (see admin/api/_lib/businessSettings.js).
  let taxPence = 0;
  if (vatEnabled) {
    if (!isFiniteNumber(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      return { ok: false, error: 'vatRatePercent must be between 0 and 100' };
    }
    taxPence = Math.round(afterDiscountPence * (vatRatePercent / 100));
  }

  const totalPence = afterDiscountPence + taxPence;

  if (penceToPounds(totalPence) > MAX_DOCUMENT_TOTAL_POUNDS) {
    return { ok: false, error: `invoice total must not exceed £${MAX_DOCUMENT_TOTAL_POUNDS}` };
  }

  if (!isFiniteNumber(depositApplied) || depositApplied < 0) {
    return { ok: false, error: 'depositApplied must be a non-negative number' };
  }
  const depositPence = poundsToPence(depositApplied);
  if (depositPence > totalPence) {
    return { ok: false, error: 'depositApplied cannot exceed the total' };
  }

  if (!Array.isArray(payments)) {
    return { ok: false, error: 'payments must be an array' };
  }
  let paidPence = 0;
  for (const payment of payments) {
    // Reversed payments never count toward the paid total — the row stays
    // for audit purposes (invoice_payments is append-only) but is excluded
    // from every aggregate calculation.
    if (payment?.reversedAt) continue;
    if (!isFiniteNumber(payment?.amount) || payment.amount <= 0) {
      return { ok: false, error: 'every payment amount must be a positive number' };
    }
    paidPence += poundsToPence(payment.amount);
  }

  const eligibleForPaymentPence = totalPence - depositPence;
  if (paidPence > eligibleForPaymentPence) {
    return { ok: false, error: 'recorded payments exceed the amount due — overpayment is not supported in this version' };
  }

  const amountDuePence = eligibleForPaymentPence - paidPence;

  return {
    ok: true,
    totals: {
      subtotal: penceToPounds(subtotalPence),
      documentDiscount: penceToPounds(documentDiscountPence),
      taxTotal: penceToPounds(taxPence),
      total: penceToPounds(totalPence),
      depositApplied: penceToPounds(depositPence),
      amountPaid: penceToPounds(paidPence),
      amountDue: penceToPounds(amountDuePence),
      lineItems,
    },
  };
}

// Given a proposed new payment amount and the invoice's current amountDue,
// validates the payment does not overpay. Returns { ok, error }.
export function validateNewPaymentAmount(amount, amountDue) {
  if (!isFiniteNumber(amount) || amount <= 0) {
    return { ok: false, error: 'amount must be a positive number' };
  }
  if (poundsToPence(amount) > poundsToPence(amountDue)) {
    return { ok: false, error: 'payment amount exceeds the outstanding balance' };
  }
  return { ok: true };
}

export function derivePaymentStatus(amountDue, total) {
  if (poundsToPence(amountDue) <= 0) return 'paid';
  if (poundsToPence(amountDue) < poundsToPence(total)) return 'partially_paid';
  return 'unpaid';
}

// "Overdue" is derived, never stored — an issued, non-void invoice with a
// positive balance and a due date in the past.
export function isOverdue({ documentStatus, amountDue, dueDate }, today = new Date()) {
  if (documentStatus !== 'issued') return false;
  if (!(amountDue > 0)) return false;
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T23:59:59Z`);
  return due.getTime() < today.getTime();
}
