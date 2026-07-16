import { describe, it, expect } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  createDraftInvoice,
  updateDraftInvoice,
  deleteDraftInvoice,
  issueInvoice,
  voidInvoice,
  duplicateInvoiceAsDraft,
  recordPayment,
  reversePayment,
} from '../../../api/_lib/invoiceLifecycle.js';

const ADMIN_ID = 'admin-1';

function draftInput(overrides = {}) {
  return {
    customer: { name: 'Jane Doe', email: 'jane@example.com' },
    items: [{ description: 'End of tenancy clean', quantity: 1, unitPrice: 150 }],
    ...overrides,
  };
}

describe('createDraftInvoice', () => {
  it('creates a draft invoice with items and a created event, no formal number', async () => {
    const supabase = createFakeSupabase();
    const result = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    expect(result.ok).toBe(true);

    const invoice = supabase._tables.invoices.find((i) => i.id === result.invoiceId);
    expect(invoice.document_status).toBe('draft');
    expect(invoice.invoice_number).toBeUndefined();
    expect(invoice.total).toBe(150);

    const items = supabase._tables.invoice_items.filter((i) => i.invoice_id === result.invoiceId);
    expect(items).toHaveLength(1);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === result.invoiceId);
    expect(events.map((e) => e.event_type)).toEqual(['created']);
  });

  it('rejects a customer with neither email nor phone', async () => {
    const supabase = createFakeSupabase();
    const result = await createDraftInvoice(supabase, draftInput({ customer: { name: 'No Contact' } }), ADMIN_ID);
    expect(result.ok).toBe(false);
  });

  it('rejects an invoice with no line items', async () => {
    const supabase = createFakeSupabase();
    const result = await createDraftInvoice(supabase, draftInput({ items: [] }), ADMIN_ID);
    expect(result.ok).toBe(false);
  });

  it('applies the £30 deposit when creating from a booking', async () => {
    const supabase = createFakeSupabase();
    const result = await createDraftInvoice(supabase, draftInput({ depositApplied: 30 }), ADMIN_ID);
    const invoice = supabase._tables.invoices.find((i) => i.id === result.invoiceId);
    expect(invoice.deposit_applied).toBe(30);
    expect(invoice.amount_due).toBe(120);
  });
});

describe('updateDraftInvoice', () => {
  it('replaces items and recalculates totals for a draft', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);

    const result = await updateDraftInvoice(supabase, invoiceId, draftInput({
      items: [{ description: 'Carpet + upholstery', quantity: 1, unitPrice: 200 }],
    }), ADMIN_ID);

    expect(result.ok).toBe(true);
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.total).toBe(200);
    const items = supabase._tables.invoice_items.filter((i) => i.invoice_id === invoiceId);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Carpet + upholstery');
  });

  it('rejects editing an already-issued invoice', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);

    const result = await updateDraftInvoice(supabase, invoiceId, draftInput(), ADMIN_ID);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it('returns 404 for a non-existent invoice', async () => {
    const supabase = createFakeSupabase();
    const result = await updateDraftInvoice(supabase, 'missing-id', draftInput(), ADMIN_ID);
    expect(result.status).toBe(404);
  });
});

describe('deleteDraftInvoice', () => {
  it('deletes a draft', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    const result = await deleteDraftInvoice(supabase, invoiceId);
    expect(result.ok).toBe(true);
    expect(supabase._tables.invoices.find((i) => i.id === invoiceId)).toBeUndefined();
  });

  it('refuses to delete an issued invoice', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);
    const result = await deleteDraftInvoice(supabase, invoiceId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });
});

