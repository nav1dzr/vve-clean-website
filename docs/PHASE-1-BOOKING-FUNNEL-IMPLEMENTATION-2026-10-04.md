# Phase 1 booking funnel fixes — 4 October 2026

## Scope and release status

Implementation branch: `codex/phase1-booking-funnel-fixes`, based on
`origin/feature/website-final-completion` at `14a575f`.

The three quote/form defects are fixed. A separate, opt-in GA4 server delivery
path implements `begin_checkout` and `purchase`. `add_payment_info` remains
unsupported by the existing Stripe-hosted integration; it has not been faked.

This is a repository change, not a production release. No production migration,
environment-variable change, Google Ads/GA4 setting change or deployment was
performed. Prices, the £30 deposit, Stripe requests, customer records and existing
Google Ads measurement remain unchanged. Unrelated work in the other checkouts
was preserved. This review branch targets `feature/website-final-completion`.

## Form fixes

1. **Storage is optional.** Calculator and leaflet navigation carry a validated
   selection through router state. Reading/writing browser storage is guarded.
   Back to quote carries the current selection and its original service page.
   Corrupt stored data falls back to the calculator. Successful requests clear
   their route handoff. This supports the active journey when storage is blocked;
   persistence after closing a private tab cannot be promised.
2. **End-of-Tenancy rooms survive the round trip.** Restoring a booking reconstructs
   additional reception rooms, hallways and landings from recognised room IDs and
   types, preserving selected rooms and stair flights. Unknown, mismatched,
   duplicated, unchecked or hard-floor extras cannot become charged carpet areas.
3. **An empty professional carpet selection cannot become a completed quote.**
   The summary asks the customer to choose areas, and progression/submission
   focuses an accessible error until an area is selected or standard floor care
   is chosen. This also protects previously saved review-step states.
4. **Legacy compatibility is preserved.** Window/gutter/office quotes do not need
   a deep-clean discriminator. Old input-only calculator drafts can be restored
   and recalculated; they cannot directly open a booking form with a missing or
   invalid selection envelope. Switching service inside booking returns to the
   general calculator rather than an incompatible locked service calculator.

## Measurement contract

| Event | Authoritative trigger | Value / duplication control |
| --- | --- | --- |
| `begin_checkout` | Committed `checkout_ready` audit event for a deposit session | Exact amount used in that Checkout request, in GBP. One outbox row per booking/event, including regenerated or reused sessions. It is not fired by form starts or Pay-button clicks. |
| `purchase` | A positive `deposit` or `manual_deposit` entry in the authoritative payment ledger | Actual deposit amount in pence divided by 100. Stable opaque `transaction_id` per booking/deposit. Balance payments and refunds do not enter this deposit funnel. |
| `add_payment_info` | No reliable observable trigger in this integration | Not emitted. Hosted Checkout does not expose a card-details-submitted callback here. A click, redirect or later payment receipt is not that action. |
| Existing Ads `deposit_paid` and request stages | Existing Ads measurement path | Unchanged. Do not import the new GA4 `purchase` as an additional primary Ads goal for the same customer/payment. |

`purchase` here measures **deposit receipts**, not the entire cleaning invoice.
The code does not assume £30 when reporting value and does not change the
configured amount charged.

Browser capture is separately disabled by default. When enabled, it reads
Google-issued client/session IDs with `gtag('get', ...)` only after analytics
consent. It waits at most 300 ms, fails closed when tags/storage are unavailable,
and rechecks consent after callbacks. Optional metadata is excluded from the
booking retry fingerprint. Metadata errors cannot prevent a successful request,
and a replay cannot replace the original saved analytics context.

The server allowlists metadata and chooses the destination/mode. Arbitrary
browser fields, names, emails, phone numbers, service addresses, payment
references and URLs are not copied into new GA4 event payloads. No synthetic
client identity or engagement duration is invented.

The GA4 queue is separate from the Google Ads queue. It is service-role-only,
has unique booking/event keys and fenced claims, and rechecks consent, identity,
test status, mode and property ID immediately before dispatch. SQL telemetry
failures cannot roll back a successful checkout/payment; worker failures cannot
stop existing Ads or booking notifications. No historical events are backfilled.

Validation rows cannot become live uploads. A GA4 HTTP 2xx is recorded as
`submitted`, not proof that the property ingested the event. Ambiguous checkout
delivery is held as `uncertain` for review rather than blindly replayed. Purchase
transport retries retain their transaction ID; explicit provider HTTP errors also
require review. Events beyond 72 hours are suppressed rather than retimestamped.

## Consent, attribution and retention limits

- Delivery honours the booking's stored withdrawal/test state. Withdrawal erases
  identities from both the booking context and its queued events. A later cookie
  choice on an unrelated browser visit is not automatically synchronised to a
  previously saved booking; use the existing withdrawal workflow for that record.
- Analytics-only consent can produce GA4 events while advertising consent stays
  denied. Both the captured and current stored advertising choice must permit
  advertising fields to be granted.
- A saved Google client ID can join a delayed payment, but the session ID is
  omitted when it is outside Google's 24-hour session-joining window. Attribution
  across long delays is not guaranteed.
- The maintenance RPC clears old identity data after 90 days and deletes terminal
  submitted/validated/suppressed queue records after 400 days. Uncertain/failed
  audit records remain for review, without old identity data.
