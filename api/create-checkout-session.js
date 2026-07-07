import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computePrice } from './servicePrices.js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Parse YYYY-MM-DD → DDMMYY, or return today's date as DDMMYY if no date given
function isoToDDMMYY(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + m[2] + m[1].slice(2);
  const now = new Date();
  return String(now.getDate()).padStart(2, '0') +
         String(now.getMonth() + 1).padStart(2, '0') +
         String(now.getFullYear()).slice(2);
}

// Build POSTCODE+DDMMYY ref; append -1/-2 if the base already exists in the DB.
async function buildBookingRef(postcode, dateStr, supabase) {
  const pc = (postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!pc) return null;
  const dd = isoToDDMMYY(dateStr);

  const base = pc + dd;
  if (!supabase) return base;

  try {
    const { data } = await supabase
      .from('bookings')
      .select('booking_ref')
      .like('booking_ref', `${base}%`);

    const existing = new Set((data || []).map((r) => r.booking_ref));
    if (!existing.has(base)) return base;

    let n = 1;
    while (existing.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  } catch (e) {
    console.error('[checkout] buildBookingRef DB query failed:', e.message);
    return base;
  }
}

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

  const { service, price, deposit, fullName, address, postcode, phone, email, date, time, message, quoteConfig } =
    payload;

  // ── Server-side price validation ────────────────────────────────────────────
  let validatedPrice = Number(price) || 0;
  if (quoteConfig) {
    const serverPrice = computePrice(quoteConfig);
    if (serverPrice !== null) {
      if (Math.abs(serverPrice - validatedPrice) > 0.5) {
        console.warn('[checkout] Price mismatch — reported:', validatedPrice, '| server computed:', serverPrice, '| using server price');
      }
      validatedPrice = serverPrice;
    } else {
      console.warn('[checkout] computePrice returned null for quoteConfig — using reported price');
    }
  }

  console.log('[checkout] fullName:', fullName, 'phone:', !!phone, 'email:', !!email, 'service:', service, 'validatedPrice:', validatedPrice);

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

  // ── Build booking reference ─────────────────────────────────────────────
  const supabase = getSupabase();
  let bookingRef = null;
  try {
    bookingRef = await buildBookingRef(postcode, date, supabase);
  } catch (e) {
    console.error('[checkout] buildBookingRef failed:', e.message);
  }
  console.log('[checkout] booking ref:', bookingRef || '(will use session ID)');

  const successUrl =
    `${siteUrl}/confirmation.html` +
    `?ref=${bookingRef ? q(bookingRef) : '{CHECKOUT_SESSION_ID}'}`;

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
        service:     (service     || '').slice(0, 500),
        price:       String(validatedPrice),
        deposit:     deposit != null ? String(deposit) : '30',
        fullName:    (fullName    || '').slice(0, 500),
        address:     (address     || '').slice(0, 500),
        postcode:    (postcode    || '').slice(0, 500),
        phone:       (phone       || '').slice(0, 500),
        email:       (email       || '').slice(0, 500),
        date:        (date        || '').slice(0, 500),
        time:        (time        || '').slice(0, 500),
        message:     (message     || '').slice(0, 500),
        booking_ref: (bookingRef  || '').slice(0, 500),
      },
      success_url: successUrl,
      cancel_url:  `${siteUrl}/booking.html`,
    });

    console.log('[checkout] session created:', session.id);

    // Final ref: custom ref if generated, else fall back to Stripe session ID
    const finalRef = bookingRef || session.id;

    // ── Save pending booking to Supabase ──────────────────────────────────
    if (!supabase) {
      console.log('[checkout] SUPABASE_SERVICE_ROLE_KEY not set — skipping DB save');
    } else {
      try {
        const { error: dbErr } = await supabase.from('bookings').insert({
          booking_ref:       finalRef,
          stripe_session_id: session.id,
          payment_status:    'pending_payment',
          deposit_amount:    30,
          full_name:         fullName || null,
          email:             email    || null,
          phone:             phone    || null,
          address:           address  || null,
          postcode:          postcode || null,
          service:           service  || null,
          preferred_date:    date     || null,
          preferred_time:    time     || null,
          notes:             message  || null,
        });
        if (dbErr) {
          console.error('[checkout] Supabase insert error — code:', dbErr.code, '| message:', dbErr.message);
        } else {
          console.log('[checkout] Booking saved to Supabase as pending_payment, ref:', finalRef);
        }
      } catch (dbEx) {
        console.error('[checkout] Supabase unexpected error:', dbEx.message);
      }
    }

    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checkoutUrl: session.url }));
  } catch (err) {
    console.error('[checkout] Stripe API error:', err);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to create checkout session' }));
  }
}