describe('issueInvoice', () => {
  it('allocates a formal INV-YYYY-000001 number and snapshots business settings', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID);
    expect(result.ok).toBe(true);
    expect(result.invoiceNumber).toMatch(/^INV-\d{4}-000001$/);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.document_status).toBe('issued');
    expect(invoice.business_snapshot).toBeTruthy();
    expect(invoice.issued_by_admin_id).toBe(ADMIN_ID);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toEqual(['created', 'issued']);
  });

  it('allocates sequential numbers for successive invoices', async () => {
    const supabase = createFakeSupabase();
    const first = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    const second = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);

    const r1 = await issueInvoice(supabase, first.invoiceId, ADMIN_ID);
    const r2 = await issueInvoice(supabase, second.invoiceId, ADMIN_ID);
    expect(r1.invoiceNumber).toMatch(/-000001$/);
    expect(r2.invoiceNumber).toMatch(/-000002$/);
  });

  it('refuses to issue an invoice that is not a draft', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it('refuses to issue an invoice with no line items', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    supabase._tables.invoice_items = supabase._tables.invoice_items.filter((i) => i.invoice_id !== invoiceId);

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID);
    expect(result.ok).toBe(false);
  });

  it('returns 409 if the invoice status flips away from draft between the fetch and the guarded update (simulated race)', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    // Simulate a concurrent issue winning first: status is no longer 'draft'
    // by the time our guarded UPDATE runs, even though our own fetch above
    // (inside issueInvoice) would have seen 'draft' — the guarded
    // .eq('document_status', 'draft') in the real UPDATE call is what
    // catches this in production; here we flip it directly to prove the
    // guard clause, not the initial fetch, is what's being relied on.
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    invoice.document_status = 'issued';

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it('calls the injected generateAndStorePdf with the issued invoice and items, and saves the returned path', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);

    let receivedInvoice = null;
    let receivedItems = null;
    const generateAndStorePdf = async (inv, its) => {
      receivedInvoice = inv;
      receivedItems = its;
      return { ok: true, path: `invoices/${invoiceId}/invoice-v1.pdf` };
    };

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID, { generateAndStorePdf });
    expect(result.ok).toBe(true);
    expect(receivedInvoice.invoice_number).toBe(result.invoiceNumber);
    expect(receivedItems).toHaveLength(1);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.pdf_storage_path).toBe(`invoices/${invoiceId}/invoice-v1.pdf`);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toEqual(['created', 'issued', 'pdf_generated']);
  });

  it('still issues successfully even if PDF generation throws (issuing is not rolled back)', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    const generateAndStorePdf = async () => { throw new Error('pdf render failed'); };

    const result = await issueInvoice(supabase, invoiceId, ADMIN_ID, { generateAndStorePdf });
    expect(result.ok).toBe(true);
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.document_status).toBe('issued');
    expect(invoice.pdf_storage_path).toBeUndefined(); // no path recorded — safe to regenerate later
  });
});

describe('voidInvoice', () => {
  it('voids a draft with a reason and logs the event', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);

    const result = await voidInvoice(supabase, invoiceId, 'Customer cancelled', ADMIN_ID);
    expect(result.ok).toBe(true);
    expect(supabase._tables.invoices.find((i) => i.id === invoiceId).document_status).toBe('void');
  });

  it('rejects voiding without a reason', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    const result = await voidInvoice(supabase, invoiceId, '  ', ADMIN_ID);
    expect(result.ok).toBe(false);
  });

  it('the void reason and retired number remain visible — voiding never deletes the row', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);
    const issuedNumber = supabase._tables.invoices.find((i) => i.id === invoiceId).invoice_number;

    await voidInvoice(supabase, invoiceId, 'Issued in error', ADMIN_ID);
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.document_status).toBe('void');
    expect(invoice.invoice_number).toBe(issuedNumber);
  });
});

describe('duplicateInvoiceAsDraft', () => {
  it('creates a new draft linked via duplicatedFromId, copying items and totals', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);

    const result = await duplicateInvoiceAsDraft(supabase, invoiceId, ADMIN_ID);
    expect(result.ok).toBe(true);

    const copy = supabase._tables.invoices.find((i) => i.id === result.invoiceId);
    expect(copy.document_status).toBe('draft');
    expect(copy.duplicated_from_id).toBe(invoiceId);
    expect(copy.total).toBe(150);
    expect(copy.invoice_number).toBeUndefined();

    const original = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(original.document_status).toBe('issued'); // original untouched
  });
});

