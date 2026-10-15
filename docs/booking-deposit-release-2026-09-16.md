# Agreed booking deposit release

The public request remains free. After agreeing the service, price and arrival window, an owner can send a £30 deposit request. Stripe receipt or a checked bank transfer confirms the appointment and credits the deposit towards the total. Existing `after_clean` arrangements remain available and are not converted retrospectively.

## Implemented

- Explicit `deposit_after_agreement` payment plan and editable 2/6/12/24/48-hour hold before arrival.
- Stable private email link with an explicit Pay intent. Each Stripe checkout is limited to the remaining hold or 23 hours, satisfying Stripe’s 24-hour maximum. A new checkout cannot be created in the last 31 minutes; the customer is directed to contact the team.
- Customer rescheduling/cancellation requests pause checkout and notify the owner; confirmed changes need customer acceptance. The previous confirmed arrangement remains active while acceptance is pending.
- One unpaid reminder per offer, manually or halfway through the hold via the existing authenticated worker. Confirmed appointments retain their next-day reminder.
- Actual bank receipt requires a checkbox and reference. Expired/pending-change bank deposits are recorded for review, without confirming availability.
- Independent outbox records for customer email, business email, Telegram and calendar. Failed delivery does not reverse a recorded payment. Calendar events use a deterministic booking ID and conditional updates; retries synchronize the current accepted arrangement.
- Legacy deposits, after-clean balances, service prices and existing customer rows are preserved.

## Database and rollout

`supabase/migrations/20260916183000_booking_confirmation_channels.sql` replaces only the existing server-only transaction function. It adds future notification fan-out, changes no tables/columns, and does not rewrite existing bookings, messages or payments. Apply transactionally after authorization. A repeated application is tested against disposable PostgreSQL. Do not run all pending migrations blindly.

Production remains disabled pending the specific release approval and connected provider checks. The known live base is `b71c59e`; this work is on `codex/agreed-booking-deposits-20260916`. Merge through normal GitHub checks, then verify both Vercel projects. Do not include unrelated website refinements or media work.

Required server settings in each deployment that sends/fulfills booking messages:

- `BOOKING_JOURNEY_ENABLED`, `BOOKING_JOURNEY_MODE`, `BOOKING_JOURNEY_TOKEN_SECRET`; token secret must match between website and CRM.
- Existing Stripe account's server key, valid SMTP credentials and `BUSINESS_EMAIL` (owner inbox), verified invoice bank settings, Telegram bot token and owner chat ID. Check deployed settings; do not copy the old root `.env` wholesale.
- Protected worker secret and a scheduler calling `POST /api/booking-management?action=process-due`. `ops/booking-followup-schedule.sql` prepares the single `vve-booking-followups` job, every ten minutes, using a matching Vault secret. This optional activation script is separate from schema migration and must be explicitly approved and verified. No public unauthenticated cron route; no changes to other scheduled jobs.
- `BOOKING_CALENDAR_ID`, `BOOKING_CALENDAR_SERVICE_ACCOUNT_EMAIL`, `BOOKING_CALENDAR_PRIVATE_KEY` for a service account shared only into the separate VVE Clean calendar with event write access. This persistent Google connection is not configured by signing into the browser or connecting the assistant's Calendar tool.

For tests, use a separate database/test data destination, Stripe test key, `BOOKING_JOURNEY_TEST_EMAIL`, `BOOKING_JOURNEY_TEST_TELEGRAM_CHAT_ID` and `BOOKING_CALENDAR_TEST_ID` distinct from the live calendar. Hosted preview isolation must stay enabled. The existing free test Supabase project is paused and could not resume under the account's active-project limit; do not pause another live project to bypass that limit. An explicitly approved, isolated synthetic production acceptance test is an alternative requiring separate authorization and exact cleanup scope.

Provider acceptance must verify: card checkout and signed webhook; duplicate webhook; confirmation delivery; bank transfer receipt; revision acceptance; cancellation request/final cancellation; payment reminder suppression after receipt; calendar create/update/cancel without duplicates; worker authentication/retry. Do not use real customers as test recipients. Booking `E81AA210926` / `VVE-TEST-20260914-01` is TEST ONLY and must not be charged, attended or counted as a customer.

Stripe already has the website `checkout.session.completed` webhook registered (read-only check). Verify its deployed signing secret and same account before activation. Refund processing code remains, but the currently observed endpoint subscription does not include `charge.refunded`; enabling refund notifications is a separate explicit provider setting, not a completed step in this release.

## Validation and limitations

Local tests exercise mocked provider responses, UI controls and the actual SQL function in disposable PGlite. They do not prove live SMTP, Stripe, Telegram or Google delivery. New Google calendar creation is separate from connecting it to the backend. No new Supabase project is required for normal website/CRM operation.

Accepted requests continue to be requests, not paid or confirmed bookings. No Google Ads configuration, tracking event or campaign is changed. Any offline confirmed/paid conversion mapping must be reviewed separately.

## Owner workflow

1. Open the booking; fill empty wording from its existing selections or edit it yourself.
2. Check items/scope, agreed total, date, arrival window and payment arrangement.
3. Save and preview; check availability; send the deposit request.
4. Stripe confirms automatically. For bank transfer, verify receipt before recording it.
5. Inspect the separate delivery records; use reminder/retry only where appropriate.
6. After the clean, mark completed and request the remaining balance. Cancellation never automatically issues a refund.

The original booking reference is retained when arrangements are revised so bank transfers and emails remain matchable; do not silently replace a reference that has already been sent.

## Provider references

- [Stripe Checkout expiration limits](https://docs.stripe.com/api/checkout/sessions/create)
- [Google Calendar event identifiers and time zones](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Google service account authentication](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Supabase authenticated scheduled HTTP requests with Vault](https://supabase.com/docs/guides/functions/schedule-functions)
