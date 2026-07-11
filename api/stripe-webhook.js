import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import https from 'node:https';

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
  const isLeaflet = meta.last_source === 'leaflet' || meta.offer_code === 'LEAFLET20';
  const location  = [meta.address, meta.postcode].filter(Boolean).join(', ') || '—';
  const datetime  = meta.date
    ? `${meta.date}${meta.time ? ' · ' + meta.time : ''}`
    : 'TBC';

  const priceNum    = Number(meta.price)           || 0;
  const stdTotal    = Number(meta.standard_total)  || 0;
  const discountAmt = Number(meta.discount_amount) || 0;
  const balance     = Math.max(0, priceNum - 30);

  const priceLines = isLeaflet && stdTotal > 0
    ? [
        `💷 <b>Standard price:</b> £${stdTotal}`,
        `🏷️ <b>Leaflet discount 20%:</b> −£${discountAmt}`,
        `✅ <b>Final total:</b> £${priceNum}`,
        `💳 <b>Deposit paid:</b> £30`,
        `🕐 <b>Balance after clean:</b> £${balance}`,
      ]
    : [
        `💷 <b>Price:</b> £${priceNum || '—'}`,
        `💳 <b>Deposit paid:</b> £30`,
      ];

  const sourceLines = isLeaflet
    ? [
        '',
        `📍 <b>Source:</b> Leaflet`,
        `🎟️ <b>Offer:</b> LEAFLET20`,
        `🔗 <b>Landing page:</b> /leaflet`,
      ]
    : meta.last_source
      ? [`📍 <b>Source:</b> ${escHtml(meta.last_source)}`]
      : [];

  return [
    isLeaflet ? '🚨 <b>NEW LEAFLET BOOKING</b>' : '🔔 <b>New Booking — VVE Clean</b>',
    '',
    `📋 <b>Ref:</b> <code>${escHtml(bookingRef)}</code>`,
    `👤 <b>Name:</b> ${escHtml(meta.fullName)}`,
    `📱 <b>Phone:</b> ${escHtml(meta.phone) || '—'}`,
    `📧 <b>Email:</b> ${escHtml(meta.email) || '—'}`,
    `🏠 <b>Address:</b> ${escHtml(location)}`,
    `🧹 <b>Service:</b> ${escHtml(meta.service)}`,
    `📅 <b>Date/Time:</b> ${escHtml(datetime)}`,
    ...priceLines,
    ...sourceLines,
  ].join('\n');
}

