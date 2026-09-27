# VVE Clean booking measurement implementation plan

> **Historical plan.** The implementation changed after this document was written. Use
> [`BOOKING-MEASUREMENT-RELEASE-2026-09-24.md`](./BOOKING-MEASUREMENT-RELEASE-2026-09-24.md)
> for the current architecture, configuration names, event contract, validation evidence,
> release gates and rollback steps. The older provider and status notes below are retained
> only as an audit trail and must not be used to configure or release the current code.

Prepared 17 September 2026 on `codex/booking-measurement-audit-20260917`. Nothing in this branch has been pushed, migrated or deployed.

## Release decision

The repository implementation is prepared for review. It must **not** be deployed until the migration is applied to an isolated Supabase test project, a controlled Stripe test-mode deposit passes end to end, and Navid explicitly approves the resulting release. Prices, the £30 operational deposit, Stripe checkout behaviour and existing records are unchanged.

The recommended paid route is **Google Ads offline click conversion from the server outbox**. This is strongest for a payment that may occur days after the original website visit and from a link opened in an email. It joins the consented click identifier stored on the booking to the signature-verified Stripe payment or staff-verified bank deposit. It does not depend on the customer returning to a browser page. A future GA4 `deposit_paid` diagnostic may coexist, but must not be imported as a second primary Ads conversion.

## Files changed

- Customer journey and lead events: `src/pages/BookingPage.tsx`, `src/components/EotQuoteWizard.tsx`, `src/lib/analytics.ts`, `src/lib/attribution.ts`.
- Request API and notification acknowledgement: `api/create-booking-request.js`, `api/create-checkout-session.js`.
- Paid delivery worker: `api/_lib/depositMeasurement.js`, `api/_lib/bookingJourneyWorker.js`.
- Private legacy page: `public/confirmation.html`.
- Proposed database migration: `supabase/migrations/20260917120000_booking_measurement_outbox.sql`.
- Updated/new tests: `src/lib/analytics.test.ts`, `src/lib/attribution.test.ts`, `src/pages/BookingPage.test.tsx`, `tests/api/create-booking-request.test.js`, `tests/api/deposit-measurement.test.js`, `tests/measurementMigration.test.js`, `tests/confirmationUnverifiedState.test.js`, `tests/cookieConsentRegression.test.js`.
- Audit and this implementation plan: `docs/BOOKING-MEASUREMENT-AUDIT-2026-09-17.md`, `docs/BOOKING-MEASUREMENT-IMPLEMENTATION-PLAN-2026-09-17.md`.

`shared/publishedPricebookSnapshot.js` was touched by the required build sync but has no content diff and is not part of the proposed release.

## Database migration

The proposed migration adds attribution/consent/test columns to `bookings` and creates `booking_measurement_outbox`. It does not backfill historic payments. An `AFTER INSERT` trigger on the existing immutable payment ledger creates one `deposit_paid` row for only `deposit` or `manual_deposit` ledger entries. The unique `payment_external_id` and `ON CONFLICT DO NOTHING` make Stripe webhook retries and staff retries one record. Sending instructions inserts no payment ledger row and therefore creates no measurement.

Each outbox record includes:

```text
event_name: deposit_paid
conversion_id: opaque UUID
amount_pence: actual verified integer
currency: verified gbp
payment_type: stripe_deposit | bank_transfer_deposit
paid_at: payment ledger timestamp
attribution: approved click IDs, UTMs and landing path only
consent: advertising flag, policy version/time, withdrawal time
is_test: boolean
provider/status/attempts/provider_acknowledgement/error timestamps
```

It never contains customer name, telephone, email, address, postcode, booking reference or private URL. The trigger suppresses test rows, denied/withdrawn consent and payments with no supported click ID. Withdrawal suppresses any undelivered rows. Raw attribution is scheduled for removal after 90 days; delivered/suppressed audit rows after 400 days. The purge function exists but requires an approved scheduler before production.

The initial request email/Telegram path still saves the booking before contacting providers. Telegram now requires both HTTP success and provider JSON `ok:true`. The existing CRM retry action/outbox can repair failed initial emails after the booking workspace exists. A fully atomic outbox created in the same transaction as the original website booking insert remains the one outstanding notification-reliability item; do not claim this part complete or remove the current direct sends until that database/API transaction is implemented and tested.

## Event behaviour

