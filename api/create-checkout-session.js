import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

const ALLOWED_ORIGINS = [
  process.env.SITE_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

function corsHeaders(origin) {
  const use = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*');
  return {
    'Access-Control-Allow-Origin': use,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function readBody(req) {
  // If Vercel or a middleware already buffered the body, use it directly.
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  // Otherwise read the raw stream (standard Vercel non-Next.js behaviour).
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  // ── Diagnostic: key presence & method ──────────────────────────────────
  console.log('[checkout] method:', req.method);
  console.log('[checkout] key present:', !!process.env.STRIPE_SECRET_KEY);
  console.log('[checkout] key prefix:', (process.env.STRIPE_SECRET_KEY || '').slice(0, 7));

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // ── Guard: env var must be present ─────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[checkout] STRIPE_SECRET_KEY is not set');
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Server misconfiguration: missing Stripe key' }));
  }

  // Initialise Stripe inside the handler so a missing key causes a clean 500
  // with a logged message rather than a silent module-load crash.
  let stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.error('[checkout] Stripe init failed:', err);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Stripe initialisation failed: ' + err.message }));
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let payload;
  try {
    const raw = await readBody(req);
    console.log('[checkout] raw body length:', raw.length, 'first 120 chars:', raw.slice(0, 120));
    payload = JSON.parse(raw);
  } catch (err) {
    console.error('[checkout] Body parse error:', err);
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid request body: ' + err.message }));
  }

  const { service, price, deposit, fullName, postcode, phone, email, date, time, message } =
    payload;

  console.log('[checkout] fullName:', fullName, 'phone:', !!phone, 'email:', !!email, 'service:', service, 'price:', price);

  if (!fullName || (!phone && !email)) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'fullName and at least one of phone or email are required' }));
  }

  // ── Resolve a SAFE site URL ─────────────────────────────────────────────
  // Extract the first clean http(s) URL from SITE_URL. This survives pasted
  // markdown like "[https://site](https://site)", stray spaces, or brackets.
  const extractUrl = (v) => {
    const m = String(v || '').match(/https?:\/\/[^\s\]\)<>"']+/);
    return m ? m[0].replace(/\/+$/, '') : '';
  };

  let siteUrl = extractUrl(process.env.SITE_URL);

  // Validate it. If it's missing, malformed, or localhost, fall back to the
  // real request host — always correct on Vercel, and needs no env config.
  let validSite = false;
  try { if (siteUrl) { new URL(siteUrl); validSite = true; } } catch { validSite = false; }
  if (!validSite || siteUrl.includes('localhost')) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host'] || req.headers.host || 'vveclean.co.uk';
    siteUrl = `${proto}://${host}`;
  }

  console.log('[checkout] siteUrl:', siteUrl);
  const q = (v) => encodeURIComponent(v || '');

  // {CHECKOUT_SESSION_ID} is a Stripe template literal — must NOT be URL-encoded.
  const successUrl =
    `${siteUrl}/confirmation.html` +
    `?name=${q(fullName)}` +
    `&email=${q(email)}` +
    `&phone=${q(phone)}` +
    `&service=${q(service)}` +
    `&price=${q(price)}` +
    `&date=${q(date)}` +
    `&ref={CHECKOUT_SESSION_ID}`;

  // ── Create Checkout Session ─────────────────────────────────────────────
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Booking deposit — ${service || 'Cleaning service'}`,
              description: 'Secures your slot. The £30 deposit comes off your final bill.',
            },
            unit_amount: 3000,
          },
          quantity: 1,
        },
      ],
      ...(email ? { customer_email: email } : {}),
      metadata: {
        service:  (service  || '').slice(0, 500),
        price:    price != null ? String(price) : '',
        deposit:  deposit  != null ? String(deposit) : '30',
        fullName: (fullName || '').slice(0, 500),
        postcode: (postcode || '').slice(0, 500),
        phone:    (phone    || '').slice(0, 500),
        email:    (email    || '').slice(0, 500),
        date:     (date     || '').slice(0, 500),
        time:     (time     || '').slice(0, 500),
        message:  (message  || '').slice(0, 500),
      },
      success_url: successUrl,
      cancel_url:  `${siteUrl}/booking.html`,
    });

    console.log('[checkout] session created:', session.id);
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checkoutUrl: session.url }));
  } catch (err) {
    console.error('[checkout] Stripe API error:', err);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to create checkout session' }));
  }
}