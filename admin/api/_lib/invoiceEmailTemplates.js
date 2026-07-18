// Invoice/receipt email templates. Visually mirrors api/stripe-webhook.js's
// customerEmailHtml()/businessEmailHtml() brand style (navy #020b24, gold
// #b8960c wordmark, inline-styled table layout) so a customer receiving
// both a booking confirmation and later an invoice/receipt sees a
// consistent look — but this is a separate, admin-project-local template,
// not a shared import (the two Vercel projects don't share code; see
// admin/api/_lib/escHtml.js's header for the same rationale).
//
// Every customer-controlled value is escaped via escHtml() before
// interpolation, exactly like the webhook's own templates. Unlike the
// webhook's HTML-only emails, these always include a plain-text
// alternative — see admin/api/_lib/mailer.js's header comment for why.

import { escHtml } from './escHtml.js';
import { buildPaymentInstructionsSnapshot } from './paymentOptions.js';
import { hasBankDetails } from './businessSettings.js';
import { smartTitleCase } from './textFormat.js';

function wordmarkHtml() {
  return '<span style="font-weight:700;font-size:20px;color:#020b24;">V<span style="color:#b8960c;">V</span>E</span>'
    + '<div style="font-size:10px;letter-spacing:2px;color:#666;margin-top:-2px;">CLEAN</div>';
}

function money(settings, amount) {
  return `${settings.currencySymbol || '£'}${Number(amount || 0).toFixed(2)}`;
}

function wrapHtml(bodyHtml, settings) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px 32px 0 32px;">${wordmarkHtml()}</td></tr>
          <tr><td style="padding:16px 32px 32px 32px;color:#222;font-size:14px;line-height:1.5;">
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 32px;background:#f8f8f8;color:#888;font-size:11px;">
            ${escHtml(settings.tradingName)} &middot; ${escHtml(settings.website)} &middot; ${escHtml(settings.phone)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Same "frozen at issue time, computed on the fly otherwise" resolution as
// invoicePdf.js's resolvePaymentInstructions — see that file's comment.
function resolvePaymentInstructions(invoice, settings) {
  if (invoice.payment_instructions_snapshot) return invoice.payment_instructions_snapshot;
  return buildPaymentInstructionsSnapshot({
    paymentOption: invoice.payment_option || 'bank_transfer',
    stripePaymentLinkUrl: invoice.stripe_payment_link_url,
    settings,
    hasBankDetails: hasBankDetails(settings),
  });
}

function paymentInstructionsHtml(invoice, settings) {
  const instructions = resolvePaymentInstructions(invoice, settings);
  const parts = [];

  if (instructions.bankDetails) {
    parts.push(`
      <p style="margin:12px 0 4px 0;"><strong>Bank transfer</strong><br/>
      ${escHtml(instructions.bankDetails.accountName)} &middot; Sort code ${escHtml(instructions.bankDetails.sortCode)} &middot; Account ${escHtml(instructions.bankDetails.accountNumber)}
      ${instructions.bankDetails.referenceInstructions ? `<br/><span style="color:#666;font-size:12px;">${escHtml(instructions.bankDetails.referenceInstructions)}</span>` : ''}
      </p>`);
  }

  if (instructions.stripePaymentLinkUrl) {
    // href is the same validated, allowlisted-host URL stored on the
    // invoice (see admin/api/_lib/paymentOptions.js) — never raw
    // user/customer-controlled input, so no escHtml() is needed for the
    // URL itself (it is not customer text); the visible label is a fixed
    // string, not interpolated at all.
    parts.push(`
      <p style="margin:12px 0 4px 0;"><strong>Pay by card</strong><br/>
      <a href="${instructions.stripePaymentLinkUrl}" style="color:#0a5cd8;font-weight:bold;">Pay securely by Stripe</a>
      </p>`);
  }

  return parts.join('');
}

function paymentInstructionsText(invoice, settings) {
  const instructions = resolvePaymentInstructions(invoice, settings);
  const lines = [];

  if (instructions.bankDetails) {
    lines.push('Bank transfer:');
    lines.push(`${instructions.bankDetails.accountName} · Sort code ${instructions.bankDetails.sortCode} · Account ${instructions.bankDetails.accountNumber}`);
    if (instructions.bankDetails.referenceInstructions) lines.push(instructions.bankDetails.referenceInstructions);
  }
  if (instructions.stripePaymentLinkUrl) {
    if (lines.length) lines.push('');
    lines.push('Pay by card (Stripe):');
    lines.push(instructions.stripePaymentLinkUrl);
  }

  return lines.join('\n');
}

// A one-line "for your ___" summary of what the invoice is for, derived
// from the line items actually on the invoice — there is no separate
// "service" field on the invoices table. Returns null (never a made-up
// value) when there's nothing to summarise, so callers fall back to
// generic wording rather than printing "for your ." or similar.
function serviceSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = typeof items[0]?.description === 'string' ? items[0].description.trim() : '';
  if (!first) return null;
  return items.length > 1 ? `${first} (+${items.length - 1} more)` : first;
}

