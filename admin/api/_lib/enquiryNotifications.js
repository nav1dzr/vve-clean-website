import nodemailer from 'nodemailer';
import { isHostedPreview, previewTestInbox } from './previewIsolation.js';
import https from 'node:https';
import { emailWordmarkHtml } from './brandWordmark.js';
import { contactBusinessText, contactCustomerText } from './enquiryPlainText.js';

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    auth: {
      user: process.env.GMAIL_SENDER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function escHtml(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Google Sheets (same redirect-following pattern as stripe-webhook.js) ────

function httpsGet(urlStr, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const u   = new URL(urlStr);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET' },
      (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return httpsGet(res.headers.location, hops + 1).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error('Delivery timed out')));
    req.on('error', reject);
    req.end();
  });
}

function postToAppsScript(urlStr, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u    = new URL(urlStr);
    const req  = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return httpsGet(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error('Delivery timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendToGoogleSheets(data) {
  const endpoint = process.env.GOOGLE_SHEET_CONTACT;
  const secret   = process.env.CONTACT_SHEET_SECRET;
  if (!endpoint || !secret) {
    console.log('[contact] Google Sheets env vars missing — skipping');
    return;
  }

  const { status, body } = await postToAppsScript(endpoint, {
    secret,
    type:              'contact',
    enquiry_id:        data.enquiryId,
    full_name:         data.fullName,
    email:             data.email,
    phone:             data.phone || '',
    // New optional field. The Apps Script lives outside this repository; it
    // reads named keys, so an unrecognised one is ignored rather than
    // breaking the row. Add a "service" column to the sheet to capture it.
    service:           data.service || '',
    message:           data.message,
    marketing_opt_in:  data.marketingOptIn ? 'Yes' : 'No',
    source_page:       data.sourcePage || '/',
    status:            'new',
  });

  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}: ${body.slice(0, 300)}`);
  }

  let parsed;
  try { parsed = JSON.parse(body); } catch {
    throw new Error(`Non-JSON response: ${body.slice(0, 300)}`);
  }

  if (!parsed.success) {
    throw new Error(`Apps Script rejected: ${parsed.message}`);
  }

  console.log('[contact] Saved to Google Sheets');
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[contact] Telegram env vars not set — skipping');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
  console.log('[contact] Telegram notification sent');
}

export function contactTelegramText(data) {
  const now = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short',
  });
  return [
    '📩 <b>New Contact Enquiry — VVE Clean</b>',
    '',
    `👤 <b>Name:</b> ${escHtml(data.fullName)}`,
    `📧 <b>Email:</b> ${escHtml(data.email)}`,
    `📱 <b>Phone:</b> ${escHtml(data.phone) || '—'}`,
    `🧽 <b>Service:</b> ${escHtml(data.service) || '—'}`,
    // Telegram has a 4,096-character message limit. The full message remains
    // in the CRM and emails; truncate before escaping so entities stay valid.
    `💬 <b>Message:</b> ${escHtml(data.message.slice(0, 2200))}${data.message.length > 2200 ? '\n[Continued in Website enquiries in the CRM]' : ''}`,
    `📣 <b>Marketing opt-in:</b> ${data.marketingOptIn ? 'Yes' : 'No'}`,
    `🕐 <b>Submitted:</b> ${now}`,
  ].join('\n');
}

// ── Emails ────────────────────────────────────────────────────────────────────

function businessEmailHtml(data) {
  const rows = [
    ['Full name',        data.fullName],
    ['Email',            data.email],
    ['Phone',            data.phone || '—'],
    ['Service',          data.service || '—'],
    ['Message',          data.message],
    ['Marketing opt-in', data.marketingOptIn ? 'Yes' : 'No'],
    ['Source page',      data.sourcePage || '/'],
  ]
    .map(([k, v]) =>
      `<tr>` +
      `<td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px;white-space:nowrap;width:35%">${escHtml(k)}</td>` +
      `<td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px;word-break:break-all">${escHtml(String(v))}</td>` +
      `</tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f5f6f8;font-family:Arial,sans-serif;color:#1c1917">
  <h2 style="color:#020b24;margin:0 0 4px;font-family:Georgia,serif">New enquiry — ${escHtml(data.fullName)}</h2>
  <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Submitted via vveclean.co.uk contact form</p>
  <table cellpadding="0" cellspacing="0" style="border:1px solid #E3E7EE;border-radius:8px;overflow:hidden;background:#fff;width:100%;max-width:560px">
    <tr style="background:#f7f8fa">
      <td colspan="2" style="padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8960c;font-weight:700">Enquiry details</td>
    </tr>
    ${rows}
  </table>
</body></html>`;
}

function customerEmailHtml(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1c1917}</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="background:#020b24;padding:28px 32px;border-radius:12px 12px 0 0">
    ${emailWordmarkHtml({ inverse: true })}
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border:1px solid #E3E7EE;border-top:none;border-radius:0 0 12px 12px">
    <h1 style="font-size:22px;color:#020b24;margin:0 0 16px;font-family:Georgia,serif">We received your message</h1>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escHtml(data.fullName)},</p>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">Thank you for contacting VVE Clean.</p>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">We have received your message and will get back to you as soon as possible. Our team will reply during opening hours.</p>
    <p style="color:#1c1917;margin:0 0 24px;font-size:15px;line-height:1.6">If your request is urgent, you can also message us on WhatsApp or call us on <strong>020 8050 2233</strong>.</p>
    <a href="https://wa.me/447845451111" style="display:inline-block;background:#25D366;color:#020b24;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;margin-bottom:24px">Message us on WhatsApp</a>
    <p style="color:#6B7280;font-size:13px;margin:0;line-height:1.8">Kind regards,<br><strong>VVE Clean</strong><br>contact@vveclean.co.uk · 020 8050 2233</p>
  </td></tr>
