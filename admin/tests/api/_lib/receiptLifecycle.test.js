import { afterEach, describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  createReceiptIfPaid, createStandaloneReceipt, markReceiptSent, loadReceiptPdfExtras,
} from '../../../api/_lib/receiptLifecycle.js';

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

describe('createStandaloneReceipt', () => {
  function standaloneInput(overrides = {}) {
    return {
      customer: { name: 'Walk In Customer', email: 'walkin@example.com', address: '8 Kellett House', postcode: 'W2 3EL' },
      serviceDescription: 'Professional carpet steam cleaning',
      amount: 149,
      paymentDate: '2026-08-06',
      paymentMethod: 'card',
      paymentReference: 'POS-4821',
      ...overrides,
    };
  }

  afterEach(() => { vi.useRealTimers(); });

  it.each([
    ['2026-07-01T23:30:00Z', '2026-07-03'],
    ['2026-12-01T23:30:00Z', '2026-12-02'],
  ])('rejects a future payment date before writes at %s', async (now, paymentDate) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    const supabase = createFakeSupabase();
    const allocate = vi.spyOn(supabase, 'rpc');
    const generateAndStorePdf = vi.fn();
    const result = await createStandaloneReceipt(supabase, standaloneInput({ paymentDate }), ADMIN_ID, { generateAndStorePdf });
    expect(result).toMatchObject({ ok: false, error: 'Payment date cannot be in the future (London time).' });
    expect(allocate).not.toHaveBeenCalled();
    expect(supabase._tables.receipts ?? []).toHaveLength(0);
    expect(supabase._tables.invoice_events ?? []).toHaveLength(0);
    expect(generateAndStorePdf).not.toHaveBeenCalled();
  });

  it('accepts the current London date after summer midnight even while UTC is yesterday', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T23:30:00Z'));
    const supabase = createFakeSupabase();
    const result = await createStandaloneReceipt(supabase, standaloneInput({ paymentDate: '2026-07-02' }), ADMIN_ID);
    expect(result.ok).toBe(true);
    expect(supabase._tables.receipts[0].payment_date).toBe('2026-07-02');
  });

  it('recovers an already-saved exact request without rewriting an existing receipt date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const supabase = createFakeSupabase();
    const input = standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b', paymentDate: '2026-10-19' });
    const first = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    // Represents an existing receipt created before the future-date guard.
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const allocate = vi.spyOn(supabase, 'rpc');
    const replay = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    expect(replay).toMatchObject({ ok: true, alreadyExisted: true, receiptId: first.receiptId });
    expect(allocate).not.toHaveBeenCalled();
    expect(supabase._tables.receipts).toHaveLength(1);
    expect(supabase._tables.receipts[0].payment_date).toBe('2026-10-19');
  });

  it('returns the original receipt when the same request is retried after a lost response', async () => {
    const supabase = createFakeSupabase();
    const input = standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b' });
    const first = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    const retry = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    expect(retry).toMatchObject({ ok: true, receiptId: first.receiptId, alreadyExisted: true });
    expect(supabase._tables.receipts).toHaveLength(1);
    expect(supabase._tables.invoice_events.filter(e => e.event_type === 'receipt_created')).toHaveLength(1);
  });

  it('preserves a retryable failure when the database commits an insert but its response is lost', async () => {
    const supabase = createFakeSupabase();
    const from = supabase.from.bind(supabase);
    let loseInsertResponse = true;
    supabase.from = (table) => {
      const builder = from(table);
      if (table === 'receipts' && loseInsertResponse) {
        const insert = builder.insert.bind(builder);
        builder.insert = (...args) => {
          insert(...args);
          const single = builder.single.bind(builder);
          builder.single = async () => {
            await single(); // Commit the real fake-store row before losing the result.
            loseInsertResponse = false;
            return { data: null, error: { code: 'NETWORK_ERROR', message: 'Insert response lost after commit' } };
          };
          return builder;
        };
      }
      return builder;
    };
    const input = standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b' });
    const first = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    expect(first).toMatchObject({ ok: false, status: 503 });
    expect(supabase._tables.receipts).toHaveLength(1);
    const retry = await createStandaloneReceipt(supabase, input, ADMIN_ID);
    expect(retry).toMatchObject({ ok: true, receiptId: input.requestId, alreadyExisted: true });
    expect(supabase._tables.receipts).toHaveLength(1);
  });

  it('treats receipt-number allocation errors as retryable server failures', async () => {
    const supabase = createFakeSupabase();
    supabase.rpc = async () => ({ data: null, error: { code: 'NETWORK_ERROR', message: 'Unavailable' } });
    const result = await createStandaloneReceipt(supabase, standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b' }), ADMIN_ID);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(supabase._tables.receipts).toHaveLength(0);
  });

  it('rejects changed details or another owner reusing an existing request identity', async () => {
    const supabase = createFakeSupabase();
    const input = standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b' });
    await createStandaloneReceipt(supabase, input, ADMIN_ID);
    expect(await createStandaloneReceipt(supabase, { ...input, amount: 200 }, ADMIN_ID)).toMatchObject({ ok: false, status: 409 });
    expect(await createStandaloneReceipt(supabase, input, 'another-admin')).toMatchObject({ ok: false, status: 409 });
    expect(supabase._tables.receipts).toHaveLength(1);
    expect(supabase._tables.receipts[0].total_paid).toBe(149);
  });

  it('allows genuinely separate equal-value receipts and rejects malformed request identities', async () => {
    const supabase = createFakeSupabase();
    const first = await createStandaloneReceipt(supabase, standaloneInput({ requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b' }), ADMIN_ID);
    const second = await createStandaloneReceipt(supabase, standaloneInput({ requestId: 'c9d79e31-acd0-4c95-a6f6-c261df222fe2' }), ADMIN_ID);
    expect(first.receiptId).not.toBe(second.receiptId);
    expect(await createStandaloneReceipt(supabase, standaloneInput({ requestId: 'invalid' }), ADMIN_ID)).toMatchObject({ ok: false });
    expect(supabase._tables.receipts).toHaveLength(2);
  });

  it('creates an immutable numbered receipt without an invoice', async () => {
    const supabase = createFakeSupabase();
    const result = await createStandaloneReceipt(supabase, standaloneInput(), ADMIN_ID);

    expect(result.ok).toBe(true);
    expect(result.receiptNumber).toMatch(/^REC-\d{4}-000001$/);
    const receipt = supabase._tables.receipts.find((r) => r.id === result.receiptId);
    expect(receipt.source).toBe('standalone');
    expect(receipt.invoice_id).toBeNull();
    expect(receipt.service_description).toBe('Professional carpet steam cleaning');
    expect(receipt.invoice_total).toBe(149);
    expect(receipt.total_paid).toBe(149);
  });

  it('validates the customer, service, amount, date, and method before allocating a number', async () => {
    const cases = [
      standaloneInput({ customer: { name: '', email: 'x@example.com' } }),
      standaloneInput({ serviceDescription: '' }),
      standaloneInput({ amount: 0 }),
      standaloneInput({ paymentDate: 'tomorrow' }),
      standaloneInput({ paymentMethod: 'crypto' }),
    ];

    for (const input of cases) {
      const supabase = createFakeSupabase();
      const result = await createStandaloneReceipt(supabase, input, ADMIN_ID);
      expect(result.ok).toBe(false);
      expect(supabase._tables.receipts ?? []).toHaveLength(0);
    }
  });

  it('generates and stores a PDF while keeping the receipt valid if rendering fails', async () => {
    const supabase = createFakeSupabase();
    let received = null;
    const success = await createStandaloneReceipt(supabase, standaloneInput(), ADMIN_ID, {
      generateAndStorePdf: async (receipt) => {
        received = receipt;
        return { ok: true, path: `receipts/${receipt.id}/receipt-v1.pdf` };
      },
    });
    expect(received.source).toBe('standalone');
    expect(supabase._tables.receipts.find((r) => r.id === success.receiptId).pdf_storage_path).toBeTruthy();

    const failed = await createStandaloneReceipt(createFakeSupabase(), standaloneInput(), ADMIN_ID, {
      generateAndStorePdf: async () => { throw new Error('render failed'); },
    });
    expect(failed.ok).toBe(true);
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
  it('uses the issued invoice service address, date, public notes and ordered item list', async () => {
    const supabase = createFakeSupabase({
      invoices: [{ id: 'invoice-1', service_date: '2026-09-30', service_address: 'Service property', customer_address: 'Agency billing office', customer_notes: 'Oven cleaned', internal_notes: 'Private note' }],
      invoice_items: [{ invoice_id: 'invoice-1', description: 'Kitchen', quantity: 1, sort_order: 1 }, { invoice_id: 'other', description: 'Do not include', quantity: 1, sort_order: 0 }],
    });
    const extras = await loadReceiptPdfExtras(supabase, 'invoice-1');
    expect(extras).toMatchObject({ service_address: 'Service property', service_date: '2026-09-30', customer_notes: 'Oven cleaned' });
    expect(extras.service_items).toHaveLength(1);
    expect(extras).not.toHaveProperty('internal_notes');
  });
  it('returns booking_ref_snapshot and deposit_applied from the linked invoice', async () => {
    const supabase = createFakeSupabase({
      invoices: [{ id: 'invoice-1', booking_ref_snapshot: 'N152NG160726', deposit_applied: 30 }],
    });
    const extras = await loadReceiptPdfExtras(supabase, 'invoice-1');
    expect(extras).toMatchObject({ booking_ref_snapshot: 'N152NG160726', deposit_applied: 30, service_items: [] });
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
