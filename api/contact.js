// Contact form submission handler.
// Mirrors the structure of stripe-webhook.js — same Google Sheets, Telegram, and email patterns.
// No Stripe, no Supabase.

import nodemailer from 'nodemailer';
import https from 'node:https';

export const config = { api: { bodyParser: false } };

const ALLOWED_ORIGINS = [
  process.env.SITE_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

function corsHeaders(origin) {
  const use = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*');
  return {
    'Access-Control-Allow-Origin':  use,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end',  () => resolve(raw));
    req.on('error', reject);
  });
}

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
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
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendToGoogleSheets(data) {
  const endpoint = process.env.GOOGLE_SHEET_CONTACT;
  const secret   = process.env.GOOGLE_SHEETS_SECRET;
  if (!endpoint || !secret) {
    console.log('[contact] Google Sheets env vars missing — skipping');
    return;
  }

  const { status, body } = await postToAppsScript(endpoint, {
    secret,
    type:              'contact',
    full_name:         data.fullName,
    email:             data.email,
    phone:             data.phone || '',
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
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
  console.log('[contact] Telegram notification sent');
}

function contactTelegramText(data) {
  const now = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short',
  });
  return [
    '📩 <b>New Contact Enquiry — VVE Clean</b>',
    '',
    `👤 <b>Name:</b> ${escHtml(data.fullName)}`,
    `📧 <b>Email:</b> ${escHtml(data.email)}`,
    `📱 <b>Phone:</b> ${escHtml(data.phone) || '—'}`,
    `💬 <b>Message:</b> ${escHtml(data.message)}`,
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
    <span style="font-size:24px;letter-spacing:0.18em;font-weight:700;color:#fff;font-family:Georgia,serif">V<span style="color:#b8960c">V</span>E</span>
    <span style="font-size:10px;letter-spacing:0.22em;color:rgba(255,255,255,0.55);font-weight:600;font-family:Arial,sans-serif;margin-left:8px">CLEAN</span>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border:1px solid #E3E7EE;border-top:none;border-radius:0 0 12px 12px">
    <h1 style="font-size:22px;color:#020b24;margin:0 0 16px;font-family:Georgia,serif">We received your message</h1>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escHtml(data.fullName)},</p>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">Thank you for contacting VVE Clean.</p>
    <p style="color:#1c1917;margin:0 0 16px;font-size:15px;line-height:1.6">We have received your message and will get back to you as soon as possible. We usually reply within the hour during working hours.</p>
    <p style="color:#1c1917;margin:0 0 24px;font-size:15px;line-height:1.6">If your request is urgent, you can also message us on WhatsApp or call us on <strong>020 8050 2233</strong>.</p>
    <a href="https://wa.me/447845451111" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;margin-bottom:24px">Message us on WhatsApp</a>
    <p style="color:#6B7280;font-size:13px;margin:0;line-height:1.8">Kind regards,<br><strong>VVE Clean</strong><br>contact@vveclean.co.uk · 020 8050 2233</p>
  </td></tr>
</table>
<p style="color:#9ca3af;font-size:11px;margin:16px 0 0;text-align:center">VVE Clean Ltd · vveclean.co.uk · 020 8050 2233</p>
</td></tr></table>
</body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  const origin  = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw);
  } catch {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid request body' }));
  }

  const { fullName, email, phone, message, marketingOptIn, sourcePage, _honeypot } = payload;

  // Honeypot — silently succeed so bots think the submission worked
  if (_honeypot) {
    console.log('[contact] Honeypot triggered — silently rejecting');
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // Server-side validation
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Full name is required.' }));
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'A valid email address is required.' }));
  }
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Please enter a message.' }));
  }

  const data = {
    fullName:       fullName.trim(),
    email:          email.trim().toLowerCase(),
    phone:          (phone || '').trim(),
    message:        message.trim(),
    marketingOptIn: !!marketingOptIn,
    sourcePage:     (sourcePage || '/').slice(0, 200),
  };

  console.log('[contact] enquiry from:', data.email, '| name:', data.fullName);

  // Google Sheets
  try {
    await sendToGoogleSheets(data);
  } catch (err) {
    console.error('[contact] Google Sheets FAILED:', err.message);
  }

  // Telegram
  try {
    await sendTelegram(contactTelegramText(data));
  } catch (err) {
    console.error('[contact] Telegram FAILED:', err.message);
  }

  // Emails
  const emailEnvOk =
    !!process.env.GMAIL_SENDER &&
    !!process.env.GMAIL_APP_PASSWORD &&
    !!process.env.BUSINESS_EMAIL;

  if (!emailEnvOk) {
    console.error('[contact] Email env vars missing — skipping emails');
  } else {
    const transport = makeTransport();
    await Promise.allSettled([
      transport
        .sendMail({
          from:    `"VVE Clean Enquiries" <${process.env.GMAIL_SENDER}>`,
          to:      process.env.BUSINESS_EMAIL,
          subject: `New enquiry — ${data.fullName}`,
          html:    businessEmailHtml(data),
        })
        .then(() => console.log('[contact] Business email sent'))
        .catch((err) => console.error('[contact] Business email FAILED:', err.message)),

      transport
        .sendMail({
          from:    `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
          to:      data.email,
          subject: 'We received your message – VVE Clean',
          html:    customerEmailHtml(data),
        })
        .then(() => console.log('[contact] Customer confirmation sent to:', data.email))
        .catch((err) => console.error('[contact] Customer confirmation FAILED:', err.message)),
    ]);
    console.log('[contact] Email dispatch complete');
  }

  res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}
