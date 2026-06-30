import Stripe from 'stripe';
import nodemailer from 'nodemailer';

// Disable body parsing — Stripe signature verification requires the raw bytes.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

function customerEmailHtml(meta) {
  const dateRow = meta.date
    ? `<tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Preferred date</td><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${meta.date}${meta.time ? ' at ' + meta.time : ''}</td></tr>`
    : '';

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
    <p style="color:#6B7280;margin:0 0 24px;font-size:15px">Hi ${meta.fullName}, thanks for booking with VVE Clean. Your £30 deposit is in and your slot is held.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E7EE;border-radius:8px;overflow:hidden;margin:0 0 24px">
      <tr style="background:#f7f8fa"><td colspan="2" style="padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8960c;font-weight:700">Your booking</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px;width:40%">Service</td><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${meta.service}</td></tr>
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Estimate</td><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${meta.price ? '£' + meta.price : '—'}</td></tr>
      ${dateRow}
      <tr><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px">Deposit paid</td><td style="padding:10px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">£30 ✓</td></tr>
    </table>
    <p style="color:#1e3a5f;font-size:14px;margin:0 0 24px">Our team will be in touch shortly to confirm your exact time. The £30 deposit comes off your final bill.</p>
    <a href="https://wa.me/447845451111" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">Message us on WhatsApp</a>
  </td></tr>
</table>
<p style="color:#9ca3af;font-size:11px;margin:16px 0 0;text-align:center">VVE Clean Ltd &middot; vveclean.co.uk &middot; 020 8050 2233</p>
</td></tr></table>
</body></html>`;
}

function businessEmailHtml(meta) {
  const rows = [
    ['Service', meta.service || '—'],
    ['Estimate', meta.price ? `£${meta.price}` : '—'],
    ['Full name', meta.fullName || '—'],
    ['Postcode', meta.postcode || '—'],
    ['Phone', meta.phone || '—'],
    ['Email', meta.email || '—'],
    ['Preferred date', meta.date ? `${meta.date}${meta.time ? ' at ' + meta.time : ''}` : '—'],
    ['Deposit', `£${meta.deposit || '30'}`],
    ['Notes', meta.message || '—'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#6B7280;font-size:14px;white-space:nowrap;width:35%">${k}</td>` +
        `<td style="padding:9px 16px;border-top:1px solid #E3E7EE;color:#020b24;font-weight:600;font-size:14px">${v}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f5f6f8;font-family:Arial,sans-serif;color:#1c1917">
  <h2 style="color:#020b24;margin:0 0 4px;font-family:Georgia,serif">New booking — ${meta.fullName}</h2>
  <p style="color:#6B7280;font-size:14px;margin:0 0 20px">${meta.service}</p>
  <table cellpadding="0" cellspacing="0" style="border:1px solid #E3E7EE;border-radius:8px;overflow:hidden;background:#fff;width:100%;max-width:560px">
    <tr style="background:#f7f8fa"><td colspan="2" style="padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8960c;font-weight:700">Booking details</td></tr>
    ${rows}
  </table>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    res.writeHead(400);
    return res.end(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const meta = event.data.object.metadata || {};

    try {
      const transport = makeTransport();
      const jobs = [];

      jobs.push(
        transport.sendMail({
          from: `"VVE Clean Bookings" <${process.env.GMAIL_SENDER}>`,
          to: process.env.BUSINESS_EMAIL,
          subject: `New booking — ${meta.fullName} — ${meta.service}`,
          html: businessEmailHtml(meta),
        }),
      );

      if (meta.email) {
        jobs.push(
          transport.sendMail({
            from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
            to: meta.email,
            subject: `Your VVE Clean booking is confirmed — ${meta.service}`,
            html: customerEmailHtml(meta),
          }),
        );
      }

      await Promise.all(jobs);
    } catch (err) {
      // Log but don't fail — returning non-200 would cause Stripe to retry
      console.error('Email send error:', err.message);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true }));
}
