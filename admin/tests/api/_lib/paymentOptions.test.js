import { describe, it, expect } from 'vitest';
import {
  PAYMENT_OPTION_VALUES, validateStripePaymentLinkUrl, validatePaymentOptionInput, buildPaymentInstructionsSnapshot,
} from '../../../api/_lib/paymentOptions.js';

describe('validateStripePaymentLinkUrl', () => {
  it('accepts an approved buy.stripe.com link', () => {
    const result = validateStripePaymentLinkUrl('https://buy.stripe.com/test_abc123');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://buy.stripe.com/test_abc123');
  });

  it('accepts an approved checkout.stripe.com link', () => {
    const result = validateStripePaymentLinkUrl('https://checkout.stripe.com/pay/cs_test_123');
    expect(result.ok).toBe(true);
  });

  it('rejects a non-Stripe host', () => {
    const result = validateStripePaymentLinkUrl('https://evil.example.com/buy.stripe.com');
    expect(result.ok).toBe(false);
  });

  it('rejects http:// (non-https)', () => {
    const result = validateStripePaymentLinkUrl('http://buy.stripe.com/test_abc123');
    expect(result.ok).toBe(false);
  });

  it('rejects a javascript: URL', () => {
    const result = validateStripePaymentLinkUrl('javascript:alert(1)');
    expect(result.ok).toBe(false);
  });

  it('rejects a data: URL', () => {
    const result = validateStripePaymentLinkUrl('data:text/html,<script>alert(1)</script>');
    expect(result.ok).toBe(false);
  });

  it('rejects an empty/missing value', () => {
    expect(validateStripePaymentLinkUrl('').ok).toBe(false);
    expect(validateStripePaymentLinkUrl(undefined).ok).toBe(false);
  });

  it('rejects a subdomain trick like buy.stripe.com.evil.com', () => {
    const result = validateStripePaymentLinkUrl('https://buy.stripe.com.evil.com/test');
    expect(result.ok).toBe(false);
  });
});

describe('validatePaymentOptionInput', () => {
  it('defaults to bank_transfer with no stripe link required', () => {
    const result = validatePaymentOptionInput(undefined, undefined);
    expect(result).toEqual({ ok: true, paymentOption: 'bank_transfer', stripePaymentLinkUrl: null });
  });

  it('rejects an unknown payment option', () => {
    expect(validatePaymentOptionInput('paypal', undefined).ok).toBe(false);
  });

  it('requires a valid stripe link for stripe_payment_link', () => {
    expect(validatePaymentOptionInput('stripe_payment_link', undefined).ok).toBe(false);
    expect(validatePaymentOptionInput('stripe_payment_link', 'not a url').ok).toBe(false);
    const ok = validatePaymentOptionInput('stripe_payment_link', 'https://buy.stripe.com/test_1');
    expect(ok.ok).toBe(true);
    expect(ok.paymentOption).toBe('stripe_payment_link');
  });

  it('requires a valid stripe link for "both"', () => {
    expect(validatePaymentOptionInput('both', undefined).ok).toBe(false);
    const ok = validatePaymentOptionInput('both', 'https://checkout.stripe.com/pay/cs_1');
    expect(ok.ok).toBe(true);
  });

  it('every documented payment option is a valid value', () => {
    expect(PAYMENT_OPTION_VALUES).toEqual(['bank_transfer', 'stripe_payment_link', 'both']);
  });
});

describe('buildPaymentInstructionsSnapshot', () => {
  const settings = {
    bankAccountName: 'VVE Limited', bankSortCode: '12-34-56', bankAccountNumber: '12345678', bankReferenceInstructions: 'Use invoice number as reference',
  };

  it('bank_transfer with bank details configured includes bankDetails, no stripe link', () => {
    const snap = buildPaymentInstructionsSnapshot({ paymentOption: 'bank_transfer', stripePaymentLinkUrl: null, settings, hasBankDetails: true });
    expect(snap.bankDetails).toEqual({
      accountName: 'VVE Limited', sortCode: '12-34-56', accountNumber: '12345678', referenceInstructions: 'Use invoice number as reference',
    });
    expect(snap.stripePaymentLinkUrl).toBeNull();
  });

  it('bank_transfer with bank details NOT configured omits the block entirely (never shows blank)', () => {
    const snap = buildPaymentInstructionsSnapshot({ paymentOption: 'bank_transfer', stripePaymentLinkUrl: null, settings, hasBankDetails: false });
    expect(snap.bankDetails).toBeNull();
  });

  it('stripe_payment_link includes only the stripe link', () => {
    const snap = buildPaymentInstructionsSnapshot({
      paymentOption: 'stripe_payment_link', stripePaymentLinkUrl: 'https://buy.stripe.com/x', settings, hasBankDetails: true,
    });
    expect(snap.bankDetails).toBeNull();
    expect(snap.stripePaymentLinkUrl).toBe('https://buy.stripe.com/x');
  });

  it('both includes bank details and the stripe link', () => {
    const snap = buildPaymentInstructionsSnapshot({
      paymentOption: 'both', stripePaymentLinkUrl: 'https://buy.stripe.com/x', settings, hasBankDetails: true,
    });
    expect(snap.bankDetails).not.toBeNull();
    expect(snap.stripePaymentLinkUrl).toBe('https://buy.stripe.com/x');
  });
});
