import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  createDraftInvoice,
  issueInvoice,
  correctIssuedInvoiceDetails,
  recordPayment,
} from '../../../api/_lib/invoiceLifecycle.js';

const ADMIN_ID = 'admin-1';

async function seedIssued(supabase) {
  const created = await createDraftInvoice(supabase, {
    customer: {
      name: 'Jane Doe', email: 'jane@example.com', phone: '07123456789',
      address: '1 Old Road\nLondon', postcode: 'E1 1AA',
    },
    items: [{ description: 'End of tenancy clean', quantity: 1, unitPrice: 259 }],
    depositApplied: 30,
  }, ADMIN_ID);
  await issueInvoice(supabase, created.invoiceId, ADMIN_ID);
  return created.invoiceId;
}

function correctedInput(overrides = {}) {
  return {
    customer: {
      name: 'Jane Doe', email: 'jane@example.co.uk', phone: '07123456789',
      address: '1 New Road\nLondon', postcode: 'E1 1AB',
    },
    serviceContact: {},
    invoiceRecipientEmail: 'accounts@example.co.uk',
    receiptRecipientEmail: '',
    ...overrides,
  };
}

describe('correctIssuedInvoiceDetails', () => {
  it('updates only contact details, keeps financial values and number, versions the PDF, and logs changed field names', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await seedIssued(supabase);
    const before = { ...supabase._tables.invoices.find((row) => row.id === invoiceId) };
    const generateAndStorePdf = vi.fn(async (invoice) => ({
      ok: true,
      path: `invoices/${invoice.id}/invoice-v${invoice.document_version}.pdf`,
    }));

    const result = await correctIssuedInvoiceDetails(
      supabase, invoiceId,
      { ...correctedInput(), total: 1, depositApplied: 259, items: [] },
      ADMIN_ID,
      { generateAndStorePdf },
    );

    expect(result).toEqual({ ok: true, documentVersion: 2 });
    const after = supabase._tables.invoices.find((row) => row.id === invoiceId);
    expect(after.invoice_number).toBe(before.invoice_number);
    expect(after.total).toBe(before.total);
    expect(after.deposit_applied).toBe(before.deposit_applied);
    expect(after.customer_email).toBe('jane@example.co.uk');
    expect(after.customer_address).toBe('1 New Road\nLondon');
    expect(after.document_version).toBe(2);
    expect(after.pdf_storage_path).toBe(`invoices/${invoiceId}/invoice-v2.pdf`);
    expect(generateAndStorePdf).toHaveBeenCalledOnce();

    const event = supabase._tables.invoice_events.find((row) => row.event_type === 'details_corrected');
    expect(event.metadata.version).toBe(2);
    expect(event.metadata.changedFields).toContain('customer_email');
    expect(JSON.stringify(event.metadata)).not.toContain('jane@example.co.uk');
  });

  it('rejects invalid email without changing the invoice', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await seedIssued(supabase);
    const result = await correctIssuedInvoiceDetails(
      supabase, invoiceId, correctedInput({ customer: { name: 'Jane Doe', email: 'wrong' } }), ADMIN_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid email/i);
    expect(supabase._tables.invoices.find((row) => row.id === invoiceId).document_version).toBeUndefined();
  });

  it('rejects draft, paid, and superseded invoices', async () => {
    const draftDb = createFakeSupabase();
    const draft = await createDraftInvoice(draftDb, {
      customer: { name: 'Jane', email: 'jane@example.com' },
      items: [{ description: 'Clean', quantity: 1, unitPrice: 100 }],
    }, ADMIN_ID);
    expect((await correctIssuedInvoiceDetails(draftDb, draft.invoiceId, correctedInput(), ADMIN_ID)).status).toBe(409);

    const paidDb = createFakeSupabase();
    const paidId = await seedIssued(paidDb);
    await recordPayment(paidDb, paidId, { amount: 10, paymentDate: '2026-08-06', method: 'card' }, ADMIN_ID);
    expect((await correctIssuedInvoiceDetails(paidDb, paidId, correctedInput(), ADMIN_ID)).status).toBe(409);

    const supersededDb = createFakeSupabase();
    const supersededId = await seedIssued(supersededDb);
    supersededDb._tables.invoices.find((row) => row.id === supersededId).superseded_by_invoice_id = 'replacement';
    expect((await correctIssuedInvoiceDetails(supersededDb, supersededId, correctedInput(), ADMIN_ID)).status).toBe(409);
  });

  it('keeps the saved correction recoverable when PDF regeneration fails', async () => {
    const supabase = createFakeSupabase();
    const invoiceId = await seedIssued(supabase);
    const result = await correctIssuedInvoiceDetails(
      supabase, invoiceId, correctedInput(), ADMIN_ID,
      { generateAndStorePdf: async () => { throw new Error('storage down'); } },
    );
    expect(result.ok).toBe(true);
    const invoice = supabase._tables.invoices.find((row) => row.id === invoiceId);
    expect(invoice.customer_email).toBe('jane@example.co.uk');
    expect(invoice.document_version).toBe(2);
    expect(invoice.pdf_storage_path).toBeNull();
  });
});