export function invoiceEmail(invoice, settings, { customMessage, items } = {}) {
  const subject = `Invoice ${invoice.invoice_number} from ${settings.tradingName}`;
  const greetingName = escHtml(smartTitleCase(invoice.customer_name)) || 'there';
  const service = serviceSummary(items);
  const intro = service
    ? `Please find your invoice attached for your ${escHtml(service)}.`
    : `Please find your invoice attached${invoice.booking_ref_snapshot ? ` for booking ${escHtml(invoice.booking_ref_snapshot)}` : ''}.`;

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>${intro}</p>
    ${customMessage ? `<p>${escHtml(customMessage)}</p>` : ''}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="color:#666;">Invoice number</td><td align="right"><strong>${escHtml(invoice.invoice_number)}</strong></td></tr>
      <tr><td style="color:#666;">Invoice total</td><td align="right">${money(settings, invoice.total)}</td></tr>
      ${invoice.deposit_applied ? `<tr><td style="color:#666;">Deposit paid</td><td align="right">-${money(settings, invoice.deposit_applied)}</td></tr>` : ''}
      <tr><td style="color:#666;">Amount due</td><td align="right"><strong>${money(settings, invoice.amount_due)}</strong></td></tr>
      <tr><td style="color:#666;">Due date</td><td align="right">${escHtml(invoice.due_date || '—')}</td></tr>
    </table>
    ${paymentInstructionsHtml(invoice, settings)}
    <p style="color:#666;font-size:12px;">${escHtml(invoice.payment_terms || settings.defaultPaymentTermsText)}</p>
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const paymentText = paymentInstructionsText(invoice, settings);

  const text = [
    `Invoice ${invoice.invoice_number} from ${settings.tradingName}`,
    '',
    `Hi ${smartTitleCase(invoice.customer_name) || 'there'},`,
    '',
    service ? `Please find your invoice attached for your ${service}.` : `Please find your invoice attached${invoice.booking_ref_snapshot ? ` for booking ${invoice.booking_ref_snapshot}` : ''}.`,
    customMessage || '',
    '',
    `Invoice total: ${money(settings, invoice.total)}`,
    invoice.deposit_applied ? `Deposit paid: -${money(settings, invoice.deposit_applied)}` : '',
    `Amount due: ${money(settings, invoice.amount_due)}`,
    `Due date: ${invoice.due_date || '—'}`,
    '',
    paymentText,
    '',
    invoice.payment_terms || settings.defaultPaymentTermsText,
    '',
    `Thanks,`,
    settings.emailSignature,
  ].filter(Boolean).join('\n');

  return { subject, html: wrapHtml(bodyHtml, settings), text };
}

