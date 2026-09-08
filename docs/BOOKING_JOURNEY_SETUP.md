# Agreed booking and £30 deposit journey

Implementation date: 8 September 2026. Initial website requests remain free. The £30 deposit is requested only after staff agree the scope, total, date and arrival window. No production data, payments or customer email were used during implementation.

## What is implemented

The existing CRM booking detail now contains **Arrange and confirm this booking**. Staff can save a draft agreement with service, included items/quantities, scope, exclusions/access costs, total, address, date, arrival window, preparation instructions and an internal reason. Saving does not replace the customer's current offer. Sending saves an immutable version and its email to an atomic outbox. The preview and send use the same reviewed payment deadline. Agreement policy version is `2026-09-08`; catalogue changes cannot alter its stored total.

A free request becomes an unpaid provisional offer. The default hold is 48 hours. Near-term jobs require an explicit deadline before the arrival window; times are checked in Europe/London, including daylight saving. Staff must attest that they checked actual availability. This is a staff-operated calendar workflow, not an automatic capacity allocation engine.

The customer receives `/manage-booking#token=...`, a signed, revocable private link. The fragment is removed from the address bar and retained only for that browser tab. API requests use an Authorization header. GET only reads; pay/reschedule/cancel/accept all use POST. The route must remain excluded from analytics, tracking pixels and indexing.

Pay opens one booking-specific, card-only Stripe Checkout Session for £30. Each session lasts at most 23 hours and never beyond the business hold. A fresh session can be opened within the original 48-hour hold when an earlier session expires. No checkout opens in the final 31 minutes: Stripe's minimum session lifetime would make an exact cutoff unsafe. Customers are directed to ask staff to renew the hold. Stripe's signed webhook and the payment ledger, not a browser return, confirm payment. The same £30 is credited towards the total. Existing historic deposit webhooks retain their original path.

Updates to paid bookings preserve the original appointment until the customer accepts the revised agreement. A rescheduling request records the requested date/window and alerts both the customer and staff; it does not silently move or cancel the appointment. Cancellation closes any open checkout first and sends customer/staff acknowledgement. It never invents a cancellation fee or automatically refunds money. Refund events are recorded independently; a refund on a non-cancelled job puts it into staff payment review rather than automatically requesting the refunded money again.

After completion, staff can send the remaining-balance request or record an actual cash/bank/card payment with amount, method and unique reference. Partial payments are supported. Payment acknowledgements show the total, money paid/refunded and remaining amount. The existing invoice/receipt module remains available for formal accounting documents; issued documents are not silently rewritten. Use the recorded deposit and booking total when preparing documents, and reconcile any previously issued invoice through its existing correction/payment workflow.

## Test setup — do not enable live collection before validation

First follow the [deployment isolation requirements](website-completion-2026-09-08/deployment-isolation-readiness.md). Use a **separate, reviewed test Supabase project**, shared only by the test website and test CRM, with synthetic bookings and test users. Neither active project (`temlphabsqukkiqmrvhl` or `spbrstpxrimuuorkbsbo`) is an acceptable test target. Apply `supabase/migrations/20260908100000_booking_journey.sql` there only after the base CRM schema is available. It creates four service-role-only tables and one atomic mutation function; it does not backfill, modify or charge existing bookings.

Hosted previews remain read-only until all isolation checks pass. Configure both **test deployment projects** as follows. Secrets belong only in server configuration; the Supabase project URL is also used by the existing browser configuration.

| Setting | Required value / purpose |
|---|---|
| `VVE_PREVIEW_ISOLATION_APPROVED` | Exact string `true` only after the separate test resources and recipients have been reviewed. |
| `VVE_PREVIEW_SUPABASE_PROJECT_REF` | The approved separate test project's 20-character ref. Both active projects are explicitly rejected. |
| `VVE_PREVIEW_TEST_EMAIL` | One explicitly selected test inbox. All hosted-preview emails use this address, including journey emails. |
| `BOOKING_JOURNEY_ENABLED` | `true` only in the prepared test environment initially; otherwise feature is disabled. |
| `BOOKING_JOURNEY_MODE` | `test`. Missing value also behaves as test mode. Hosted previews reject `live` regardless of the isolation approval marker. |
| `BOOKING_JOURNEY_TOKEN_SECRET` | A new random secret of at least 32 characters, identical in website and CRM. Never put it in browser variables. Rotation invalidates all private links. |
| `BOOKING_JOURNEY_SITE_URL` | The actual customer website origin for that environment, using HTTPS outside localhost. |
| `STRIPE_SECRET_KEY` | A Stripe test key. Hosted previews reject both `sk_live_` and `rk_live_` keys. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret for the website's configured test webhook endpoint. |
| `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | The approved test project's HTTPS URL and its own service-role key, configured in both projects. Never inherit a production key. |
| `SUPABASE_URL` | Leave unset or point to exactly the same approved test project; a conflicting alternate URL blocks preview access. |
| `GMAIL_SENDER` / `GMAIL_APP_PASSWORD` / `BUSINESS_EMAIL` | Mail credentials selected for the controlled test; use the test inbox for the business destination. Local automated tests mock delivery. |
| `BOOKING_JOURNEY_TEST_EMAIL` | Test recipient for an unhosted/local journey in test mode. In hosted previews, `VVE_PREVIEW_TEST_EMAIL` takes precedence. Both paths use a `[TEST]` subject. |
| `BOOKING_JOURNEY_WORKER_SECRET` | Separate random 32+ character secret, on the website only, for the due-work endpoint. |

For the isolated test website, configure a separate **Stripe test-mode webhook endpoint** for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`, with its own signing secret. Keep the existing production endpoint and subscriptions unchanged. Hosted previews accept only signed `livemode: false` events whose object metadata contains `journey=v1`; legacy webhook processing remains disabled in previews. Checkout is card-only in this implementation, but a completed unpaid session is still treated as processing, never as paid.