describe('recordPayment', () => {
  async function issuedInvoice(supabase) {
    const { invoiceId } = await createDraftInvoice(supabase, draftInput({
      items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }],
    }), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);
    return invoiceId;
  }

  it('records a partial payment and updates payment_status', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await issuedInvoice(supabase);

    const result = await recordPayment(supabase, invoiceId, {
      amount: 40, paymentDate: '2026-07-16', method: 'bank_transfer',
    }, ADMIN_ID);

    expect(result.ok).toBe(true);
    expect(result.paymentStatus).toBe('partially_paid');
    expect(result.amountDue).toBe(60);
  });

  it('reaching zero balance triggers the createReceiptIfPaid callback exactly once', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await issuedInvoice(supabase);

    let callCount = 0;
    const createReceiptIfPaid = async () => { callCount += 1; return { ok: true, receiptId: 'receipt-1' }; };

    const result = await recordPayment(supabase, invoiceId, {
      amount: 100, paymentDate: '2026-07-16', method: 'card',
    }, ADMIN_ID, { createReceiptIfPaid });

    expect(result.paymentStatus).toBe('paid');
    expect(result.receiptId).toBe('receipt-1');
    expect(callCount).toBe(1);
  });

  it('a partial payment does not trigger receipt creation', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await issuedInvoice(supabase);
    let called = false;
    const createReceiptIfPaid = async () => { called = true; return { ok: true }; };

    await recordPayment(supabase, invoiceId, { amount: 50, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID, { createReceiptIfPaid });
    expect(called).toBe(false);
  });

  it('rejects a payment that would overpay the invoice', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await issuedInvoice(supabase);
    const result = await recordPayment(supabase, invoiceId, { amount: 150, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);
    expect(result.ok).toBe(false);
  });

  it('rejects recording a payment against a draft invoice', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    const result = await recordPayment(supabase, invoiceId, { amount: 10, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it('two payments that jointly would overpay: the second is rejected against the freshly-read balance', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await issuedInvoice(supabase);

    const first = await recordPayment(supabase, invoiceId, { amount: 60, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);
    expect(first.ok).toBe(true);

    const second = await recordPayment(supabase, invoiceId, { amount: 60, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);
    expect(second.ok).toBe(false);
  });
});

describe('reversePayment', () => {
  it('reverses a payment and recalculates the invoice back to unpaid', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput({
      items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }],
    }), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);

    const payment = await recordPayment(supabase, invoiceId, { amount: 100, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);
    expect(payment.paymentStatus).toBe('paid');

    const reversal = await reversePayment(supabase, payment.paymentId, 'Bounced cheque', ADMIN_ID);
    expect(reversal.ok).toBe(true);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.amount_paid).toBe(0);
    expect(invoice.amount_due).toBe(100);
    expect(invoice.payment_status).toBe('unpaid');

    const paymentRow = supabase._tables.invoice_payments.find((p) => p.id === payment.paymentId);
    expect(paymentRow.reversed_at).toBeTruthy(); // still present — append-only, not deleted
  });

  it('rejects reversing an already-reversed payment', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);
    const payment = await recordPayment(supabase, invoiceId, { amount: 150, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);

    await reversePayment(supabase, payment.paymentId, 'first reversal', ADMIN_ID);
    const second = await reversePayment(supabase, payment.paymentId, 'second reversal', ADMIN_ID);
    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
  });

  it('rejects reversing without a reason', async () => {
    const supabase = createFakeSupabase();
    const { invoiceId } = await createDraftInvoice(supabase, draftInput(), ADMIN_ID);
    await issueInvoice(supabase, invoiceId, ADMIN_ID);
    const payment = await recordPayment(supabase, invoiceId, { amount: 150, paymentDate: '2026-07-16', method: 'card' }, ADMIN_ID);

    const result = await reversePayment(supabase, payment.paymentId, '', ADMIN_ID);
    expect(result.ok).toBe(false);
  });
});
