import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

  const { service, price, deposit, fullName, postcode, phone, email, date, time, message } =
    payload;

  if (!fullName || (!phone && !email)) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'fullName and at least one of phone or email are required' }));
  }

  const siteUrl = (process.env.SITE_URL || 'https://vveclean.co.uk').replace(/\/$/, '');

  const q = (v) => encodeURIComponent(v || '');

  // {CHECKOUT_SESSION_ID} is a Stripe template literal — NOT URL-encoded.
  const successUrl =
    `${siteUrl}/confirmation.html` +
    `?name=${q(fullName)}` +
    `&email=${q(email)}` +
    `&phone=${q(phone)}` +
    `&service=${q(service)}` +
    `&price=${q(price)}` +
    `&date=${q(date)}` +
    `&ref={CHECKOUT_SESSION_ID}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
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
        service: (service || '').slice(0, 500),
        price: price != null ? String(price) : '',
        deposit: deposit != null ? String(deposit) : '30',
        fullName: (fullName || '').slice(0, 500),
        postcode: (postcode || '').slice(0, 500),
        phone: (phone || '').slice(0, 500),
        email: (email || '').slice(0, 500),
        date: (date || '').slice(0, 500),
        time: (time || '').slice(0, 500),
        message: (message || '').slice(0, 500),
      },
      success_url: successUrl,
      cancel_url: `${siteUrl}/booking.html`,
    });

    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checkoutUrl: session.url }));
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to create checkout session' }));
  }
}
