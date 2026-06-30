# Stripe Payment Setup

## Environment variables

Add these to **Vercel → Project → Settings → Environment Variables** (all environments):

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret |
| `GMAIL_SENDER` | The Gmail address you want to send from |
| `GMAIL_APP_PASSWORD` | Google Account → Security → 2-Step Verification → App passwords → create one |
| `BUSINESS_EMAIL` | Where you want new-booking alerts delivered |
| `SITE_URL` | `https://vveclean.co.uk` (for production) |

> **Test vs live keys** — the keys currently in `.env` start with `sk_live_` / `pk_live_` (live mode).  
> Use `sk_test_` / `pk_test_` keys for local testing so no real money is charged.  
> Swap to live keys in Vercel once you're ready to go live.

---

## Running locally

```bash
npm run dev          # starts Vite on http://localhost:5173
```

The Vite dev server does NOT run Vercel serverless functions. To test the API locally you need the Vercel CLI:

```bash
npm i -g vercel
vercel dev           # runs at http://localhost:3000 — serves static + /api/* functions
```

Update `SITE_URL=http://localhost:3000` in `.env` while testing with `vercel dev`.

---

## Testing payments with Stripe test cards

Use test-mode keys (`sk_test_…` / `pk_test_…`) and any of these card numbers on the Stripe Checkout page:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0025 0000 3155` | 3D Secure required |
| `4000 0000 0000 9995` | Card declined |

Any future expiry date and any 3-digit CVC work.

---

## Testing the webhook locally with Stripe CLI

1. Install: https://stripe.com/docs/stripe-cli
2. Log in: `stripe login`
3. Start forwarding (in a separate terminal while `vercel dev` is running):

```bash
stripe listen --forward-to http://localhost:3000/api/stripe-webhook
```

This prints a signing secret like `whsec_…` — copy it into `.env` as `STRIPE_WEBHOOK_SECRET`.

4. Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

You should see the webhook hit, emails fire, and a `200` response logged.

---

## Registering the production webhook

Once deployed to Vercel:

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://vveclean.co.uk/api/stripe-webhook`
3. Events to listen for: `checkout.session.completed`
4. Copy the **Signing secret** → add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`

---

## Flow summary

```
User fills /booking.html
    ↓
POST /api/create-checkout-session  (sends service, name, price, etc.)
    ↓
Stripe Checkout page  (user pays £30)
    ↓
Stripe redirects → /confirmation.html?name=…&ref={session_id}
    ↓ (async)
Stripe POST /api/stripe-webhook  (checkout.session.completed)
    ↓
nodemailer sends two emails: customer confirmation + business alert
```
