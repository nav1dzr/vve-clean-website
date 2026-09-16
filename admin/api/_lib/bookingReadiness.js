import { timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { isHostedPreview } from './previewIsolation.js';

export function isBookingWorker(req) {
  const expected = process.env.BOOKING_JOURNEY_WORKER_SECRET || '';
  const actual = String(req.headers.authorization || '').replace(/^Bearer /, '');
  return expected.length >= 32 && Buffer.byteLength(actual) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

// Private activation check: no customer/database reads or writes, no charges,
// and notifications can only go to the configured owner destinations.
export async function bookingReadiness({ notify = false } = {}) {
  if (isHostedPreview()) throw new Error('Production readiness checks are not available on previews');
  const result = { signingKey: (process.env.BOOKING_JOURNEY_TOKEN_SECRET || '').length >= 32 };
  const check = async (name, action) => {
    try { result[name] = await action(); }
    catch { result[name] = { ok: false }; }
  };
  await check('stripe', async () => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 8000, maxNetworkRetries: 0 });
    const account = await stripe.accounts.retrieve();
    const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const hook = hooks.data.find(x => x.status === 'enabled' && x.url === 'https://www.vveclean.co.uk/api/stripe-webhook'
      && (x.enabled_events.includes('checkout.session.completed') || x.enabled_events.includes('*')));
    return { ok: Boolean(hook && account.charges_enabled), account: account.id, chargesEnabled: account.charges_enabled,
      webhookRegistered: Boolean(hook), signingSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET) };
  });
  await check('email', async () => {
    if (!process.env.GMAIL_SENDER || !process.env.GMAIL_APP_PASSWORD || !process.env.BUSINESS_EMAIL) throw new Error('Missing settings');
    const mail = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_SENDER, pass: process.env.GMAIL_APP_PASSWORD }, connectionTimeout: 8000, socketTimeout: 10000 });
    await mail.verify();
    if (notify) await mail.sendMail({ from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`, to: process.env.BUSINESS_EMAIL,
      subject: '[TEST ONLY] VVE booking connection check',
      text: 'Booking email connection verified. This is a system test, not a booking or payment request. No customer has been contacted.',
      html: '<div style="font-family:Arial,sans-serif;max-width:560px;padding:32px;background:#f3f8fc;color:#07152b"><h1 style="color:#006e9d">VVE CLEAN</h1><h2>Booking email connection verified</h2><p>This is a system test, not a booking or payment request.</p><p>No customer has been contacted. No payment has been taken.</p></div>' });
    return { ok: true, notificationSent: notify };
  });
  await check('telegram', async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) throw new Error('Missing settings');
    const method = notify ? 'sendMessage' : 'getChat';
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, ...(notify ? { text: '[TEST ONLY] VVE booking notifications connected. No customer contacted. No booking or payment created.' } : {}) }), signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    return { ok: response.ok && body.ok === true, notificationSent: notify && body.ok === true };
  });
  result.bankConfigured = Boolean(process.env.INVOICE_BANK_ACCOUNT_NAME && /^\d{6}$/.test((process.env.INVOICE_BANK_SORT_CODE || '').replace(/[ -]/g, '')) && /^\d{8}$/.test((process.env.INVOICE_BANK_ACCOUNT_NUMBER || '').replace(/ /g, '')));
  return result;
}