</table>
<p style="color:#6B7280;font-size:11px;margin:16px 0 0;text-align:center">VVE Limited trading as VVE Clean · Company number 17234391<br>vveclean.co.uk · 020 8050 2233</p>
</td></tr></table>
</body></html>`;
}


export async function deliverEnquiry(supabase, row, { retryUnconfirmed = false } = {}) {
  const { data: claimed, error: claimError } = await supabase.rpc('claim_enquiry_delivery', { p_id: row.id });
  if (claimError) throw new Error('Notification queue is unavailable.');
  if (!claimed) throw new Error('Notifications are already being processed. Refresh shortly.');
  if (!claimed.delivery_claim_token || claimed.id !== row.id) throw new Error('Notification queue needs the current database migration.');
  const data = { enquiryId: claimed.id, fullName: claimed.full_name, email: claimed.email, phone: claimed.phone, service: claimed.service, message: claimed.message, marketingOptIn: claimed.marketing_opt_in, sourcePage: claimed.source_page };
  const delivery = { ...(claimed.delivery || {}) };
  const preview = isHostedPreview();
  const testInbox = previewTestInbox();
  const record = async (channel, result) => {
    const { data: saved, error } = await supabase.rpc('record_enquiry_delivery', { p_id: claimed.id, p_token: claimed.delivery_claim_token, p_channel: channel, p_result: result });
    if (error || !saved) throw new Error('Delivery result could not be recorded. Check the destination before retrying.');
    delivery[channel] = result;
  };
  const emailReady = process.env.GMAIL_SENDER && process.env.GMAIL_APP_PASSWORD && (preview ? testInbox : process.env.BUSINESS_EMAIL);
  const transport = emailReady ? makeTransport() : null;
  const jobs = [
    ['sheet', !preview && process.env.GOOGLE_SHEET_CONTACT && process.env.CONTACT_SHEET_SECRET, () => sendToGoogleSheets(data)],
    ['telegram', !preview && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID, () => sendTelegram(contactTelegramText(data))],
    ['businessEmail', emailReady, () => transport.sendMail({ from: `"VVE Clean Enquiries" <${process.env.GMAIL_SENDER}>`, to: preview ? testInbox : process.env.BUSINESS_EMAIL, replyTo: preview ? testInbox : data.email, subject: `${preview ? '[TEST] ' : ''}New website enquiry`, text: contactBusinessText(data), html: businessEmailHtml(data) })],
    ['customerEmail', emailReady, () => transport.sendMail({ from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`, to: preview ? testInbox : data.email, replyTo: preview ? testInbox : process.env.BUSINESS_EMAIL, subject: `${preview ? '[TEST] ' : ''}We received your message – VVE Clean`, text: contactCustomerText(data), html: customerEmailHtml(data) })],
  ];
  const results = await Promise.allSettled(jobs.map(async ([key, ready, send]) => {
    if (delivery[key]?.status === 'sent') return;
    // A process can stop after the destination accepts a message. Never
    // silently resend that uncertain channel without the staff inbox check.
    if (['sending', 'failed'].includes(delivery[key]?.status) && !retryUnconfirmed) return;
    const attemptedAt = new Date().toISOString();
    if (!ready) { await record(key, { status: 'unconfigured', attemptedAt }); return; }
    await record(key, { status: 'sending', attemptedAt });
    let result;
    try { await send(); result = { status: 'sent', attemptedAt }; }
    catch { result = { status: 'failed', attemptedAt, error: 'Delivery was not confirmed. Check the destination before retrying.' }; }
    await record(key, result);
  }));
  // Wait for every job before releasing: a rejected checkpoint must not free
  // the lease while other channels are still sending.
  const { data: finished, error } = await supabase.rpc('finish_enquiry_delivery', { p_id: claimed.id, p_token: claimed.delivery_claim_token });
  if (error || !finished || results.some(result => result.status === 'rejected')) throw new Error('Some delivery results could not be recorded. Refresh and check the destinations before retrying.');
  return finished;
}
