import { describe, it, expect } from 'vitest';
import { generateInvoicePdfBuffer, generateReceiptPdfBuffer } from '../../../api/_lib/invoicePdf.js';
import { getBusinessSettings } from '../../../api/_lib/businessSettings.js';

// Compression is deliberately disabled in invoicePdf.js so these tests can
// assert on the PDF's actual drawn text without a separate PDF-parsing
// dependency — see the compress:false comment there. pdfkit still doesn't
// emit drawn text as one plain literal per .text() call, though: each run
// is a `TJ` operator with the text split into one or more hex-encoded
// glyph strings interleaved with numeric kerning-adjustment values, e.g.
// `[<494e56> 80 <2d323032362d303030303031> 0] TJ` for "INV-2026-000001".
// This extracts every hex token in the document (in order) and decodes
// each one, then concatenates them — kerning only adjusts spacing, it
// never reorders or drops characters, so this reconstructs the original
// drawn text (interleaved with decoded bytes from a handful of unrelated
// hex blobs elsewhere in the PDF structure, which is fine for a substring
// "contains" check).
function asText(buffer) {
  const raw = buffer.toString('latin1');
  const hexTokens = raw.match(/<([0-9a-fA-F]+)>/g) || [];
  return hexTokens.map((token) => Buffer.from(token.slice(1, -1), 'hex').toString('latin1')).join('');
}

const settings = getBusinessSettings();

function invoice(overrides = {}) {
  return {
    id: 'inv-1',
    invoice_number: 'INV-2026-000001',
    customer_name: 'Jane Doe',
    customer_email: 'jane@example.com',
    customer_phone: '07700 900000',
    customer_address: '1 Test Street',
    customer_postcode: 'N15 2NG',
    po_reference: null,
    issue_date: '2026-07-16',
    due_date: '2026-07-30',
    service_date: '2026-07-20',
    booking_ref_snapshot: 'N152NG160726',
    subtotal: 150,
    document_discount: 0,
    tax_total: 0,
    total: 150,
    deposit_applied: 30,
    amount_paid: 0,
    amount_due: 120,
    payment_terms: 'Payment due within 14 days.',
    customer_notes: null,
    ...overrides,
  };
}

function items(overrides) {
  return overrides || [{ description: 'End of tenancy clean', quantity: 1, unit_price: 150, line_discount: 0, line_total: 150 }];
}

describe('generateInvoicePdfBuffer', () => {
  it('produces a valid PDF (starts with the %PDF magic bytes)', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('includes the invoice number for an issued invoice', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(asText(buffer)).toContain('INV-2026-000001');
  });

  it('includes a DRAFT watermark for a draft preview and omits the formal number', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice({ invoice_number: null }), items(), settings, { isDraft: true });
    expect(asText(buffer)).toContain('DRAFT');
  });

  it('does not print DRAFT for an issued invoice', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    // "DRAFT" only ever appears as part of the watermark path or the
    // "INVOICE (DRAFT)" title — neither is drawn when isDraft is false.
    expect(asText(buffer)).not.toContain('DRAFT');
  });

  it('prints line item amounts and the invoice total', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = asText(buffer);
    expect(text).toContain('150.00');
    expect(text).toContain('120.00'); // amount due
  });

  it('never prints a VAT row when vatEnabled is false (the default)', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(asText(buffer)).not.toContain('VAT');
  });

  it('prints a VAT row when vatEnabled is true', async () => {
    const vatSettings = { ...settings, vatEnabled: true, vatNumber: 'GB123456789' };
    const buffer = await generateInvoicePdfBuffer(invoice({ tax_total: 30, total: 180, amount_due: 150 }), items(), vatSettings, { isDraft: false });
    expect(asText(buffer)).toContain('VAT');
  });

  it('omits the payment-details block when no bank details are configured', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(asText(buffer)).not.toContain('Payment details');
  });

  it('includes the payment-details block when bank details are configured', async () => {
    const withBank = { ...settings, bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678' };
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), withBank, { isDraft: false });
    expect(asText(buffer)).toContain('Payment details');
    expect(asText(buffer)).toContain('12-34-56');
  });

  it('handles a long item list by flowing onto additional pages without throwing', async () => {
    const manyItems = Array.from({ length: 60 }, (_, i) => ({
      description: `Line item number ${i + 1} with a moderately long description to force wrapping`,
      quantity: 1, unit_price: 10, line_discount: 0, line_total: 10,
    }));
    const buffer = await generateInvoicePdfBuffer(
      invoice({ subtotal: 600, total: 600, amount_due: 600 }), manyItems, settings, { isDraft: false },
    );
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(asText(buffer)).toMatch(/Page 1 of \d+/);
    expect(asText(buffer)).toContain('Page 2 of');
  });

  it('safely renders unusual customer-controlled text (no crash, no markup interpretation)', async () => {
    const weirdInvoice = invoice({ customer_name: 'Jane <script>alert(1)</script> & "Bob" O\'Brien' });
    const buffer = await generateInvoicePdfBuffer(weirdInvoice, items(), settings, { isDraft: false });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

describe('generateReceiptPdfBuffer', () => {
  function receipt(overrides = {}) {
    return {
      id: 'rec-1',
      receipt_number: 'REC-2026-000001',
      invoice_id: 'inv-1',
      invoice_number_snapshot: 'INV-2026-000001',
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      customer_phone: null,
      customer_address: null,
      customer_postcode: null,
      invoice_total: 150,
      total_paid: 150,
      payment_date: '2026-07-16',
      payment_method: 'card',
      payment_reference: null,
      ...overrides,
    };
  }

  it('produces a valid PDF with the receipt number and PAID IN FULL confirmation', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const text = asText(buffer);
    expect(text).toContain('REC-2026-000001');
    expect(text).toContain('PAID IN FULL');
  });

  it('includes the invoice reference and total paid', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    const text = asText(buffer);
    expect(text).toContain('INV-2026-000001');
    expect(text).toContain('150.00');
  });

  it('includes the payment method', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt({ payment_method: 'bank_transfer' }), settings);
    expect(asText(buffer)).toContain('bank_transfer');
  });
});
