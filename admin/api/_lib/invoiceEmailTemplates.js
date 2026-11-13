// Invoice/receipt email templates. Visually mirrors api/stripe-webhook.js's
// customerEmailHtml()/businessEmailHtml() brand style (navy #020b24,
// current blue wordmark, inline-styled table layout) so a customer receiving
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
import { resolveInvoicePaymentInstructions } from './paymentOptions.js';
import { smartTitleCase } from './textFormat.js';
import { emailWordmarkHtml } from './brandWordmark.js';

function money(settings, amount) {
  return `${settings.currencySymbol || '£'}${Number(amount || 0).toFixed(2)}`;
}

function wrapHtml(bodyHtml, settings) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px 32px 0 32px;">${emailWordmarkHtml()}</td></tr>
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

function paymentInstructions(invoice, settings) {
  const { bankDetails, stripePaymentLinkUrl } = resolveInvoicePaymentInstructions(invoice, settings);
  if (!bankDetails && !stripePaymentLinkUrl) return { html: '', text: '' };

  const choice = bankDetails && stripePaymentLinkUrl ? 'Pay the amount due using either method.' : '';
  const html = ['<h2 style="margin:20px 0 6px;font-size:18px;color:#122943;">How to pay</h2>'];
  const text = ['How to pay'];
  if (choice) {
    html.push(`<p style="margin:0 0 12px;color:#405368;">${choice}</p>`);
    text.push(choice);
  }

  if (bankDetails) {
    const rows = [
      ['Account name', bankDetails.accountName],
      ['Sort code', bankDetails.sortCode],
      ['Account number', bankDetails.accountNumber],
      ['Payment reference', invoice.invoice_number || 'Your invoice number once issued'],
    ];
    html.push(`
      <div style="border:1px solid #d5e1ec;border-radius:8px;background:#f4f8fc;padding:14px 16px;margin:12px 0;">
        <h3 style="margin:0 0 8px;color:#122943;font-size:15px;">Bank transfer</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;line-height:1.5;">
          ${rows.map(([label, value]) => `<tr><th scope="row" align="left" valign="top" style="width:44%;padding:3px 8px 3px 0;text-align:left;font-weight:normal;color:#405368;">${label}</th><td style="padding:3px 0;color:#122943;font-weight:bold;overflow-wrap:anywhere;">${escHtml(value)}</td></tr>`).join('')}
        </table>
        ${bankDetails.referenceInstructions ? `<p style="color:#405368;font-size:13px;margin:8px 0 0;">${escHtml(bankDetails.referenceInstructions)}</p>` : ''}
      </div>`);
    text.push('', 'Bank transfer', ...rows.map(([label, value]) => `${label}: ${value}`));
    if (bankDetails.referenceInstructions) text.push(bankDetails.referenceInstructions);
  }

  if (stripePaymentLinkUrl) {
    const href = escHtml(stripePaymentLinkUrl).replace(/"/g, '&quot;');
    html.push(`
      <h3 style="margin:14px 0 6px;color:#122943;font-size:15px;">Pay by card</h3>
      <a href="${href}" style="display:inline-block;padding:11px 16px;border-radius:6px;background:#105591;color:#fff;text-decoration:none;font-weight:bold;">Pay securely by Stripe</a>`);
    text.push('', 'Pay by card (Stripe):', stripePaymentLinkUrl);
  }

  return { html: html.join(''), text: text.join('\n') };
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
  const payment = paymentInstructions(invoice, settings);
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
    ${payment.html}
    <p style="color:#666;font-size:12px;">${escHtml(invoice.payment_terms || settings.defaultPaymentTermsText)}</p>
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

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
    payment.text,
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
  const payment = paymentInstructions(invoice, settings);
  const greetingName = escHtml(smartTitleCase(invoice.customer_name)) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>This is a friendly reminder that <strong>${money(settings, invoice.amount_due)}</strong> remains outstanding on invoice <strong>${escHtml(invoice.invoice_number)}</strong>, due on ${escHtml(invoice.due_date || '—')}.</p>
    ${customMessage ? `<p>${escHtml(customMessage)}</p>` : ''}
    ${payment.html}
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const text = [
    `Payment reminder — Invoice ${invoice.invoice_number}`,
    '',
    `Hi ${smartTitleCase(invoice.customer_name) || 'there'},`,
    '',
    `This is a friendly reminder that ${money(settings, invoice.amount_due)} remains outstanding on invoice ${invoice.invoice_number}, due on ${invoice.due_date || '—'}.`,
    customMessage || '',
    '',
    payment.text,
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