// Google Apps Script POST flow:
//   1. POST /exec  → script runs → 302 to /echo?...
//   2. GET  /echo  → returns the ContentService JSON output
function httpsGet(urlStr, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const u   = new URL(urlStr);
    console.log(`[sheets] GET hop ${hops} host:`, u.hostname);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET' },
      (res) => {
        console.log(`[sheets] GET hop ${hops} status:`, res.statusCode);
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return httpsGet(res.headers.location, hops + 1).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log(`[sheets] GET hop ${hops} body preview:`, data.slice(0, 120));
          resolve({ status: res.statusCode, body: data });
        });
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
    console.log('[sheets] POST target host:', u.hostname);
    const req  = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        console.log('[sheets] POST /exec status:', res.statusCode);
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          const loc = new URL(res.headers.location);
          console.log('[sheets] Redirect to host:', loc.hostname);
          res.resume();
          return httpsGet(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log('[sheets] No redirect — body preview:', data.slice(0, 120));
          resolve({ status: res.statusCode, body: data });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendToGoogleSheets(meta, bookingRef, session) {
  console.log('[sheets] Google Sheets save started');
  console.log('[sheets] GOOGLE_SHEETS_URL exists:', !!process.env.GOOGLE_SHEETS_URL);
  console.log('[sheets] GOOGLE_SHEETS_SECRET exists:', !!process.env.GOOGLE_SHEETS_SECRET);

  const endpoint = process.env.GOOGLE_SHEETS_URL;
  const secret   = process.env.GOOGLE_SHEETS_SECRET;
  if (!endpoint || !secret) {
    console.log('[sheets] Google Sheets save skipped — env vars missing');
    return;
  }

  const price = Number(meta.price) || 0;
  const { status, body } = await postToAppsScript(endpoint, {
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
  });

  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}: ${body.slice(0, 300)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (_) {
    throw new Error(`Non-JSON response — redirect not resolved? Body: ${body.slice(0, 300)}`);
  }

  if (!parsed.success) {
    throw new Error(`Apps Script rejected request: ${parsed.message}`);
  }

  console.log('[sheets] Google Sheets save success');
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

  let stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.error('[webhook] Stripe init failed:', err.message);
    res.writeHead(500);
    return res.end('Stripe init failed');
  }

  // ── Read + verify signature ──────────────────────────────────────────────────
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('[webhook] No stripe-signature header');
    res.writeHead(400);
    return res.end('Missing Stripe signature');
  }

  const rawBody = await readRawBody(req);
  console.log('[webhook] raw body bytes:', rawBody.length);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('[webhook] signature verified — event type:', event.type, '| event id:', event.id);
  } catch (err) {
    console.error('[webhook] Signature verification FAILED:', err.message);
    res.writeHead(400);
    return res.end(`Webhook Error: ${err.message}`);
  }

  // ── Ignore non-payment events ───────────────────────────────────────────────
  if (event.type !== 'checkout.session.completed') {
    console.log('[webhook] ignoring event:', event.type);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ received: true }));
  }

  const session    = event.data.object;
  const meta       = session.metadata || {};
  const bookingRef = meta.booking_ref || session.id;

  console.log('[webhook] payment completed — ref:', bookingRef,
    '| session:', session.id, '| payment_status:', session.payment_status);

  // ── Idempotency check — must happen before any side effects ─────────────────
  // Insert the event ID into processed_stripe_events. If the UNIQUE constraint
  // rejects the insert (duplicate delivery), return 200 immediately — all side
  // effects already ran for this event.
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { error: dupErr } = await supabase
        .from('processed_stripe_events')
        .insert({ event_id: event.id, event_type: event.type });

      if (dupErr) {
        if (dupErr.code === '23505') {
          // Unique-violation — event already processed (duplicate delivery from Stripe)
          console.log('[webhook] duplicate event', event.id, '— already processed, returning 200');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ received: true }));
        }
        // Non-unique error (e.g. table not yet migrated) — log and continue
        console.warn('[webhook] processed_stripe_events insert error:', dupErr.code, dupErr.message,
          '— proceeding without idempotency guard');
      } else {
        console.log('[webhook] event', event.id, 'marked as in-progress');
      }
    } catch (idempEx) {
      console.warn('[webhook] idempotency check failed:', idempEx.message, '— proceeding');
    }
  }

  // ── Persist booking to Supabase (MUST succeed before notifications) ─────────
  // Upsert on stripe_session_id so this is safe even if the initial insert failed.
  let dbPersisted = false;

  if (!supabase) {
    console.warn('[webhook] Supabase not configured — booking will not be persisted to DB');
    // Allow notifications in no-DB (dev/fallback) mode — booking data comes from Stripe metadata.
    dbPersisted = true;
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
        // Return 500 so Stripe retries. Do NOT send notifications — data is not durable yet.
        console.error('[webhook] Supabase upsert FAILED — code:', dbErr.code,
          '| message:', dbErr.message,
          '| returning 500 for Stripe retry');
        res.writeHead(500);
        return res.end('DB persistence failed — Stripe will retry');
      }

      console.log('[webhook] Booking upserted to Supabase — ref:', bookingRef, '| session:', session.id);
      dbPersisted = true;

      // Attribution — in its own try/catch so column absence never breaks the webhook.
      if (meta.last_source || meta.offer_code) {
        try {
          const { error: attrErr } = await supabase.from('bookings').update({
            offer_code:                 meta.offer_code                 || null,
            discount_percent:           meta.discount_percent           ? Number(meta.discount_percent)           : null,
            standard_total:             meta.standard_total             ? Number(meta.standard_total)             : null,
            discount_amount:            meta.discount_amount            ? Number(meta.discount_amount)            : null,
            final_total_after_discount: meta.final_total_after_discount ? Number(meta.final_total_after_discount) : null,
            first_source:               meta.first_source               || null,
            last_source:                meta.last_source                || null,
            landing_page:               meta.landing_page               || null,
            utm_source:                 meta.utm_source                 || null,
            utm_medium:                 meta.utm_medium                 || null,
            utm_campaign:               meta.utm_campaign               || null,
            utm_content:                meta.utm_content                || null,
            gclid:                      meta.gclid                      || null,
          }).eq('stripe_session_id', session.id);
          if (attrErr) {
            console.warn('[webhook] Attribution update skipped:', attrErr.code, attrErr.message);
          } else {
            console.log('[webhook] Attribution saved');
          }
        } catch (attrEx) {
          console.warn('[webhook] Attribution update error:', attrEx.message);
        }
      }
    } catch (dbEx) {
      console.error('[webhook] Supabase unexpected error:', dbEx.message,
        '| returning 500 for Stripe retry');
      res.writeHead(500);
      return res.end('DB unexpected error — Stripe will retry');
    }
  }

  // ── Notifications — only after booking is durably stored ────────────────────
  // Each notification is independent. One failure does not prevent others.
  // We track notification status back to Supabase where columns are available.

  const notifStatus = {
    email_customer_sent: false,
    email_business_sent: false,
    telegram_sent:       false,
    sheets_sent:         false,
  };

  // ── Email ──────────────────────────────────────────────────────────────────
  const emailEnvOk =
    !!process.env.GMAIL_SENDER &&
    !!process.env.GMAIL_APP_PASSWORD &&
    !!process.env.BUSINESS_EMAIL;

  if (!emailEnvOk) {
    console.error('[webhook] Email env vars missing:',
      !process.env.GMAIL_SENDER       ? 'GMAIL_SENDER '       : '',
      !process.env.GMAIL_APP_PASSWORD ? 'GMAIL_APP_PASSWORD '  : '',
      !process.env.BUSINESS_EMAIL     ? 'BUSINESS_EMAIL'       : '',
    );
  } else {
    const transport = makeTransport();
    try {
      await transport.verify();
      console.log('[webhook] SMTP connection verified OK');
    } catch (verifyErr) {
      console.error('[webhook] SMTP verify FAILED — code:', verifyErr.code, '| message:', verifyErr.message);
    }

    // Business alert
    try {
      await transport.sendMail({
        from:    `"VVE Clean Bookings" <${process.env.GMAIL_SENDER}>`,
        to:      process.env.BUSINESS_EMAIL,
        subject: `New booking — ref: ${bookingRef} — ${meta.service || 'Cleaning'}`,
        html:    businessEmailHtml(meta, bookingRef),
      });
      console.log('[webhook] Business alert sent');
      notifStatus.email_business_sent = true;
    } catch (err) {
      console.error('[webhook] Business alert FAILED — code:', err.code, '| message:', err.message,
        '| responseCode:', err.responseCode);
    }

    // Customer confirmation
    if (meta.email) {
      try {
        await transport.sendMail({
          from:    `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
          to:      meta.email,
          subject: `Your booking is confirmed — ${meta.service || 'VVE Clean'}`,
          html:    customerEmailHtml(meta, bookingRef),
        });
        console.log('[webhook] Customer confirmation sent');
        notifStatus.email_customer_sent = true;
      } catch (err) {
        console.error('[webhook] Customer confirmation FAILED — code:', err.code, '| message:', err.message,
          '| responseCode:', err.responseCode);
      }
    } else {
      console.log('[webhook] No customer email on file — skipping customer confirmation');
    }
  }

  // ── Telegram ───────────────────────────────────────────────────────────────
  try {
    await sendTelegram(telegramText(meta, bookingRef));
    notifStatus.telegram_sent = true;
  } catch (err) {
    console.error('[webhook] Telegram FAILED:', err.message);
  }

  // ── Google Sheets ──────────────────────────────────────────────────────────
  try {
    await sendToGoogleSheets(meta, bookingRef, session);
    notifStatus.sheets_sent = true;
  } catch (err) {
    console.error('[webhook] Google Sheets FAILED:', err.message);
  }

  // ── Update notification status in Supabase ─────────────────────────────────
  if (supabase && dbPersisted) {
    try {
      await supabase.from('bookings')
        .update(notifStatus)
        .eq('stripe_session_id', session.id);
    } catch (nsErr) {
      console.warn('[webhook] Notification status update failed (non-critical):', nsErr.message);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true }));
}
