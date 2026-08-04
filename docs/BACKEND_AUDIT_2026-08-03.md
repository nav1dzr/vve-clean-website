# Protected backend findings — audit only

Six payments/backend findings were re-verified against the code on
`origin/main` at `bd4377e`. **Nothing in this area was changed.** No Stripe
behaviour, no Supabase schema, no pricing, no production data, no customer
communication.

Ordered by what it costs the business.

---

## 1. No refund handling — **still true**

**Evidence.** `api/stripe-webhook.js:554`:

```js
if (event.type !== 'checkout.session.completed') {
  console.log('[webhook] ignoring event:', event.type);
```

`checkout.session.completed` is the only event processed. `charge.refunded`,
`charge.dispute.created` and `payment_intent.canceled` are all discarded.

**Impact.** A refunded £30 deposit stays `payment_status: 'paid'` in the CRM
forever. Staff see a paid booking that is not paid; revenue reporting
overstates; a disputed charge produces no signal at all. Silent and permanent.

**Safest fix.** Extend the existing event switch to handle `charge.refunded`,
resolve the booking via `stripe_payment_intent_id` (already stored — see
`DETAIL_SELECT` in `admin/api/_lib/bookingFields.js`), and write a new
`payment_status` value. Reuses the existing `claimStripeEvent` idempotency
guard, so Stripe retries stay safe.

**Touches:** Stripe (new event subscription), Supabase (new `payment_status`
value — `PAYMENT_STATUS_VALUES` would need `'refunded'`), production data
(status of existing rows changes as refunds arrive). **Not customer-facing.**

---

## 2. No rate limiting on public endpoints — **still true**

**Evidence.** No limiter of any kind in `api/` — no `rateLimit`, no `throttle`,
no Upstash/Redis. `api/create-checkout-session.js` and `api/contact.js` are
both unauthenticated and callable directly.

**Impact.** `create-checkout-session` writes a `pending_payment` booking row
*and* creates a real Stripe Checkout Session on every call. A trivial script
fills the bookings table with junk, pollutes the CRM and the dashboard counts,
and burns Stripe API quota. `contact.js` sends email on every call — the same
Gmail account everything else depends on (see finding 6), so contact-form spam
can exhaust the quota that customer confirmations rely on.

**Safest fix.** Per-IP limits at the edge, tightest on the two write
endpoints. Vercel's built-in firewall rules need no code. If done in code, do
it as a shared wrapper so limits cannot drift per route.

**Touches:** neither Stripe nor Supabase if done at the edge. No pricing, no
production data. Low risk, high value — **the best value of the six.**

---

## 3. Duplicate checkout submission — **partly resolved; weaker than the audit states**

**Evidence.** `src/pages/BookingPage.tsx` already guards the client:

```
337:  const [submitting, setSubmitting] = useState(false);
444:  setSubmitting(true);
907:  <button type="submit" disabled={submitting}
```

So double-clicking the button does *not* create two sessions. What remains
missing is **server-side** idempotency: two rapid requests from different tabs,
a retry after a flaky connection, or any direct API call still create two rows
and two Stripe sessions.

**Impact.** Much lower than the audit implies. The realistic residue is a
duplicate `pending_payment` row from a genuine double-navigation. Unpaid
duplicates are noise, not lost money — the customer pays once.

**Safest fix.** An idempotency key derived from the booking payload, checked
before insert; or pass Stripe's own `Idempotency-Key` header.

**Touches:** Stripe (idempotency header) and Supabase (a lookup, or a unique
index). **Recommend deferring** — cost/benefit is poor next to findings 1 and 2.

---

## 4. No service-area/postcode gate — **still true**

**Evidence.** `api/create-checkout-session.js` uses `postcode` only to build the
booking reference (`buildBookingRef`, line 30) and to store it (lines 323, 375).
It is never checked against the covered postcodes — which *do* exist, listed in
`index.html`'s `areaServed` (E1–E20, N1–N22, NW1…).

