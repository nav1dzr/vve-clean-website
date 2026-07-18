import { describe, it, expect } from 'vitest';
import {
  invoiceEmail, receiptEmail, paymentAcknowledgementEmail, paymentReminderEmail,
} from '../../../api/_lib/invoiceEmailTemplates.js';
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

  it('mentions the service in one line, derived from the first line item, when items are given', () => {
    const items = [{ description: 'End of tenancy deep clean' }];
    const { html, text } = invoiceEmail(invoice(), settings, { items });
    expect(html).toContain('Please find your invoice attached for your End of tenancy deep clean.');
    expect(text).toContain('Please find your invoice attached for your End of tenancy deep clean.');
  });

  it('summarises multiple items as "first item (+N more)"', () => {
    const items = [{ description: 'Carpet cleaning' }, { description: 'Oven clean' }, { description: 'Window clean' }];
    const { html } = invoiceEmail(invoice(), settings, { items });
    expect(html).toContain('Carpet cleaning (+2 more)');
  });

  it('falls back to a booking-ref mention when no items are given, never inventing a service', () => {
    const { html } = invoiceEmail(invoice(), settings);
    expect(html).toContain('Please find your invoice attached for booking N152NG160726.');
  });

  it('shows a "Deposit paid" row only when a deposit was applied', () => {
    const withDeposit = invoiceEmail(invoice({ deposit_applied: 30 }), settings).html;
    expect(withDeposit).toContain('Deposit paid');
    expect(withDeposit).toContain('-£30.00');

    const withoutDeposit = invoiceEmail(invoice({ deposit_applied: 0 }), settings).html;
    expect(withoutDeposit).not.toContain('Deposit paid');
  });

  it('always shows the invoice number in the body, not just the subject', () => {
    const { html, text } = invoiceEmail(invoice(), settings);
    expect(html).toContain('Invoice number');
    expect(html).toContain('INV-2026-000001');
    expect(text).toContain('INV-2026-000001');
  });

  it('title-cases an all-lowercase customer name in the greeting, without altering the passed-in row', () => {
    const row = invoice({ customer_name: 'ali' });
    const { html, text } = invoiceEmail(row, settings);
    expect(html).toContain('Hi Ali,');
    expect(text).toContain('Hi Ali,');
    expect(row.customer_name).toBe('ali');
  });

  it('preserves a deliberately mixed-case customer name in the greeting', () => {
    const { html, text } = invoiceEmail(invoice({ customer_name: 'McDonald' }), settings);
    expect(html).toContain('Hi McDonald,');
    expect(text).toContain('Hi McDonald,');
  });
});

describe('paymentAcknowledgementEmail', () => {
  function payment(overrides = {}) {
    return { amount: 30, ...overrides };
  }

  it('states the amount received and the remaining balance', () => {
    const { subject, html, text } = paymentAcknowledgementEmail(invoice({ amount_due: 90 }), payment(), settings);
    expect(subject).toContain('INV-2026-000001');
    expect(html).toContain('Thank you for your payment of');
    expect(html).toContain('£30.00');
    expect(html).toContain('£90.00');
    expect(text).toContain('£30.00');
    expect(text).toContain('£90.00');
  });

  it('never mentions "paid in full" — this is a partial-payment email, not a receipt', () => {
    const { html, text } = paymentAcknowledgementEmail(invoice({ amount_due: 90 }), payment(), settings);
    expect(html.toLowerCase()).not.toContain('paid in full');
    expect(text.toLowerCase()).not.toContain('paid in full');
  });

  it('HTML-escapes a malicious customer name', () => {
    const { html } = paymentAcknowledgementEmail(invoice({ customer_name: '<script>alert(1)</script>' }), payment(), settings);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('paymentReminderEmail', () => {
  it('states the outstanding balance, invoice number, and due date', () => {
    const { subject, html, text } = paymentReminderEmail(invoice({ amount_due: 120 }), settings);
    expect(subject).toContain('INV-2026-000001');
    expect(html).toContain('This is a friendly reminder that');
    expect(html).toContain('£120.00');
    expect(html).toContain('INV-2026-000001');
    expect(html).toContain('2026-07-30');
    expect(text).toContain('£120.00');
  });

  it('includes an admin-entered custom message, escaped', () => {
    const { html, text } = paymentReminderEmail(invoice(), settings, { customMessage: '<b>Please pay by Friday</b>' });
    expect(html).not.toContain('<b>Please pay by Friday</b>');
    expect(html).toContain('&lt;b&gt;Please pay by Friday&lt;/b&gt;');
    expect(text).toContain('<b>Please pay by Friday</b>');
  });

  it('includes payment instructions when configured', () => {
    const withBank = { ...settings, bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678' };
    const { html } = paymentReminderEmail(invoice({ payment_option: 'bank_transfer' }), withBank);
    expect(html).toContain('12-34-56');
  });

  it('HTML-escapes a malicious customer name', () => {
    const { html } = paymentReminderEmail(invoice({ customer_name: '<img src=x onerror=alert(1)>' }), settings);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
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

  it('title-cases an all-lowercase customer name in the greeting', () => {
    const { html, text } = receiptEmail(receipt({ customer_name: 'ali' }), settings);
    expect(html).toContain('Hi Ali,');
    expect(text).toContain('Hi Ali,');
  });
});
