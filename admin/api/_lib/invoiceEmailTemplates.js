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

export function invoiceEmail(invoice, settings, { customMessage } = {}) {
  const subject = `Invoice ${invoice.invoice_number} from ${settings.tradingName}`;
  const greetingName = escHtml(invoice.customer_name) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>Please find attached invoice <strong>${escHtml(invoice.invoice_number)}</strong> for ${escHtml(invoice.booking_ref_snapshot || '')
      ? `booking ${escHtml(invoice.booking_ref_snapshot)}` : 'the work below'}.</p>
    ${customMessage ? `<p>${escHtml(customMessage)}</p>` : ''}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="color:#666;">Invoice total</td><td align="right"><strong>${money(settings, invoice.total)}</strong></td></tr>
      <tr><td style="color:#666;">Amount due</td><td align="right"><strong>${money(settings, invoice.amount_due)}</strong></td></tr>
      <tr><td style="color:#666;">Due date</td><td align="right">${escHtml(invoice.due_date || '—')}</td></tr>
    </table>
    <p style="color:#666;font-size:12px;">${escHtml(invoice.payment_terms || settings.defaultPaymentTermsText)}</p>
    <p>Thanks,<br/>${escHtml(settings.emailSignature)}</p>
  `;

  const text = [
    `Invoice ${invoice.invoice_number} from ${settings.tradingName}`,
    '',
    `Hi ${invoice.customer_name || 'there'},`,
    '',
    `Please find attached invoice ${invoice.invoice_number}.`,
    customMessage || '',
    '',
    `Invoice total: ${money(settings, invoice.total)}`,
    `Amount due: ${money(settings, invoice.amount_due)}`,
    `Due date: ${invoice.due_date || '—'}`,
    '',
    invoice.payment_terms || settings.defaultPaymentTermsText,
    '',
    `Thanks,`,
    settings.emailSignature,
  ].filter(Boolean).join('\n');

  return { subject, html: wrapHtml(bodyHtml, settings), text };
}

export function receiptEmail(receipt, settings, { customMessage } = {}) {
  const subject = `Receipt ${receipt.receipt_number} from ${settings.tradingName}`;
  const greetingName = escHtml(receipt.customer_name) || 'there';

  const bodyHtml = `
    <p>Hi ${greetingName},</p>
    <p>Thank you for your payment. Please find attached receipt <strong>${escHtml(receipt.receipt_number)}</strong>${
      receipt.invoice_number_snapshot ? ` for invoice ${escHtml(receipt.invoice_number_snapshot)}` : ''
    }.</p>
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
    `Hi ${receipt.customer_name || 'there'},`,
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
