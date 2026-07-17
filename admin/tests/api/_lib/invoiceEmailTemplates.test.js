import { describe, it, expect } from 'vitest';
import { invoiceEmail, receiptEmail } from '../../../api/_lib/invoiceEmailTemplates.js';
import { getBusinessSettings } from '../../../api/_lib/businessSettings.js';

const settings = getBusinessSettings();

function invoice(overrides = {}) {
  return {
    invoice_number: 'INV-2026-000001',
    customer_name: 'Jane Doe',
    booking_ref_snapshot: 'N152NG160726',
    total: 150,
    amount_due: 120,
    due_date: '2026-07-30',
    payment_terms: 'Payment due within 14 days.',
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    receipt_number: 'REC-2026-000001',
    customer_name: 'Jane Doe',
    invoice_number_snapshot: 'INV-2026-000001',
    total_paid: 150,
    payment_date: '2026-07-16',
    ...overrides,
  };
}

describe('invoiceEmail', () => {
  it('includes the invoice number, total, amount due, and due date in both html and text', () => {
    const { subject, html, text } = invoiceEmail(invoice(), settings);
    expect(subject).toContain('INV-2026-000001');
    expect(html).toContain('INV-2026-000001');
    expect(html).toContain('£150.00');
    expect(html).toContain('£120.00');
    expect(text).toContain('INV-2026-000001');
    expect(text).toContain('£150.00');
  });

  it('always produces a non-empty plain-text alternative alongside the html', () => {
    const { html, text } = invoiceEmail(invoice(), settings);
    expect(html.length).toBeGreaterThan(0);
    expect(text.length).toBeGreaterThan(0);
  });

  it('HTML-escapes a malicious customer name (stored HTML injection)', () => {
    const { html } = invoiceEmail(invoice({ customer_name: '<img src=x onerror=alert(1)>' }), settings);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('HTML-escapes an admin-entered custom message', () => {
    const { html } = invoiceEmail(invoice(), settings, { customMessage: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes the custom message verbatim (escaped) in both html and text when provided', () => {
    const { html, text } = invoiceEmail(invoice(), settings, { customMessage: 'Thanks for booking with us!' });
    expect(html).toContain('Thanks for booking with us!');
    expect(text).toContain('Thanks for booking with us!');
  });

  it('omits the custom message block entirely when none is provided', () => {
    const { html } = invoiceEmail(invoice(), settings);
    // No stray empty <p></p> from an unset customMessage.
    expect(html).not.toMatch(/<p><\/p>/);
  });

  it('shows a "Pay securely by Stripe" link for stripe_payment_link and no bank block when unconfigured', () => {
    const { html, text } = invoiceEmail(invoice({ payment_option: 'stripe_payment_link', stripe_payment_link_url: 'https://buy.stripe.com/test_1' }), settings);
    expect(html).toContain('Pay securely by Stripe');
    expect(html).toContain('https://buy.stripe.com/test_1');
    expect(html).not.toContain('Bank transfer');
    expect(text).toContain('Pay by card (Stripe)');
    expect(text).toContain('https://buy.stripe.com/test_1');
  });

  it('shows bank details (and escapes reference instructions) for bank_transfer when configured', () => {
    const withBank = {
      ...settings, bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678',
      bankReferenceInstructions: 'Use <b>your</b> invoice number as reference',
    };
    const { html, text } = invoiceEmail(invoice({ payment_option: 'bank_transfer' }), withBank);
    expect(html).toContain('12-34-56');
    expect(html).toContain('&lt;b&gt;your&lt;/b&gt;');
    expect(html).not.toContain('<b>your</b>');
    expect(text).toContain('12-34-56');
  });

  it('omits all payment instructions when bank_transfer is chosen but no bank details are configured', () => {
    const { html } = invoiceEmail(invoice({ payment_option: 'bank_transfer' }), settings);
    expect(html).not.toContain('Bank transfer');
    expect(html).not.toContain('Pay securely by Stripe');
  });

  it('uses the frozen payment_instructions_snapshot when present, ignoring live settings', () => {
    const frozenInvoice = invoice({
      payment_option: 'bank_transfer',
      payment_instructions_snapshot: {
        paymentOption: 'bank_transfer',
        bankDetails: { accountName: 'Frozen Ltd', sortCode: '00-00-00', accountNumber: '00000000', referenceInstructions: null },
        stripePaymentLinkUrl: null,
      },
    });
    const liveSettings = { ...settings, bankAccountName: 'Live Ltd', bankSortCode: '99-99-99', bankAccountNumber: '99999999' };
    const { html } = invoiceEmail(frozenInvoice, liveSettings);
    expect(html).toContain('00-00-00');
    expect(html).not.toContain('99-99-99');
  });
});

describe('receiptEmail', () => {
  it('includes the receipt number, invoice reference, and paid-in-full confirmation', () => {
    const { subject, html, text } = receiptEmail(receipt(), settings);
    expect(subject).toContain('REC-2026-000001');
    expect(html).toContain('REC-2026-000001');
    expect(html).toContain('INV-2026-000001');
    expect(html).toContain('Paid in full');
    expect(text).toContain('Paid in full');
  });

  it('HTML-escapes a malicious customer name', () => {
    const { html } = receiptEmail(receipt({ customer_name: 'Jane "Bob" <script>alert(1)</script>' }), settings);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes the amount received and payment date', () => {
    const { html } = receiptEmail(receipt(), settings);
    expect(html).toContain('£150.00');
    expect(html).toContain('2026-07-16');
  });
});
