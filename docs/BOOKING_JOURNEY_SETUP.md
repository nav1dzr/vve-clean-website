# Direct booking confirmation and payment after cleaning

Updated 16 September 2026. No deposit is requested and payment does not confirm an appointment. This replaces the obsolete 8 September deposit/48-hour-hold setup guide. Historical transactions and their reconciliation remain intact.

## Owner workflow

1. Open the original request. Check the requested items and customer notes, agree the final price and set the actual appointment date and arrival window. The requested morning/afternoon window is a suggestion, not evidence of an agreed slot.
2. Review the suggested wording. Existing saved wording is preserved; **Fill empty wording from this request** fills only blanks. Scope and preparation are editable. Exclusions/access charges remain blank unless actually agreed. A phone/message shortcut records an internal note only when selected by staff. It never appears in the customer email.
3. Save and preview the email, then tick the availability/agreement check and select **Confirm booking and send email**. A first send directly confirms the booking with no payment. Inspect delivery status: a saved booking and a delivered email are different facts.
4. After the work, select **Mark clean completed and send balance**. The customer can open the same private page and pay the remaining balance by Stripe, or transfer it using the saved bank details. Stripe payment is recorded by a signed webhook, never by merely returning to the site. For bank payments, verify receipt in the bank first, then record the actual amount, method and transaction reference in CRM.

There is no need to write every confirmation in GPT. Suggestions use the request already held by the CRM, with a final human check. No customer data is sent to an AI service. Custom jobs still need their actual included work recorded: a template must not promise extras or guarantees.

The booking reference is the existing postcode + DDMMYY reference, with a suffix for collisions. Preserve it after rescheduling so earlier payments and correspondence still match. The displayed service date is updated independently. Do not regenerate existing references or use a new invoice number as a substitute for the customer’s transfer reference. A bank ledger transaction identifier is distinct from this shared customer reference, especially for instalments.

## Current live readiness finding

On 16 September the live authenticated CRM displayed “Booking management tables are unavailable” and disabled sending. This generic error can mean a missing table/column or access/configuration failure; it is not proof that a particular SQL migration has never run. Initial request email and Telegram delivery flags were present on a recent request, but those do not establish confirmation email readiness. No customer booking was edited or message sent during inspection.

Before applying anything, inspect the connected production database read-only and compare the expected schema/permissions. Existing connection notes identify `temlphabsqukkiqmrvhl` as the shared website/CRM database (bookings **and** invoices); reverify the current connection before a release. `spbrstpxrimuuorkbsbo` is the active VVE OS database and must not be repurposed as staging.

The prepared migration is `supabase/migrations/20260908100000_booking_journey.sql`. It creates four private tables (`booking_journeys`, `booking_journey_events`, `booking_journey_messages`, `booking_journey_payments`), reminder columns and the atomic `apply_booking_journey` function. It does not backfill existing bookings. Anonymous and normal signed-in users cannot access these tables directly; authenticated server endpoints use service credentials. Do not create ad hoc tables manually in the dashboard. Review the existing schema before applying the exact migration to its intended project.

Applying production schema/configuration and deploying this release require specific owner approval under AGENTS.md. Earlier approval covered media publishing, media references and invoice integrity; it did not name this booking migration. The unrelated website refinement commit remains a separate release decision.

## Configuration and delivery checks

Use an isolated test database shared only by test website and test CRM for provider-connected tests. Neither active project above is staging. Local unit/API tests mock email and Stripe; the SQL runner below uses an in-memory database with no credentials.