- `booking_request_started`: first request-form interaction; diagnostic.
- `booking_request_submitted`: only after server success with a valid opaque UUID; repeated same-UUID call is suppressed in the current browser session; diagnostic/secondary.
- `phone_contact`, `whatsapp_contact`: separate interactions; diagnostic/secondary.
- `booking_initiated`, `contact_form_submitted`, quote steps and form errors remain diagnostic/secondary by policy. Code comments no longer imply code controls Ads goal status.
- `deposit_paid`: server outbox only after verified ledger insertion. It uses actual amount and currency. The offline request uses opaque `conversion_id` as Ads `orderId` and one priority click ID (`gclid`, then `gbraid`, then `wbraid`).

The private historic `confirmation.html` no longer loads Google. Its old conversion block returns immediately before reading transaction identifiers. Payment verification and customer success/recovery display remain intact. A follow-up cleanup may physically delete the unreachable code after release confidence; it is not needed for privacy or firing prevention.

## Consent and attribution

Advertising capture remains denied until the consent layer grants it. The booking now carries `gclid`, `gbraid`, `wbraid`, approved UTMs including `utm_term`, original path, and consent version/time. The API strips control characters, applies length limits, requires safe click-ID characters, and accepts only a path without query/hash. Server delivery requires recorded advertising consent and no withdrawal. Tests and preview bookings are marked/suppressed.

Consent withdrawal clears browser attribution immediately. For an already-created booking, the migration supplies the service-role-only withdrawal function; the operational CRM/customer-support action that invokes it still needs a small approved UI/API task before production. Until that exists, documented customer requests must be handled through an authorised admin operation.

## Google delivery and secrets

Delivery is disabled unless `BOOKING_MEASUREMENT_MODE` is `validate` or `live` and all required values exist. `validate` uses Data Manager validation without attribution; `live` is reserved for an approved release. Required secret/configuration names only:

- `GOOGLE_ADS_API_VERSION`
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (only when the account hierarchy requires it)
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID`
- `BOOKING_MEASUREMENT_MODE` (`disabled`, `validate` or `live`; missing/unknown is disabled)

Provider success requires HTTP success, no partial failure, and exactly one result; acknowledgement is saved. Failed delivery remains retryable, with an eight-attempt database ceiling. Claiming uses row locks and `SKIP LOCKED`. Ads `orderId` supplies provider-side replay protection in addition to the database unique key.

## Manual Google Ads/GA4 work

1. Create one Google Ads conversion action for verified deposit payments and obtain its action ID. Keep it secondary during testing, then make only this paid action primary after reconciliation.
2. Confirm customer/account/login IDs and OAuth/developer-token access. Do not expose credentials to the browser.
3. Keep request, booking-start, phone, WhatsApp and contact actions secondary. Remove old event-name imports after the renamed events have been observed.
4. Do not import a GA4 `deposit_paid` event as another primary conversion if the offline Ads upload is primary.
5. Use Google diagnostics to reconcile test click ID, opaque order ID, received time and actual value. Confirm test exclusion before any live-card test.
6. The optional production GA4 web-stream ID and direct request Ads label were absent in the audited build; decide whether to configure GA4 diagnostics separately.

No Ads/GA4 dashboard setting or conversion was created by this work.

## Validation status

- Complete website suite: 131/131 test files passed; 2,009 tests passed and 281 were intentionally skipped.
- Focused final regression rerun: 19/19 passed, covering event names, booking wording, measurement migration and hash navigation.
- CRM payment journey: 57/57 passed.
- Website TypeScript: passed.
- Website production build and prerender: passed, 38 routes including 21 indexable sitemap URLs.
- CRM production build: passed (existing bundle-size warning only).
- Website and CRM lint passed with no errors (existing warnings only).
- Interrupted `sending` rows become claimable after ten minutes and still stop after eight attempts; the provider order ID remains the stable deduplication key.
- Controlled test-mode end-to-end payment: **not performed**. No test database migration, Stripe payment, Google upload or production record was created.

## Rollback

Before enabling delivery, set `BOOKING_MEASUREMENT_MODE=disabled` or leave it unset. Application rollback is the normal revert of this scoped commit/deployment. Database rollback is non-destructive: disable delivery and the trigger, retain outbox records for audit, then drop the trigger/functions/table and only the newly added columns after confirming no approved implementation depends on them. Never delete or rewrite `booking_journey_payments`, bookings or historical Stripe data. Re-enabling the retired browser conversion is not part of rollback; paid measurement remains paused until the server route is healthy.

## Deployment status

Local implementation only. No commit, push, PR, Supabase migration, production secret, Stripe change, Google conversion, deployment or live test has been performed.
