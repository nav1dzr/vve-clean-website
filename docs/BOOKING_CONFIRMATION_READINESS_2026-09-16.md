# Booking confirmations: review result, 16 September 2026

**Local improvements are prepared. Live confirmation sending is not ready. No real booking, payment, customer message or production database was changed.**

## Found live

The authenticated CRM shows the booking-management workspace as unavailable and disables Save/Send. Its generic error requires a database/schema/permissions check; a missing table is not proven solely by the screen. Initial customer/business request emails and Telegram alerts were marked sent on the recent request inspected. Changing the separate Status selector does not send the reviewed confirmation email.

Existing references already use postcode + requested service date (DDMMYY), with collision suffixes. Preserve existing references if a later appointment date changes. Existing booking and invoice database connection notes identify the same production project, not two separate databases for those modules. The other active Supabase project is VVE OS; do not repurpose it as staging.

## Changes prepared

- Request-based service title, complete original selection, suggested scope and preparation. Editable fields, original-request disclosure and a fill-empty-only button preserve staff wording. Optional exclusions never invent charges. One-tap phone/message notes stay internal.
- Morning/afternoon request windows formatted for the existing arrival validator, with an explicit instruction to check the time agreed. Flexible requests remain unset. Mobile fields use 16px text.
- New booking email/private-page bank instructions use verified server configuration and the existing booking reference. They are saved with the reviewed agreement. Changing settings later cannot silently redirect an old email. Missing/incomplete bank details prompt contact instead of displaying invented details.
- Confirmation remains independent of payment. Existing Stripe checkout remains available only after completion; no Stripe account, link, charge or webhook configuration was changed. Cancellation, pending revisions and settled jobs do not display a fresh bank-payment request. Bank receipt remains a staff-verified action.
- New invoice wording now defaults to payment after the clean, matching the owner's existing instruction. Existing invoices and explicit agreed terms are retained.
- Email dates are readable and the HTML declares UTF-8 and a mobile viewport. The stale deposit/48-hour setup guide is replaced with the current workflow.

## Validation

The complete CRM run passed 934 tests with one existing skipped test. A subsequent focused run covers the additional bank-snapshot/reschedule regression. All 78 selected website/request/Stripe/worker tests passed. CRM and website client builds passed; both type checks passed. Changed-code lint had no errors (one existing invoice-component export warning). The existing CRM large-bundle warning remains.

Eight actual SQL checks passed against disposable local PostgreSQL/PGlite, including repeat application without modifying a booking, direct confirmation without payment, concurrency/revision handling, rollback, duplicate historical payments and access denial. This is not a production or provider-connected test.

The actual CRM component, generated email and private customer component were reviewed with synthetic data in a local browser. No customer account, actual bank details, Stripe charge, SMTP send or production API writes were used. Live email receipt, correct bank account, deployed Stripe/webhook configuration and scheduler activation are not yet verified.

## Exact next release work

1. Obtain release-specific approval for the booking changes, and an exception for the existing additive booking migration if the read-only schema check shows it is missing. The migration is `supabase/migrations/20260908100000_booking_journey.sql`: four private tables plus an atomic function/reminder fields; no customer backfill.
2. Reverify the actual target database, shared website/CRM configuration, private-link secret and live/test mail mode. Confirm the existing invoice bank details with the owner; do not request passwords or Stripe secret keys in chat.
3. Use an approved isolated staging database and test inbox for a controlled confirmation delivery and Stripe test-card/webhook round trip. A localhost preview or local mock test does not establish these production integrations work.
4. Release only the reviewed booking scope through normal checks. Exclude the pending `d9088d4` website refinement release and unrelated media-caption edits unless separately approved. Verify live read-only screens, then arrange a specifically authorised customer send.

## Limits to keep visible

The existing journey intentionally cannot adopt an already scheduled/closed/settled or historical paid booking lacking a journey. Never reset it to New to bypass that check. Booking and invoice payment ledgers remain separate; reconcile before issuing accounting documents so money is not counted twice. Invoice-specific Stripe links are currently pasted manually, whereas the booking journey creates Checkout automatically after completion. A reminder scheduler has not been newly activated by this work.

Full setup and owner steps: [Booking journey setup](BOOKING_JOURNEY_SETUP.md).