| Configuration | Purpose and check |
|---|---|
| `VVE_PREVIEW_ISOLATION_APPROVED=true` / `VVE_PREVIEW_SUPABASE_PROJECT_REF` | Hosted previews must name a reviewed separate test project. Active projects are rejected. |
| `VVE_PREVIEW_TEST_EMAIL` | Explicitly approved test inbox. Hosted preview messages are redirected here. |
| `BOOKING_JOURNEY_ENABLED` | Keep disabled until schema, permissions and delivery tests pass. Configure both CRM and customer website. |
| `BOOKING_JOURNEY_MODE` | `test` in staging; unset also means test. Production delivery requires a separately approved `live` setting. A live-looking page in test mode still sends to the test inbox. Hosted previews reject live mode. |
| `BOOKING_JOURNEY_TOKEN_SECRET` | Identical 32+ character server-only secret in website and CRM. Rotation invalidates private customer links. Never expose it as a browser variable. |
| `BOOKING_JOURNEY_SITE_URL` | Customer website HTTPS origin for the environment, not the CRM origin. |
| `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Correct shared database in both projects. Keep service credentials server-only. Any alternate `SUPABASE_URL` must agree. |
| `GMAIL_SENDER` / `GMAIL_APP_PASSWORD` / `BUSINESS_EMAIL` | Existing Nodemailer/Gmail delivery configuration. Verify the business/reply inbox and a controlled confirmation message. Do not replace the working request email or Telegram setup. |
| `BOOKING_JOURNEY_TEST_EMAIL` | Approved local/unhosted test inbox; hosted previews use `VVE_PREVIEW_TEST_EMAIL` instead. Test subjects are prefixed `[TEST]`. |
| `STRIPE_SECRET_KEY` | Test key in staging. Verify the correct account and production key before enabling production collection. Never expose a secret in browser code. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the correct website webhook endpoint and environment. Verify signed event delivery and duplicate-event handling. |
| `INVOICE_BANK_ACCOUNT_NAME` / `INVOICE_BANK_SORT_CODE` / `INVOICE_BANK_ACCOUNT_NUMBER` | Existing server-side invoice settings reused by booking confirmations. Confirm all three with the owner. Invalid/incomplete details are omitted, never guessed. New agreements save these details into their reviewed snapshot. Existing agreements/emails are not silently changed when settings change. |
| `BOOKING_JOURNEY_WORKER_SECRET` | Separate 32+ character website-only secret for the queued-email/reminder worker. A scheduler is not automatically installed. |

The bank-transfer reference in this journey is the existing booking reference, rather than free-text invoice reference instructions. The actual bank account has not been verified by the 16 September read-only CRM inspection. Do not ask the owner to paste Stripe secret keys or passwords into chat.

## Stripe and bank behaviour

The current backend creates booking-specific **Stripe Checkout Sessions** automatically for the remaining balance after completion. There is no per-booking Dashboard product/payment-link creation step. Sessions last 23 hours; the customer’s stable private booking link can open a fresh session when the previous one expires. That private link is different from a raw Stripe URL. No 48-hour deposit expiry applies.

Do not enable pre-clean collection without a separate decision: confirmed appointments currently have no checkout button and the API rejects pre-clean checkout. Existing paid deposits and legacy webhook paths remain for historical reconciliation. The new invoice default is “Payment is due after the clean”; existing invoices and explicit agreed terms are retained.

Use a separate Stripe test webhook for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. Confirm the deployed webhook accepts the intended signed journey events. Do not recreate/delete the live Stripe account, change historical transactions or blindly replace existing webhook subscriptions. A browser success page is not proof of payment.

The separate invoice module currently accepts a manually supplied Stripe link; it is not the booking journey’s automatic checkout generator. Issued invoices and booking payment records have separate ledgers. Before producing a formal receipt/invoice for a journey payment, reconcile those existing records so money is not counted twice. Automatic invoice-ledger synchronisation is not claimed by this release.

Bank transfer is manual reconciliation. There is no automatic bank feed and no customer “I have paid” button that credits the ledger. A cancelled, revised-awaiting-acceptance, unsent or fully settled booking must not display bank instructions as a new demand to pay.

## Limits and activation tests

The existing journey can initialise an unpaid request in `new` status. It deliberately rejects historic paid, already scheduled/confirmed, closed or settled bookings without a journey. Do not reset those bookings to `new` to bypass that protection. Any migration/adoption workflow for them needs its own review; keep their existing record and communication process meanwhile.

Read-only GET must not create a journey. Save/preview must not send an email. Sending must require reviewed saved details and explicit staff confirmation. Test initial confirmation, a revision with customer acceptance, reschedule request, cancellation, completion, card settlement, duplicate webhooks, partial bank payment and retry after email failure with synthetic records. Verify mobile presentation. Production customer sends still require the owner's selection of the actual recipients and agreed details.

The worker is authenticated POST `/api/booking-management?action=process-due`; it can send queued messages, so never run it as a read-only diagnostic. Test it first in isolation. Current new bookings have no deposit reminders; retained legacy expiry code is historical. Day-before reminders use London calendar dates and the last accepted appointment. Do not claim reminders are scheduled until a scheduler has actually been configured and verified.

Run the current SQL migration checks with an already installed PGlite module:

```sh
node scripts/validate-booking-journey-db.mjs --pglite /path/to/pglite/dist/index.js
```

The runner applies the migration twice to an isolated in-memory database and checks actual SQL permissions, revision conflicts, rollback and payment deduplication. It does not read production credentials. Provider-connected staging, real SMTP delivery to the approved test inbox and a Stripe test-card/webhook round trip remain separate checks.

Official Stripe references: [Checkout session creation and expiration](https://docs.stripe.com/api/checkout/sessions/create), [Checkout flow](https://docs.stripe.com/payments/checkout/how-checkout-works).
