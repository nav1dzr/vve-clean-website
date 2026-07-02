import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
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

function telegramText(meta, bookingRef) {
  const location = [meta.address, meta.postcode].filter(Boolean).join(', ') || '—';
  const datetime = meta.date
    ? `${meta.date}${meta.time ? ' · ' + meta.time : ''}`
    : 'TBC';
  return [
    '🔔 <b>New Booking — VVE Clean</b>',
    '',
    `📋 <b>Ref:</b> <code>${escHtml(bookingRef)}</code>`,
    `👤 <b>Name:</b> ${escHtml(meta.fullName)}`,
    `📱 <b>Phone:</b> ${escHtml(meta.phone) || '—'}`,
    `📧 <b>Email:</b> ${escHtml(meta.email) || '—'}`,
    `🏠 <b>Address:</b> ${escHtml(location)}`,
    `🧹 <b>Service:</b> ${escHtml(meta.service)}`,
    `📅 <b>Date/Time:</b> ${escHtml(datetime)}`,
    `💷 <b>Deposit paid:</b> £30`,
  ].join('\n');
}

async function sendToGoogleSheets(meta, bookingRef, session) {
  console.log('[sheets] Google Sheets save started');
  console.log('[sheets] GOOGLE_SHEETS_ENDPOINT exists:', !!process.env.GOOGLE_SHEETS_ENDPOINT);
  console.log('[sheets] GOOGLE_SHEETS_SECRET exists:', !!process.env.GOOGLE_SHEETS_SECRET);

  const endpoint = process.env.GOOGLE_SHEETS_ENDPOINT;
  const secret   = process.env.GOOGLE_SHEETS_SECRET;
  if (!endpoint || !secret) {
    console.log('[sheets] Google Sheets save skipped — env vars missing');
    return;
  }

  const price = Number(meta.price) || 0;
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
    body: JSON.stringify({
      secret,
      booking_ref:               bookingRef,
      payment_status:            'paid',
      full_name:                 meta.fullName || '',
      email:                     meta.email    || '',
      phone:                     meta.phone    || '',
      service:                   meta.service  || '',
      address:                   meta.address  || '',
      postcode:                  meta.postcode || '',
      preferred_date:            meta.date     || '',
      preferred_time:            meta.time     || '',
      price:                     price,
      stripe_session_id:         session.id,
      stripe_payment_intent_id:  session.payment_intent || '',
      notes:                     meta.message  || '',
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  console.log('[sheets] Google Sheets save success — response:', body);
}

async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[webhook] Telegram env vars not set — skipping notification');
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
  console.log('[webhook] Telegram notification sent');
}

function customerEmailHtml(meta, bookingRef) {
  const dateRow = meta.date
    ? `<tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Date / time</td>` +
      `<td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">` +
      `${meta.date}${meta.time ? ' · ' + meta.time : ''}</td></tr>`
    : '';
  const addressRow = (meta.address || meta.postcode)
    ? `<tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Location</td>` +
      `<td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">` +
      `${[meta.address, meta.postcode].filter(Boolean).join(', ')}</td></tr>`
    : '';
  const remainingBalance = meta.price
    ? `£${Math.max(0, Number(meta.price) - 30).toLocaleString('en-GB')}`
    : 'to be confirmed';

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
    <h1 style="font-size:22px;color:#020b24;margin:0 0 8px;font-family:Georgia,serif">Booking confirmed</h1>
    <p style="color:#6B7280;margin:0 0 24px;font-size:15px">Hi ${meta.fullName || 'there'}, your £30 deposit is in and your slot is held. We'll be in touch shortly to confirm the exact time.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E7EE;border-radius:8px;overflow:hidden;margin:0 0 24px">
      <tr style="background:#f7f8fa"><td colspan="2" style="padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8960c;font-weight:700">Your booking</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px;width:40%">Service</td>
          <td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${meta.service || '—'}</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Estimate</td>
          <td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${meta.price ? '£' + meta.price : '—'}</td></tr>
      ${dateRow}
      ${addressRow}
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Deposit paid</td>
          <td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">£30 ✓</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Remaining balance</td>
          <td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${remainingBalance} (due on the day)</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Reference</td>
          <td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px;word-break:break-all">${bookingRef}</td></tr>
    </table>
    <p style="color:#1e3a5f;font-size:14px;margin:0 0 8px">The £30 deposit comes off your final bill. If you need to change anything, contact us with your reference number above.</p>
    <p style="color:#6B7280;font-size:13px;margin:0 0 24px">Phone: <strong>020 8050 2233</strong> · Email: <strong>contact@vveclean.co.uk</strong></p>
    <a href="https://wa.me/447845451111" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">Message us on WhatsApp</a>
  </td></tr>
</table>
<p style="color:#9ca3af;font-size:11px;margin:16px 0 0;text-align:center">VVE Clean Ltd · vveclean.co.uk · 020 8050 2233</p>
</td></tr></table>
</body></html>`;
}

function businessEmailHtml(meta, bookingRef) {
  const rows = [
    ['Full name',      meta.fullName || '—'],
    ['Email',          meta.email    || '—'],
    ['Phone',          meta.phone    || '—'],
    ['Address',        [meta.address, meta.postcode].filter(Boolean).join(', ') || '—'],
    ['Service',        meta.service  || '—'],
    ['Estimate',       meta.price    ? `£${meta.price}` : '—'],
    ['Date / time',    meta.date     ? `${meta.date}${meta.time ? ' · ' + meta.time : ''}` : '—'],
    ['Deposit paid',   '£30'],
    ['Remaining',      meta.price    ? `£${Math.max(0, Number(meta.price) - 30)}` : '—'],
    ['Notes',          meta.message  || '—'],
    ['Booking ref',    bookingRef],
  ]
    .map(([k, v]) =>
      `<tr>` +
      `<td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px;white-space:nowrap;width:35%">${k}</td>` +
      `<td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px;word-break:break-all">${v}</td>` +
      `</tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f5f6f8;font-family:Arial,sans-serif;color:#1c1917">
  <h2 style="color:#020b24;margin:0 0 4px;font-family:Georgia,serif">New booking — ${meta.fullName || '—'}</h2>
  <p style="color:#6B7280;font-size:14px;margin:0 0 20px">${meta.service || '—'} · ref: ${bookingRef}</p>
  <table cellpadding="0" cellspacing="0" style="border:1px solid #E3E7EE;border-radius:8px;overflow:hidden;background:#fff;width:100%;max-width:560px">
    <tr style="background:#f7f8fa">
      <td colspan="2" style="padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8960c;font-weight:700">Booking details</td>
    </tr>
    ${rows}
  </table>
</body></html>`;
}

export default async function handler(req, res) {
  console.log('[webhook] received method:', req.method);

  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  // ── Guard: env vars ──────────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[webhook] STRIPE_SECRET_KEY is not set');
    res.writeHead(500);
    return res.end('Server misconfiguration: missing Stripe key');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    res.writeHead(500);
    return res.end('Server misconfiguration: missing webhook secret');
  }

  // ── Lazy Stripe init ─────────────────────────────────────────────────────
  let stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.error('[webhook] Stripe init failed:', err.message);
    res.writeHead(500);
    return res.end('Stripe init failed');
  }

  // ── Read + verify signature ──────────────────────────────────────────────
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('[webhook] No stripe-signature header present');
    res.writeHead(400);
    return res.end('Missing Stripe signature');
  }

  const rawBody = await readRawBody(req);
  console.log('[webhook] raw body bytes:', rawBody.length);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('[webhook] signature verified — event type:', event.type, '| id:', event.id);
  } catch (err) {
    console.error('[webhook] Signature verification FAILED:', err.message);
    console.error('[webhook] Check STRIPE_WEBHOOK_SECRET matches the endpoint signing secret in Stripe Dashboard');
    res.writeHead(400);
    return res.end(`Webhook Error: ${err.message}`);
  }

  // ── Only act on completed payments ──────────────────────────────────────
  if (event.type !== 'checkout.session.completed') {
    console.log('[webhook] ignoring event:', event.type);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ received: true }));
  }

  const session    = event.data.object;
  const meta       = session.metadata || {};
  // Use the human-readable ref stored in metadata; fall back to session ID for old sessions.
  const bookingRef = meta.booking_ref || session.id;

  console.log('[webhook] payment completed — ref:', bookingRef);
  console.log('[webhook] customer:', meta.fullName, '| service:', meta.service);
  console.log('[webhook] email:', meta.email || '(none)', '| phone:', meta.phone || '(none)');
  console.log('[webhook] payment_status:', session.payment_status);

  // ── Update booking in Supabase ───────────────────────────────────────────
  // Upsert so this works even if the initial pending_payment insert failed.
  // Runs before emails/Telegram so data is safe even if notifications fail.
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[webhook] SUPABASE_SERVICE_ROLE_KEY not set — skipping DB update');
  } else {
    try {
      const { error: dbErr } = await supabase.from('bookings').upsert(
        {
          booking_ref:               bookingRef,
          stripe_session_id:         session.id,
          stripe_payment_intent_id:  session.payment_intent || null,
          payment_status:            'paid',
          deposit_amount:            30,
          full_name:                 meta.fullName || null,
          email:                     meta.email    || null,
          phone:                     meta.phone    || null,
          address:                   meta.address  || null,
          postcode:                  meta.postcode || null,
          service:                   meta.service  || null,
          preferred_date:            meta.date     || null,
          preferred_time:            meta.time     || null,
          notes:                     meta.message  || null,
          updated_at:                new Date().toISOString(),
        },
        { onConflict: 'stripe_session_id' },
      );
      if (dbErr) {
        console.error('[webhook] Supabase upsert error — code:', dbErr.code, '| message:', dbErr.message);
      } else {
        console.log('[webhook] Booking updated to paid in Supabase — ref:', bookingRef, '| session:', session.id);
      }
    } catch (dbEx) {
      console.error('[webhook] Supabase unexpected error:', dbEx.message);
    }
  }

  // ── Email env var check ──────────────────────────────────────────────────
  const emailEnvOk =
    !!process.env.GMAIL_SENDER &&
    !!process.env.GMAIL_APP_PASSWORD &&
    !!process.env.BUSINESS_EMAIL;

  if (!emailEnvOk) {
    console.error('[webhook] Email env vars missing:',
      !process.env.GMAIL_SENDER        ? 'GMAIL_SENDER '        : '',
      !process.env.GMAIL_APP_PASSWORD  ? 'GMAIL_APP_PASSWORD '  : '',
      !process.env.BUSINESS_EMAIL      ? 'BUSINESS_EMAIL'        : '',
    );
  } else {
    // ── Send emails ────────────────────────────────────────────────────────
    const transport = makeTransport();

    // Verify SMTP credentials before attempting send
    try {
      await transport.verify();
      console.log('[webhook] SMTP connection verified OK');
    } catch (verifyErr) {
      console.error('[webhook] SMTP verify FAILED — code:', verifyErr.code, '| message:', verifyErr.message);
      console.error('[webhook] Check GMAIL_SENDER is a real Gmail address and GMAIL_APP_PASSWORD is a valid App Password (not your regular Gmail password)');
    }

    const sends = [];

    // Business alert — always
    sends.push(
      transport
        .sendMail({
          from:    `"VVE Clean Bookings" <${process.env.GMAIL_SENDER}>`,
          to:      process.env.BUSINESS_EMAIL,
          subject: `New booking — ${meta.fullName || 'Customer'} — ${meta.service || 'Cleaning'}`,
          html:    businessEmailHtml(meta, bookingRef),
        })
        .then(() => console.log('[webhook] Business alert sent to:', process.env.BUSINESS_EMAIL))
        .catch((err) =>
          console.error('[webhook] Business alert FAILED — code:', err.code, '| message:', err.message,
            '| responseCode:', err.responseCode, '| response:', err.response),
        ),
    );

    // Customer confirmation — only if they gave an email
    if (meta.email) {
      sends.push(
        transport
          .sendMail({
            from:    `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
            to:      meta.email,
            subject: `Your booking is confirmed — ${meta.service || 'VVE Clean'}`,
            html:    customerEmailHtml(meta, bookingRef),
          })
          .then(() => console.log('[webhook] Customer confirmation sent to:', meta.email))
          .catch((err) =>
            console.error('[webhook] Customer confirmation FAILED — code:', err.code, '| message:', err.message,
              '| responseCode:', err.responseCode, '| response:', err.response),
          ),
      );
    } else {
      console.log('[webhook] No customer email on file — skipping customer confirmation');
    }

    // Wait for both but never throw — non-200 causes Stripe to retry
    await Promise.allSettled(sends);
    console.log('[webhook] Email dispatch complete');
  }

  // ── Telegram notification ────────────────────────────────────────────────
  try {
    await sendTelegram(telegramText(meta, bookingRef));
  } catch (err) {
    console.error('[webhook] Telegram notification FAILED:', err.message);
  }

  // ── Google Sheets row ────────────────────────────────────────────────────
  try {
    await sendToGoogleSheets(meta, bookingRef, session);
  } catch (err) {
    console.error('[webhook] Google Sheets FAILED:', err.message);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true }));
}
