import nodemailer from 'nodemailer';

// Mirrors api/stripe-webhook.js's makeTransport() exactly (same Gmail
// Nodemailer setup) — this is the first email sender inside the admin app,
// so it needs its own transport rather than importing across the two
// independent Vercel projects (see INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md
// §9). Uses its own env vars, configured on the admin Vercel project
// specifically: GMAIL_SENDER / GMAIL_APP_PASSWORD — see
// admin/INVOICES_SETUP.md for provisioning instructions.
function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_SENDER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export function isMailerConfigured() {
  return Boolean(process.env.GMAIL_SENDER && process.env.GMAIL_APP_PASSWORD);
}

// Sends an HTML + plain-text email. Unlike api/stripe-webhook.js's HTML-
// only emails, invoice/receipt emails always include a text fallback
// (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §9) — PDF-carrying business email
// is more likely to hit strict corporate mail filters that penalise
// HTML-only mail.
//
// Returns { ok: true, messageId } on success or { ok: false, error } on
// failure — never throws, so callers can record a send-failure event
// without an unhandled rejection.
export async function sendMail({ to, subject, html, text, attachments, fromName }) {
  if (!isMailerConfigured()) {
    return { ok: false, error: 'mailer is not configured (GMAIL_SENDER/GMAIL_APP_PASSWORD missing)' };
  }
  if (!to || !subject || !html) {
    return { ok: false, error: 'to, subject, and html are required' };
  }

  try {
    const transport = makeTransport();
    const info = await transport.sendMail({
      from: fromName ? `"${fromName}" <${process.env.GMAIL_SENDER}>` : process.env.GMAIL_SENDER,
      to,
      subject,
      html,
      text: text || undefined,
      attachments: attachments || undefined,
    });
    return { ok: true, messageId: info?.messageId || null };
  } catch (err) {
    console.error('[admin/api mailer] send failed:', err?.message || err);
    return { ok: false, error: 'failed to send email' };
  }
}