- After activation, disable sending with `GA4_BOOKING_MEASUREMENT_MODE=off` and
  retain `GA4_MEASUREMENT_ID`. Cleanup continues without the sending API secret.
  Removing all configuration also disables automatic cleanup.

## Activation steps — require separate release approval

1. Review and apply `supabase/migrations/20261004120000_booking_ga4_measurement.sql`
   to the isolated test database first. This work validated it in disposable local
   PostgreSQL; neither live Supabase project was changed.
2. For an isolated test build, enable `VITE_GA4_BOOKING_MEASUREMENT_ENABLED` and
   configure `VITE_GA4_MEASUREMENT_ID`. The existing Google tag must already use
   that same property. Do not add a second tag.
3. In the website server environment, set matching `GA4_MEASUREMENT_ID`, a
   server-only `GA4_API_SECRET`, and `GA4_BOOKING_MEASUREMENT_MODE=validate`.
   Never expose the secret with a `VITE_` prefix. The existing booking worker
   schedule also processes this separate queue.
4. Validate consented synthetic events using Google's validation endpoint in the
   isolated environment. Explicit test flags and Stripe test sessions are
   suppressed by design; local fixtures can exercise the positive path without
   sending a real conversion or taking payment. Do not use real customer records.
5. Obtain approval for production migration, configuration and website/admin
   deployment. Enable live capture/delivery only for newly created eligible
   requests, then verify receipt in the intended GA4 property. Old validate-mode
   records will not be promoted or replayed.
6. Keep canonical Ads `deposit_paid` as the existing paid-customer signal. Any
   Google Ads goal/import changes remain a separate decision. No such dashboard
   changes are included here.

A truthful `add_payment_info` implementation would need a separately approved
payment integration that exposes the actual submission signal. Stripe behaviour
was explicitly outside this phase's permitted changes.

## Validation evidence

**3,198 tests passed; zero failures** across the full website and CRM suites.
This includes the accepted audit's 358 existing tests and **136 new regression
cases**. No existing assertions were deleted or weakened.

| Check | Result |
| --- | --- |
| Website `npm test` (140 files) | 2,211 passed; 285 conditional unverified-rating checks skipped by the existing verified-rating configuration |
| CRM full Vitest run (79 files) | 987 passed; 1 existing receipt-detail TODO |
| Website / CRM TypeScript | Both passed |
| Website / CRM full ESLint | Both passed with 0 errors; 7 website and 1 CRM pre-existing Fast Refresh warnings in untouched files |
| Website / CRM production builds | Both passed; website prerender completed. CRM retains its existing large-bundle warning. |
| Real local PostgreSQL migration checks | 15/15 passed |
| Git whitespace check | Passed |

The initial full website run found five legacy-quote compatibility regressions;
these were fixed in the restore validation boundary and covered by additional
tests. The final full rerun above is green. No test was skipped to hide a failure.

- Disposable PostgreSQL: 15 checks against the real additive migration, including
  repeat application, duplicate payment rejection, rollback, consent withdrawal,
  no backfill, test suppression, queue permissions and payment resilience.
- Request API tests verify customer email, business email and Telegram are still
  attempted on an accepted request even if optional GA4 metadata cannot be saved.
  These are mocked provider checks; no live email/Telegram or payment was sent.
- A pre-existing Windows-only SQL artifact hash failure was corrected by comparing
  canonical LF content. Its pinned migration, SQL artifact and SHA-256 remain
  unchanged. No test expectations or assertions were removed.

## Files changed

| Area | Files |
| --- | --- |
| Quote handoff | `src/lib/bookingHandoff.ts`, `src/lib/quoteOrigin.ts`, `src/components/QuoteCalculator.tsx`, `src/pages/BookingPage.tsx`, `src/pages/LeafletPage.tsx` |
| EOT selection | `src/components/EotQuoteWizard.tsx` |
| GA4 identity | `src/lib/ga4Context.ts`, `api/_lib/ga4Context.js`, `api/create-booking-request.js` |
| GA4 delivery | `api/_lib/ga4Measurement.js`, `api/_lib/bookingJourneyWorker.js`, `admin/api/_lib/bookingJourney.js`, `supabase/migrations/20261004120000_booking_ga4_measurement.sql` |
| New regression suites | `src/lib/bookingHandoff.test.ts`, `src/lib/ga4Context.test.ts`, `src/pages/BookingPage.blockedStorage.test.tsx`, `src/pages/BookingPage.ga4Integration.test.tsx`, `src/components/EotQuoteWizard.regression.test.tsx`, `tests/api/ga4Context.test.js`, `tests/api/ga4-measurement.test.js` |
| Expanded existing tests | `tests/api/create-booking-request.test.js`, `tests/api/bookingJourneyWorker.test.js`, `admin/tests/api/_lib/bookingJourney.test.js`, `tests/bookingRequestNotificationRollbackArtifact.test.js` |
| Verification and notes | `scripts/validate-booking-ga4-db.mjs`, this document |

## Official references

- [GA4 event definitions](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag)
- [Measurement Protocol response and timestamp behaviour](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference)
- [Measurement Protocol session attribution](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Purchase transaction deduplication](https://support.google.com/analytics/answer/12313109?hl=en)
- [Stripe event types](https://docs.stripe.com/api/events/types)
