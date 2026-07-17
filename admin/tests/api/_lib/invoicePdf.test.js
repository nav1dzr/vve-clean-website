import { describe, it, expect } from 'vitest';
import { generateInvoicePdfBuffer, generateReceiptPdfBuffer } from '../../../api/_lib/invoicePdf.js';
import { getBusinessSettings } from '../../../api/_lib/businessSettings.js';
import { extractPdfText } from './pdfTextExtract.js';

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

function pageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
}

describe('generateInvoicePdfBuffer', () => {
  it('produces a valid PDF (starts with the %PDF magic bytes)', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('fits a typical 1-3 item invoice on a single page (requirement: single-page layout)', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(pageCount(buffer)).toBe(1);
  });

  it('includes the invoice number for an issued invoice', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(extractPdfText(buffer)).toContain('INV-2026-000001');
  });

  it('includes a DRAFT watermark and status badge for a draft preview, and omits the formal number', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice({ invoice_number: null }), items(), settings, { isDraft: true });
    expect(extractPdfText(buffer)).toContain('DRAFT');
  });

  it('does not print DRAFT for an issued invoice, and shows the INVOICE status badge', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = extractPdfText(buffer);
    // "DRAFT" only ever appears as part of the watermark path or the
    // draft status badge — neither is drawn when isDraft is false.
    expect(text).not.toContain('DRAFT');
    expect(text).toContain('INVOICE');
  });

  it('prints line item amounts and the invoice total', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = extractPdfText(buffer);
    expect(text).toContain('150.00');
    expect(text).toContain('120.00'); // amount due
  });

  it('formats a deducted amount as "-£30.00", never the "&£30.00" mis-render or a U+2212 minus sign', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = extractPdfText(buffer);
    expect(text).toContain('-£30.00');
    expect(text).not.toContain('&£30.00');
    expect(text).not.toContain('−£30.00');
  });

  it('never prints a VAT row when vatEnabled is false (the default)', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(extractPdfText(buffer)).not.toContain('VAT');
  });

  it('prints a VAT row when vatEnabled is true', async () => {
    const vatSettings = { ...settings, vatEnabled: true, vatNumber: 'GB123456789' };
    const buffer = await generateInvoicePdfBuffer(invoice({ tax_total: 30, total: 180, amount_due: 150 }), items(), vatSettings, { isDraft: false });
    expect(extractPdfText(buffer)).toContain('VAT');
  });

  it('omits the payment-details block when no bank details are configured', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(extractPdfText(buffer)).not.toContain('Payment details');
  });

  it('includes the payment-details block when bank details are configured', async () => {
    const withBank = { ...settings, bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678' };
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), withBank, { isDraft: false });
    const text = extractPdfText(buffer);
    expect(text).toContain('Payment details');
    expect(text).toContain('12-34-56');
  });

  it('shows Invoice Number and Booking Reference (relabelled from PO reference) in the details block', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = extractPdfText(buffer);
    expect(text).toContain('Invoice Number');
    expect(text).toContain('Booking Reference');
    expect(text).toContain('N152NG160726');
    expect(text).not.toContain('PO reference');
    expect(text).not.toContain('PO Reference');
  });

  it('includes the footer company number and a thank-you line', async () => {
    const buffer = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    const text = extractPdfText(buffer);
    expect(text).toContain('Company No. 17234391');
    expect(text).toContain('Thank you for choosing VVE Clean.');
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
    const text = extractPdfText(buffer);
    expect(text).toMatch(/Page 1 of \d+/);
    expect(text).toContain('Page 2 of');
    expect(pageCount(buffer)).toBeGreaterThan(1);
  });

  it('safely renders unusual customer-controlled text (no crash, no markup interpretation)', async () => {
    const weirdInvoice = invoice({ customer_name: 'Jane <script>alert(1)</script> & "Bob" O\'Brien' });
    const buffer = await generateInvoicePdfBuffer(weirdInvoice, items(), settings, { isDraft: false });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('shows the Stripe payment link for stripe_payment_link, and no bank block, when no bank details are configured', async () => {
    const buffer = await generateInvoicePdfBuffer(
      invoice({ payment_option: 'stripe_payment_link', stripe_payment_link_url: 'https://buy.stripe.com/test_1' }),
      items(), settings, { isDraft: false },
    );
    const text = extractPdfText(buffer);
    expect(text).toContain('Pay securely by Stripe');
    expect(text).not.toContain('Bank transfer');
  });

  it('shows both bank details and the Stripe link for "both"', async () => {
    const withBank = { ...settings, bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678' };
    const buffer = await generateInvoicePdfBuffer(
      invoice({ payment_option: 'both', stripe_payment_link_url: 'https://buy.stripe.com/test_1' }),
      items(), withBank, { isDraft: false },
    );
    const text = extractPdfText(buffer);
    expect(text).toContain('Pay securely by Stripe');
    expect(text).toContain('12-34-56');
  });

  it('uses the frozen payment_instructions_snapshot when present, ignoring live settings', async () => {
    const buffer = await generateInvoicePdfBuffer(
      invoice({
        payment_option: 'bank_transfer',
        payment_instructions_snapshot: {
          paymentOption: 'bank_transfer',
          bankDetails: { accountName: 'Frozen Ltd', sortCode: '00-00-00', accountNumber: '00000000', referenceInstructions: null },
          stripePaymentLinkUrl: null,
        },
      }),
      items(),
      { ...settings, bankAccountName: 'Live Ltd', bankSortCode: '99-99-99', bankAccountNumber: '99999999' },
      { isDraft: false },
    );
    const text = extractPdfText(buffer);
    expect(text).toContain('00-00-00');
    expect(text).not.toContain('99-99-99');
  });

  it('renders a Service address block only when service contact fields are present, and never for billing-only invoices', async () => {
    const withoutService = await generateInvoicePdfBuffer(invoice(), items(), settings, { isDraft: false });
    expect(extractPdfText(withoutService)).not.toContain('Service address');

    const withService = await generateInvoicePdfBuffer(
      invoice({ service_contact_name: 'Tenant Name', service_address: '2 Flat Rd' }), items(), settings, { isDraft: false },
    );
    const text = extractPdfText(withService);
    expect(text).toContain('Service address');
    expect(text).toContain('Tenant Name');
    expect(text).toContain('2 Flat Rd');
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

  it('produces a valid single-page PDF with the receipt number and PAID IN FULL confirmation', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pageCount(buffer)).toBe(1);
    const text = extractPdfText(buffer);
    expect(text).toContain('REC-2026-000001');
    expect(text).toContain('PAID IN FULL');
  });

  it('includes the invoice reference and total paid', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    const text = extractPdfText(buffer);
    expect(text).toContain('INV-2026-000001');
    expect(text).toContain('150.00');
  });

  it('humanises the payment method for display ("bank_transfer" -> "Bank transfer") without altering the stored value', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt({ payment_method: 'bank_transfer' }), settings);
    const text = extractPdfText(buffer);
    expect(text).toContain('Bank transfer');
    expect(text).not.toContain('bank_transfer');
  });

  it('shows the RECEIPT status badge', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    expect(extractPdfText(buffer)).toContain('RECEIPT');
  });

  it('shows Booking Reference and Deposit when the caller has merged them in from the linked invoice', async () => {
    const buffer = await generateReceiptPdfBuffer(
      receipt({ invoice_total: 340, total_paid: 310, booking_ref_snapshot: 'N152NG160726', deposit_applied: 30 }),
      settings,
    );
    const text = extractPdfText(buffer);
    expect(text).toContain('Booking Reference');
    expect(text).toContain('N152NG160726');
    expect(text).toContain('-£30.00');
    expect(text).toContain('Final balance: £0.00');
  });

  it('omits Booking Reference and Deposit when the linked invoice could not be loaded (invoice deleted, extras never merged)', async () => {
    const buffer = await generateReceiptPdfBuffer(receipt(), settings);
    expect(extractPdfText(buffer)).not.toContain('Booking Reference');
  });
});