**Impact.** Anyone in any UK postcode can pay a £30 deposit for an area VVE
does not serve. Each one is a manual refund, an awkward conversation and a
likely negative review — the exact metric item 9 is trying to improve.

**Safest fix.** Validate the outward code server-side against a shared covered
list, and return a clear "we don't cover that postcode yet" before any Stripe
session is created. The list should be one source shared with `Areas.tsx` and
the structured data, which currently duplicate it.

**Touches:** no Stripe, no schema, no pricing. It *does* change customer-facing
behaviour — some bookings would be refused that currently succeed — so it needs
an explicit business decision on the exact boundary, and probably a "request an
area we don't cover" path rather than a hard stop.

---

## 5. Stripe invoice payment links never auto-reconcile — **still true**

**Evidence.** `admin/api/` contains no webhook route at all — no
`invoice.paid`, no `payment_intent.succeeded` handler. The public
`api/stripe-webhook.js` handles only booking deposits, not admin-issued
invoices.

**Impact.** Every invoice paid by Stripe link must be spotted in the Stripe
dashboard and recorded by hand in the CRM. Slow, and it silently drifts: an
invoice can be paid and still show outstanding, so chasing emails go to
customers who have already paid.

**Safest fix.** An admin-side Stripe webhook handling `invoice.paid` /
`checkout.session.completed` for invoice sessions, reusing
`invoiceLifecycle.js` to mark paid and generate the receipt. Must reuse the
`claimStripeEvent` idempotency pattern.

**Touches:** Stripe (new endpoint + signing secret on the admin project),
Supabase (invoice/payment rows), production data, and customer communication
(receipt emails would start sending automatically). **The heaviest of the six**
— needs its own branch and a staged rollout.

---

## 6. All email on one Gmail account — **still true**

**Evidence.** Three separate transports, all `service: 'gmail'`:

| File | Line | Sends |
|---|---|---|
| `api/contact.js` | 40 | Contact-form enquiries |
| `api/stripe-webhook.js` | 197 | Booking confirmations (customer + business) |
| `admin/api/_lib/mailer.js` | 12 | Invoices and receipts |

Two env pairs (`GMAIL_SENDER`/`GMAIL_APP_PASSWORD`, plus `BUSINESS_EMAIL`), but
one provider and, in practice, one mailbox.

**Impact.** Gmail's sending limits and spam reputation are a single point of
failure across booking confirmations, business alerts, invoices and receipts.
If it trips, a customer pays £30 and receives nothing — and `sendMail` returns
`{ ok: false }` rather than throwing, so failures are logged and swallowed. The
booking is safe (the DB write precedes the email, which is right), but nobody is
told.

**Safest fix.** Move to a transactional provider with delivery webhooks
(Postmark/Resend/SES). Failing that — the cheap 80% — surface send failures: the
booking row already has `email_customer_sent` / `email_business_sent` flags, so
a CRM view of "paid bookings where the confirmation did not send" needs no
schema change at all.

**Touches:** the failure-visibility version touches nothing protected — it is a
read-only CRM view over existing columns. Changing provider touches
production email configuration and should be staged.

---

## Recommended order

| # | Finding | Effort | Why first |
|---|---|---|---|
| 1 | Rate limiting (2) | Hours | Cheapest, touches nothing protected, closes an open write endpoint |
| 2 | Email failure visibility (6, partial) | Hours | Read-only view over existing columns; turns a silent failure into a visible one |
| 3 | Refund handling (1) | ~1 day | Only finding where the CRM actively shows something false |
| 4 | Postcode gate (4) | ~1 day + business decision | Stops refunds at source |
| 5 | Invoice reconciliation (5) | Own branch | Highest value to staff time, highest blast radius |
| 6 | Server-side idempotency (3) | Defer | Client guard already covers the realistic case |

Findings 1, 4, 5 and 6 all change Stripe, Supabase, production data or customer
communication, and none was implemented here.
