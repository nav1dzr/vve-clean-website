import { describe, it, expect } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { createReceiptIfPaid, markReceiptSent } from '../../../api/_lib/receiptLifecycle.js';

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