// Optional, admin-triggered acknowledgement for a *partial* payment — never
// sent automatically (matches this codebase's "nothing emails itself"
// pattern — see admin/api/invoices/[id].js's handleSend). No PDF attached:
// there is nothing new to attach yet (the receipt only exists once the
// balance reaches zero — see receiptLifecycle.js's createReceiptIfPaid).
export function paymentAcknowledgementEmail(invoice, payment, settings) {
  const subject = `Payment received — Invoice ${invoice.invoice_number}`;
  const greetingName = escHtml(smartTitleCase(invoice.customer_name)) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>Thank you for your payment of <strong>${money(settings, payment.amount)}</strong>. The remaining balance is <strong>${money(settings, invoice.amount_due)}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="color:#666;">Invoice</td><td align="right">${escHtml(invoice.invoice_number)}</td></tr>
      <tr><td style="color:#666;">Amount received</td><td align="right">${money(settings, payment.amount)}</td></tr>
      <tr><td style="color:#666;">Remaining balance</td><td align="right"><strong>${money(settings, invoice.amount_due)}</strong></td></tr>
      ${invoice.due_date ? `<tr><td style="color:#666;">Due date</td><td align="right">${escHtml(invoice.due_date)}</td></tr>` : ''}
    </table>
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const text = [
    `Payment received — Invoice ${invoice.invoice_number}`,
    '',
    `Hi ${smartTitleCase(invoice.customer_name) || 'there'},`,
    '',
    `Thank you for your payment of ${money(settings, payment.amount)}. The remaining balance is ${money(settings, invoice.amount_due)}.`,
    '',
    `Invoice: ${invoice.invoice_number}`,
    `Amount received: ${money(settings, payment.amount)}`,
    `Remaining balance: ${money(settings, invoice.amount_due)}`,
    invoice.due_date ? `Due date: ${invoice.due_date}` : '',
    '',
    'Thanks,',
    settings.emailSignature,
  ].filter(Boolean).join('\n');

  return { subject, html: wrapHtml(bodyHtml, settings), text };
}

// Manual "Send payment reminder" — never automatic (see
// admin/INVOICES_SETUP.md's "Automatic scheduled reminders" note for the
// documented, not-yet-built option). Reuses the invoice's own payment
// instructions block so a reminder is just as actionable as the original
// invoice email; the PDF attached is the caller's responsibility (the
// route reuses the original issued invoice PDF — see
// admin/api/invoices/[id].js's handleRemind).
export function paymentReminderEmail(invoice, settings, { customMessage } = {}) {
  const subject = `Payment reminder — Invoice ${invoice.invoice_number}`;
  const greetingName = escHtml(smartTitleCase(invoice.customer_name)) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>This is a friendly reminder that <strong>${money(settings, invoice.amount_due)}</strong> remains outstanding on invoice <strong>${escHtml(invoice.invoice_number)}</strong>, due on ${escHtml(invoice.due_date || '—')}.</p>
    ${customMessage ? `<p>${escHtml(customMessage)}</p>` : ''}
    ${paymentInstructionsHtml(invoice, settings)}
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const paymentText = paymentInstructionsText(invoice, settings);

  const text = [
    `Payment reminder — Invoice ${invoice.invoice_number}`,
    '',
    `Hi ${smartTitleCase(invoice.customer_name) || 'there'},`,
    '',
    `This is a friendly reminder that ${money(settings, invoice.amount_due)} remains outstanding on invoice ${invoice.invoice_number}, due on ${invoice.due_date || '—'}.`,
    customMessage || '',
    '',
    paymentText,
    '',
    'Thanks,',
    settings.emailSignature,
  ].filter(Boolean).join('\n');

  return { subject, html: wrapHtml(bodyHtml, settings), text };
}

export function receiptEmail(receipt, settings, { customMessage } = {}) {
  const subject = `Receipt ${receipt.receipt_number} from ${settings.tradingName}`;
  const greetingName = escHtml(smartTitleCase(receipt.customer_name)) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>Thank you for your payment. Please find your receipt attached (<strong>${escHtml(receipt.receipt_number)}</strong>${
      receipt.invoice_number_snapshot ? `, for invoice ${escHtml(receipt.invoice_number_snapshot)}` : ''
    }).</p>
    ${customMessage ? `<p>${escHtml(customMessage)}</p>` : ''}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="color:#666;">Amount received</td><td align="right"><strong>${money(settings, receipt.total_paid)}</strong></td></tr>
      <tr><td style="color:#666;">Payment date</td><td align="right">${escHtml(receipt.payment_date || '—')}</td></tr>
    </table>
    <p style="color:#1e6b1e;font-weight:bold;">Paid in full — zero balance remaining.</p>
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const text = [
    `Receipt ${receipt.receipt_number} from ${settings.tradingName}`,
    '',
    `Hi ${smartTitleCase(receipt.customer_name) || 'there'},`,
    '',
    `Thank you for your payment. Please find attached receipt ${receipt.receipt_number}.`,
    customMessage || '',
    '',
    `Amount received: ${money(settings, receipt.total_paid)}`,
    `Payment date: ${receipt.payment_date || '—'}`,
    '',
    'Paid in full — zero balance remaining.',
    '',
    'Thanks,',
    settings.emailSignature,
  ].filter(Boolean).join('\n');

  return { subject, html: wrapHtml(bodyHtml, settings), text };
}