Local unit/API tests mock payment and email providers, and the SQL runner below makes no provider calls. A deployed test-card payment or message to the selected test inbox is a separate, explicitly initiated staging check. The preview guard does not isolate an unhosted local API process: never run local write tests with production credentials. Legacy checkout, backfill and historical confirmation/payment readers remain disabled in hosted previews even after isolation approval.

## Scheduled work and recovery

The authenticated worker is **POST** `/api/booking-management?action=process-due` with `Authorization: Bearer <BOOKING_JOURNEY_WORKER_SECRET>`. GET cannot run it. Once isolation and test-recipient checks are complete, explicitly test the worker against synthetic bookings before configuring a staging scheduler (for example every five minutes). Worker runs can send queued emails, so they are not read-only checks. Verify repeated staging runs before considering production scheduling. This implementation did not create or enable any external scheduler.

Each run is bounded: up to 10 expired holds, 10 eligible deposit reminders, 10 appointment reminders (five confirmed plus five pending revisions), and 20 email recovery attempts. A reminder is queued once per offer when the deadline is within 24 hours and still more than 31 minutes away. A per-offer timestamp prevents previously reminded rows starving later bookings. New offers reset the marker. Failed messages get at most five automatic attempts; stale `sending` claims are recovered after ten minutes. Staff can inspect delivery state and retry a particular message in the CRM. Day-before emails use the next Europe/London calendar day, show preparation, address, arrival window and the credited balance, and do not charge automatically. They are queued once for the confirmed appointment; cancelled/completed/payment-review jobs are excluded. Pending revisions use the original confirmed appointment, never the proposed date. Accepting a reschedule resets the appointment marker.

An interrupted Stripe checkout creation reserves the operation. Staff edits/cancellation wait while it is active. After ten minutes, recovery checks Stripe's session list for the exact booking and attempt marker, then reattaches that session or safely clears a creation that never produced one. It never blindly starts another charge. Payment/cancellation conflicts require reload; a genuine late payment is recorded as **Payment needs staff review**, with explicit confirm/close controls in CRM. Before confirming, staff must check availability and the credited amount. Fully refunded/underpaid jobs cannot be confirmed through this control without the required £30 remaining credited.

The database transaction updates the revision, agreement, booking fields, payment ledger, history and outbox together. A repeated Stripe session/refund cannot credit twice. Failed email does not undo a saved booking or paid transaction. Successful email followed by a failure updating a legacy request flag remains **sent**; the flag can be repaired without resending. SMTP cannot guarantee exactly-once delivery after a network acknowledgement failure; a stable Message-ID is used and ambiguous delivery is visible for staff review.

## Validation completed locally

- 24 booking lifecycle tests cover signing/expiry/revocation, read-only access, exact £30, dates/deadlines, stale edits, checkout recovery, paid/cancel races, changed-agreement acceptance, duplicate events, partial/manual payments, refunds, test recipient enforcement and email outage/flag repair.
- Customer-page tests cover private-token handling, GET-only opening, explicit cancellation, reschedule requests, API conflicts and missing links.
- Worker tests verify fair processing of 25 reminders across bounded runs, recovery of stale sending claims and London-calendar appointment reminders during pending changes.
- Existing legacy Stripe webhook tests, CRM booking/status/balance/notes and review tests are retained.
- The migration was applied twice to isolated embedded PostgreSQL (PGlite), with actual tests for optimistic concurrency, duplicate payment exclusion, transactional rollback, reminder-marker persistence/reset and anonymous/signed-in customer-role access denial. No production database was used.

Reproduce the actual SQL checks with [the booking database validation runner](../scripts/validate-booking-journey-db.mjs):

```sh
node scripts/validate-booking-journey-db.mjs --pglite /path/to/installed/pglite/dist/index.js
```

Alternatively, set `PGLITE_MODULE` to that local module file or its `file:` URL, then run `node scripts/validate-booking-journey-db.mjs`. If `@electric-sql/pglite` is already installed where Node can resolve it, no option is needed. The runner creates a fresh in-memory database, applies the repository's current migration twice, prints its check results and closes the database. It does not read database credentials or call payment/email services. Its competing calls verify the actual SQL revision checks on PGlite's serialized connection; staging must still verify behavior across real concurrent API/database connections.

Still required in isolated staging: deployed helper/module loading in both projects, actual test database API permissions, an explicitly initiated Stripe test-card payment and webhook retry, an explicitly initiated delivery to the selected test inbox, scheduled expiry/reminder execution, customer mobile/desktop screenshots using synthetic deployed API responses, and invoice workflow reconciliation using synthetic records. Local legacy payment regression tests must also remain passing; historical production records and preview-disabled legacy endpoints are not staging fixtures. Only then should a separately reviewed production release enable live collection.

Stripe reference: [Checkout session list and recovery filters](https://docs.stripe.com/api/checkout/sessions/list), [idempotency and retry semantics](https://docs.stripe.com/api/idempotent_requests), [Checkout creation and expiry](https://docs.stripe.com/api/checkout/sessions/create).
