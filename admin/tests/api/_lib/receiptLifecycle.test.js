import { describe, it, expect } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { createReceiptIfPaid, markReceiptSent, loadReceiptPdfExtras } from '../../../api/_lib/receiptLifecycle.js';

const ADMIN_ID = 'admin-1';

function receiptInput(overrides = {}) {
  return {
    invoiceId: 'invoice-1',
    bookingId: 'booking-1',
    customer: { name: 'Jane Doe', email: 'jane@example.com' },
    invoiceTotal: 150,
    totalPaid: 150,
    paymentDate: '2026-07-16',
    paymentMethod: 'card',
    ...overrides,
  };
}

describe('createReceiptIfPaid', () => {
  it('allocates a REC-YYYY-000001 number and creates the receipt', async () => {
    const supabase = createFakeSupabase();
    const result = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID);

    expect(result.ok).toBe(true);
    expect(result.receiptNumber).toMatch(/^REC-\d{4}-000001$/);

    const receipt = supabase._tables.receipts.find((r) => r.id === result.receiptId);
    expect(receipt.invoice_id).toBe('invoice-1');
    expect(receipt.total_paid).toBe(150);
    expect(receipt.business_snapshot).toBeTruthy();
  });

  it('logs a receipt_created event on both the receipt and the originating invoice', async () => {
    const supabase = createFakeSupabase();
    const result = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID);

    const receiptEvents = supabase._tables.invoice_events.filter(
      (e) => e.document_type === 'receipt' && e.document_id === result.receiptId,
    );
    const invoiceEvents = supabase._tables.invoice_events.filter(
      (e) => e.document_type === 'invoice' && e.document_id === 'invoice-1',
    );
    expect(receiptEvents.map((e) => e.event_type)).toEqual(['receipt_created']);
    expect(invoiceEvents.map((e) => e.event_type)).toEqual(['receipt_created']);
  });

  it('is idempotent — calling twice for the same invoice returns the same receipt, not a duplicate', async () => {
    const supabase = createFakeSupabase();
    const first = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID);
    const second = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID);

    expect(second.receiptId).toBe(first.receiptId);
    expect(second.alreadyExisted).toBe(true);
    expect(supabase._tables.receipts.filter((r) => r.invoice_id === 'invoice-1')).toHaveLength(1);
  });

  it('calls the injected generateAndStorePdf and saves the returned path', async () => {
    const supabase = createFakeSupabase();
    let received = null;
    const generateAndStorePdf = async (receipt) => { received = receipt; return { ok: true, path: `receipts/${receipt.id}/receipt-v1.pdf` }; };

    const result = await createReceiptIfPaid(supabase, receiptInput({ invoiceNumber: 'INV-2026-000001' }), ADMIN_ID, { generateAndStorePdf });
    expect(received.receipt_number).toBe(result.receiptNumber);
    expect(received.invoice_number_snapshot).toBe('INV-2026-000001');

    const receipt = supabase._tables.receipts.find((r) => r.id === result.receiptId);
    expect(receipt.pdf_storage_path).toBe(`receipts/${result.receiptId}/receipt-v1.pdf`);
  });

  it('still creates the receipt even if PDF generation throws', async () => {
    const supabase = createFakeSupabase();
    const generateAndStorePdf = async () => { throw new Error('pdf render failed'); };
    const result = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID, { generateAndStorePdf });
    expect(result.ok).toBe(true);
  });

  it('allocates independent, sequential numbers per invoice', async () => {
    const supabase = createFakeSupabase();
    const r1 = await createReceiptIfPaid(supabase, receiptInput({ invoiceId: 'invoice-1' }), ADMIN_ID);
    const r2 = await createReceiptIfPaid(supabase, receiptInput({ invoiceId: 'invoice-2' }), ADMIN_ID);
    expect(r1.receiptNumber).toMatch(/-000001$/);
    expect(r2.receiptNumber).toMatch(/-000002$/);
  });
});

describe('markReceiptSent', () => {
  it('sets sent_at on the receipt', async () => {
    const supabase = createFakeSupabase();
    const { receiptId } = await createReceiptIfPaid(supabase, receiptInput(), ADMIN_ID);

    const result = await markReceiptSent(supabase, receiptId);
    expect(result.ok).toBe(true);
    expect(supabase._tables.receipts.find((r) => r.id === receiptId).sent_at).toBeTruthy();
  });
});

// loadReceiptPdfExtras reads booking_ref_snapshot/deposit_applied live from
// the linked invoice at PDF-render time rather than storing them on
// receipts (no new columns — see the function's own header comment and
// admin/INVOICES_TESTING.md's visual-polish requirement 12).
describe('loadReceiptPdfExtras', () => {
  it('returns booking_ref_snapshot and deposit_applied from the linked invoice', async () => {
    const supabase = createFakeSupabase({
      invoices: [{ id: 'invoice-1', booking_ref_snapshot: 'N152NG160726', deposit_applied: 30 }],
    });
    const extras = await loadReceiptPdfExtras(supabase, 'invoice-1');
    expect(extras).toEqual({ booking_ref_snapshot: 'N152NG160726', deposit_applied: 30 });
  });

  it('returns an empty object when invoiceId is falsy, without querying', async () => {
    const supabase = createFakeSupabase();
    expect(await loadReceiptPdfExtras(supabase, null)).toEqual({});
    expect(supabase._tables.invoices ?? []).toHaveLength(0);
  });

  it('returns an empty object when the linked invoice no longer exists (deleted, FK set null)', async () => {
    const supabase = createFakeSupabase({ invoices: [] });
    const extras = await loadReceiptPdfExtras(supabase, 'missing-invoice');
    expect(extras).toEqual({});
  });
});
