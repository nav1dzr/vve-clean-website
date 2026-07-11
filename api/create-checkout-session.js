import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { computePrice } from './servicePrices.js';

export const config = { api: { bodyParser: false } };

// Maximum raw request body size — protects against memory exhaustion.
const MAX_BODY_BYTES = 64 * 1024; // 64 KB

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

// CORS: only allow known origins. Never fall back to wildcard '*'.
const ALLOWED_ORIGINS = [
  process.env.SITE_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function readBody(req) {
  // If Vercel or middleware already buffered the body, use it directly.
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy(new Error('Request body too large'));
        return reject(new Error('Request body too large'));
      }
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const origin  = req.headers.origin || '';
  const headers = corsHeaders(origin);

  console.log('[checkout] method:', req.method, '| key present:', !!process.env.STRIPE_SECRET_KEY);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[checkout] STRIPE_SECRET_KEY is not set');
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Server misconfiguration: missing Stripe key' }));
  }

  let stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.error('[checkout] Stripe init failed:', err.message);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Stripe initialisation failed' }));
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw);
  } catch (err) {
    console.error('[checkout] Body parse error:', err.message);
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid request body: ' + err.message }));
  }

  const {
    service, price, deposit, fullName, address, postcode, phone, email, date, time, message, quoteConfig,
    offer_code, discount_percent, standard_total, discount_amount, final_total_after_discount,
    first_source, last_source, landing_page,
    utm_source, utm_medium, utm_campaign, utm_content, gclid,
  } = payload;

  // ── Server-side price authority ─────────────────────────────────────────────
  // quoteConfig is always required. Browser-supplied price is never trusted.
  // Two valid outcomes:
  //   fixed_quote  — computePrice returned a number; server price is authoritative
  //   manual_quote — delicate carpet condition; photo quote required; price is null
  // Any other path (missing quoteConfig, unrecognised service) → HTTP 400.

  if (!quoteConfig) {
    console.warn('[checkout] Rejected: quoteConfig absent (possible legacy URL exploit)');
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'quoteConfig is required' }));
  }

  // Only this specific configuration is an approved manual-quote path.
  // The browser cannot manufacture a manual quote by omitting quoteConfig
  // or using an arbitrary service name.
  function isApprovedManualQuote(cfg) {
    return cfg &&
      cfg.service === 'deep' &&
      cfg.deepService === 'carpet_upholstery' &&
      cfg.carpetCondition === 'delicate';
  }

  let validatedPrice = null;
  let quoteMode;

  const serverPrice = computePrice(quoteConfig);
  if (serverPrice !== null) {
    quoteMode = 'fixed_quote';
    validatedPrice = serverPrice;
    const clientPrice = Number(price) || 0;
    if (clientPrice && Math.abs(serverPrice - clientPrice) > 0.5) {
      console.warn('[checkout] Price mismatch — client reported:', clientPrice,
        '| server computed:', serverPrice, '| using server price');
    }
  } else if (isApprovedManualQuote(quoteConfig)) {
    quoteMode = 'manual_quote';
    // validatedPrice stays null — confirmation shows "Quote to be confirmed"
  } else {
    console.warn('[checkout] Rejected: computePrice returned null for non-manual-quote service');
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid service configuration' }));
  }

  console.log('[checkout] service:', service || '(none)',
    '| quoteMode:', quoteMode,
    '| validatedPrice:', validatedPrice !== null ? validatedPrice : '(manual quote)');

  if (!fullName || (!phone && !email)) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'fullName and at least one of phone or email are required' }));
  }

  // ── Resolve a SAFE site URL ─────────────────────────────────────────────────
  const extractUrl = (v) => {
    const m = String(v || '').match(/https?:\/\/[^\s\]\)<>"']+/);
    return m ? m[0].replace(/\/+$/, '') : '';
  };

  let siteUrl = extractUrl(process.env.SITE_URL);
  let validSite = false;
  try { if (siteUrl) { new URL(siteUrl); validSite = true; } } catch { validSite = false; }
  if (!validSite || siteUrl.includes('localhost')) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host'] || req.headers.host || 'vveclean.co.uk';
    siteUrl = `${proto}://${host}`;
  }

  console.log('[checkout] siteUrl:', siteUrl);
  const q = (v) => encodeURIComponent(v || '');

  // ── Build booking reference ─────────────────────────────────────────────────
  const supabase = getSupabase();
  let bookingRef = null;
  try {
    bookingRef = await buildBookingRef(postcode, date, supabase);
  } catch (e) {
    console.error('[checkout] buildBookingRef failed:', e.message);
  }
  console.log('[checkout] booking ref:', bookingRef || '(will use session ID)');

  // ── Generate confirmation token ─────────────────────────────────────────────
  // 32 random bytes = 64 hex chars = ~192 bits of entropy.
  // The token is included in the success URL so the confirmation page can
  // fetch booking details without exposing the guessable booking reference.
  const confirmationToken = randomBytes(32).toString('hex');

  // Success URL includes ref (human-readable), token (secure lookup key), and
  // sid (Stripe session ID fallback for when DB row is missing).
  const successUrl =
    `${siteUrl}/confirmation.html` +
    `?ref=${bookingRef ? q(bookingRef) : '{CHECKOUT_SESSION_ID}'}` +
    `&token=${q(confirmationToken)}` +
    `&sid={CHECKOUT_SESSION_ID}`;

  // ── Create Checkout Session ─────────────────────────────────────────────────
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
        service:                    (service     || '').slice(0, 500),
        price:                      validatedPrice !== null ? String(validatedPrice) : '',
        quote_mode:                 quoteMode,
        deposit:                    deposit != null ? String(deposit) : '30',
        fullName:                   (fullName    || '').slice(0, 500),
        address:                    (address     || '').slice(0, 500),
        postcode:                   (postcode    || '').slice(0, 500),
        phone:                      (phone       || '').slice(0, 500),
        email:                      (email       || '').slice(0, 500),
        date:                       (date        || '').slice(0, 500),
        time:                       (time        || '').slice(0, 500),
        message:                    (message     || '').slice(0, 500),
        booking_ref:                (bookingRef  || '').slice(0, 500),
        confirmation_token:         confirmationToken,
        // Offer / discount
        offer_code:                 (offer_code  || '').slice(0, 500),
        discount_percent:           discount_percent != null ? String(discount_percent) : '',
        standard_total:             standard_total   != null ? String(standard_total)   : '',
        discount_amount:            discount_amount  != null ? String(discount_amount)  : '',
        final_total_after_discount: final_total_after_discount != null ? String(final_total_after_discount) : '',
        // Attribution
        first_source:               (first_source || '').slice(0, 500),
        last_source:                (last_source  || '').slice(0, 500),
        landing_page:               (landing_page || '').slice(0, 500),
        utm_source:                 (utm_source   || '').slice(0, 500),
        utm_medium:                 (utm_medium   || '').slice(0, 500),
        utm_campaign:               (utm_campaign || '').slice(0, 500),
        utm_content:                (utm_content  || '').slice(0, 500),
        gclid:                      (gclid        || '').slice(0, 500),
      },
      success_url: successUrl,
      cancel_url:  `${siteUrl}/booking.html`,
    });

    console.log('[checkout] session created:', session.id, '| ref:', bookingRef || session.id);

    const finalRef = bookingRef || session.id;

    // ── Save pending booking to Supabase ──────────────────────────────────────
    if (!supabase) {
      console.log('[checkout] Supabase not configured — skipping DB save');
    } else {
      try {
        const { error: dbErr } = await supabase.from('bookings').insert({
          booking_ref:        finalRef,
          stripe_session_id:  session.id,
          payment_status:     'pending_payment',
          deposit_amount:     30,
          confirmation_token: confirmationToken,
          full_name:          fullName || null,
          email:              email    || null,
          phone:              phone    || null,
          address:            address  || null,
          postcode:           postcode || null,
          service:            service  || null,
          preferred_date:     date     || null,
          preferred_time:     time     || null,
          notes:              message  || null,
        });
        if (dbErr) {
          console.error('[checkout] Supabase insert error — code:', dbErr.code, '| message:', dbErr.message);
        } else {
          console.log('[checkout] Booking saved to Supabase as pending_payment, ref:', finalRef);

          if (last_source || offer_code) {
            const { error: attrErr } = await supabase.from('bookings').update({
              offer_code:                 offer_code                 || null,
              discount_percent:           discount_percent           ?? null,
              standard_total:             standard_total             ?? null,
              discount_amount:            discount_amount            ?? null,
              final_total_after_discount: final_total_after_discount ?? null,
              first_source:               first_source               || null,
              last_source:                last_source                || null,
              landing_page:               landing_page               || null,
              utm_source:                 utm_source                 || null,
              utm_medium:                 utm_medium                 || null,
              utm_campaign:               utm_campaign               || null,
              utm_content:                utm_content                || null,
              gclid:                      gclid                      || null,
            }).eq('booking_ref', finalRef);
            if (attrErr) {
              console.warn('[checkout] Attribution update skipped:', attrErr.code, attrErr.message);
            } else {
              console.log('[checkout] Attribution saved to Supabase');
            }
          }
        }
      } catch (dbEx) {
        console.error('[checkout] Supabase unexpected error:', dbEx.message);
      }
    }

    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checkoutUrl: session.url }));
  } catch (err) {
    console.error('[checkout] Stripe API error:', err.message);
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to create checkout session' }));
  }
}
