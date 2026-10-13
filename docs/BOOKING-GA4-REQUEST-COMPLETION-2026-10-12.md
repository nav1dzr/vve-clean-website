# Canonical GA4 request completion — 12 October 2026

## Implemented, not activated in production

The optional server GA4 queue now supports `booking_request_submitted` alongside
the existing `begin_checkout` and `purchase` events. The browser's existing
`booking_request_response_received` remains a separate diagnostic; it does not
produce the canonical event or another Ads conversion.

The request event is generated from a saved, modern website request (request
key, new status, zero deposit and unpaid state). Because the API deliberately
saves optional analytics metadata after the booking itself, the trigger handles
either an insert containing valid context or the first null-to-context update.
It uses the booking's original creation timestamp and the unique key
`booking:<opaque UUID>:booking_request_submitted`. Repeated inserts, context
updates and enqueue retries cannot add a second row. Transaction rollback also
rolls back its event. Optional queue failure never rejects a valid booking.

Request events contain an opaque reconciliation ID and, where eligible, Google's
session ID. They contain no value, currency, items, purchase transaction ID,
customer name, contact details, address, postcode reference or private URL.
Consent, property identity, test status and withdrawal are checked before send.
Explicit test records remain suppressed. The payment event calculation, actual
deposit amount, Stripe integration and Google Ads configuration are unchanged.

## Delivery limits

The database guarantees one queued event per booking/event type. GA4 does not
provide purchase-style transaction deduplication for a custom request event.
Therefore a live request send with an unknown outcome becomes `uncertain` and
is not automatically retried. A lost acknowledgement save is handled the same
way after the claim expires. This avoids duplicate delivery at the cost of a
possible missing event requiring reconciliation; it is not an exactly-once
external ingestion guarantee. `event_id` is for reconciliation, not a promise
that GA4 will deduplicate custom events.

If optional context cannot be saved, the booking and its normal notifications
still succeed, but this optional GA4 event cannot be generated. A successful
Google HTTP response is recorded as `submitted`, not proof of reporting ingestion.
Neither browser consent denial nor ad blocking is a booking failure.

## Activation still requires an approved release

1. Apply both migrations, in order, to an isolated test database:
   - `supabase/migrations/20261004120000_booking_ga4_measurement.sql`
   - `supabase/migrations/20261012120000_booking_ga4_request_measurement.sql`
2. Follow the separate browser/server property, consent and validate-mode setup
   in `docs/PHASE-1-BOOKING-FUNNEL-IMPLEMENTATION-2026-10-04.md`. Use the existing
   tag; do not install another GTM or GA4 tag. Never expose the server API secret.
3. Verify eligible synthetic payloads against Google's debug endpoint before any
   approved live mode. Explicit test flags are intentionally suppressed; use
   isolated fixtures for the positive validation path, without payment or real
   customer records. Validate mode does not ingest reporting conversions.
4. After explicit production migration/configuration/deployment approval, verify
   a newly created eligible event in the intended GA4 property. Installing either
   migration performs no historical backfill; validate records are never promoted.
   Keep GA4 mode off while deploying the updated worker and both migrations;
   only then validate and enable the intended mode. Do not activate new request
   rows against the older Phase 1 worker, which does not support that event type.
5. Keep browser acknowledgements and request events secondary/diagnostic. Do not
   import GA4 `purchase` as another Primary Google Ads conversion if canonical
   `deposit_paid` already owns paid acquisition. Dashboard changes are separate.

No production migration, environment variable, Google setting, real message or
external analytics send was performed for this implementation.

## Local evidence

- `tests/api/ga4-measurement.test.js`: 59 passed, including the new canonical
  request payload, repeated worker runs, consent/test suppression, ambiguous
  send handling, acknowledgement-save failure and validation-only retry tests.
- `tests/api/ga4Context.test.js`: 14 passed.
- `scripts/validate-booking-ga4-db.mjs`: 24 checks passed in disposable local
  PostgreSQL (PGlite), including repeatable migrations, no backfill, committed
  requests, insert/metadata rollback and retry, event uniqueness, no revenue,
  test/consent suppression, stale claims, permission checks and unchanged payment
  measurement. Synthetic UUID fixtures only; no Supabase or Google connection.

The full repository validation and final release status are tracked in the
completion pass rather than inferred from these focused checks.
