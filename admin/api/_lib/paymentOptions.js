// Per-invoice payment-instructions logic: the three-way choice of how a
// customer is told to pay (bank transfer / Stripe payment link / both),
// validation of admin-entered Stripe payment-link URLs, and the snapshot
// frozen onto an invoice at issue time so later env var or admin changes
// never silently alter an already-issued document (mirrors
// businessSettings.js's business_snapshot pattern).

export const PAYMENT_OPTION_VALUES = ['bank_transfer', 'stripe_payment_link', 'both'];
export const DEFAULT_PAYMENT_OPTION = 'bank_transfer';

// Real Stripe-hosted payment-link/checkout domains only. Deliberately a
// closed allowlist, not "any https URL" — an admin mistyping or pasting an
// untrusted link must never become a "Pay securely by Stripe" link sent to
// a customer.
const APPROVED_STRIPE_LINK_HOSTS = ['buy.stripe.com', 'checkout.stripe.com'];

// Validates an admin-entered Stripe payment-link URL. Returns
// { ok: true, url } with the normalised (trimmed) URL, or
// { ok: false, error }. Parsing via the URL constructor itself rejects
// javascript:/data:/vbscript: and every other non-URL string — the
// protocol/host checks below are defence in depth on top of that, and are
// what produce a clear, specific error message rather than a generic parse
// failure.
export function validateStripePaymentLinkUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'A Stripe payment-link URL is required for this payment option' };
  }

  const trimmed = raw.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'stripePaymentLinkUrl must be a valid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'stripePaymentLinkUrl must use https://' };
  }

  if (!APPROVED_STRIPE_LINK_HOSTS.includes(parsed.hostname)) {
    return { ok: false, error: `stripePaymentLinkUrl must be hosted on one of: ${APPROVED_STRIPE_LINK_HOSTS.join(', ')}` };
  }

  return { ok: true, url: parsed.toString() };
}

// Validates the payment_option field together with the stripe link it may
// require. Called by both create and update — never trusts a client-sent
// combination without re-checking (an option including Stripe requires a
// validated link; bank_transfer alone does not require one, even if bank
// details themselves aren't configured yet — see hasBankDetails()).
export function validatePaymentOptionInput(paymentOption, stripePaymentLinkUrl) {
  const option = paymentOption || DEFAULT_PAYMENT_OPTION;
  if (!PAYMENT_OPTION_VALUES.includes(option)) {
    return { ok: false, error: `paymentOption must be one of: ${PAYMENT_OPTION_VALUES.join(', ')}` };
  }

  const requiresStripeLink = option === 'stripe_payment_link' || option === 'both';
  if (!requiresStripeLink) {
    return { ok: true, paymentOption: option, stripePaymentLinkUrl: null };
  }

  const linkCheck = validateStripePaymentLinkUrl(stripePaymentLinkUrl);
  if (!linkCheck.ok) return linkCheck;

  return { ok: true, paymentOption: option, stripePaymentLinkUrl: linkCheck.url };
}

// Builds the frozen payment_instructions_snapshot stored on `invoices` at
// issue time (see the migration file header). Only includes the pieces
// that are actually relevant to the chosen option, and only includes bank
// details at all when hasBankDetails(settings) is true — an invoice set to
// "bank_transfer" before bank details were configured simply freezes a
// null bankDetails block, same "omit, never show blank" rule used
// everywhere else in this feature.
export function buildPaymentInstructionsSnapshot({ paymentOption, stripePaymentLinkUrl, settings, hasBankDetails }) {
  const showBank = paymentOption === 'bank_transfer' || paymentOption === 'both';
  const showStripe = paymentOption === 'stripe_payment_link' || paymentOption === 'both';

  return {
    paymentOption,
    bankDetails: showBank && hasBankDetails
      ? {
        accountName: settings.bankAccountName,
        sortCode: settings.bankSortCode,
        accountNumber: settings.bankAccountNumber,
        referenceInstructions: settings.bankReferenceInstructions || null,
      }
      : null,
    stripePaymentLinkUrl: showStripe && stripePaymentLinkUrl ? stripePaymentLinkUrl : null,
  };
}
