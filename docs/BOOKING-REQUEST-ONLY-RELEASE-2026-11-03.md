# Request-only Google Ads candidate — 3 November 2026

## Scope and source

Local implementation on `feature/website-final-completion`, starting at `457bf39`. Current main is `5977e26a467e684e0ea784e7a9495db5dfc6c2a4`; the affected source matches main before this delta. Main is the merge of that branch; normal release review must still compare against then-current main. No push, deployment, production migration, provider request, worker invocation, secret export or customer-record read was performed.

Only these four implementation files are included:

- `api/_lib/depositMeasurement.js`: optional explicit request-only selection, strict ISO cutoff, request action-only configuration requirements, narrow RPC selection, defensive scope checks before provider operations, and conservative handling of uncertain request uploads.
- `supabase/migrations/20261103180000_booking_request_only_claim.sql`: additive service-role-only request claim; explicit search path; atomic event/provider/test/cutoff filters; submitted diagnostic polling; stale request sends quarantined, never automatically reclaimed for upload.
- `tests/api/booking-request-only-measurement.test.js`: request-only regression tests with synthetic fixtures and mocked providers.
- `scripts/validate-booking-request-only-db.mjs`: disposable local SQL validation using an existing PGlite installation. No connection URL or credentials.

This document is the fifth candidate file. The pre-existing modified `tests/api/deposit-measurement.test.js`, old untracked `scripts/validate-ads-once.mjs`, old validation tests, generated reports and output are excluded. GA4 implementation/configuration remains unchanged. Deposits, prices, Stripe, notifications and campaigns are unchanged.

## Runtime contract

The new configuration names are `BOOKING_MEASUREMENT_SCOPE=request_only` and `BOOKING_MEASUREMENT_REQUEST_SINCE`, an exact UTC ISO timestamp with milliseconds, for example the format `YYYY-MM-DDTHH:mm:ss.sssZ` (the example is not a value to deploy). `BOOKING_MEASUREMENT_MODE` remains the existing disabled/validate/live control. Only the existing request conversion action binding plus common Data Manager credentials are required in request-only mode.

**Unset scope preserves existing legacy behavior for compatibility.** Therefore both website and CRM consumers must remain disabled while scope/cutoff are staged and verified. Never enable mode with scope missing. Unknown scope or missing/invalid cutoff fails closed. Direct request-only adapter use cannot override disabled mode or promote validate to live. No configuration was changed by this candidate.

The SQL claim filters `booking_request_submitted`, provider `google_data_manager`, `is_test=false`, and both occurrence and creation timestamps at/after cutoff, before modifying any claimed row. Missing migration errors do not fall back to the broad claim. An unexpected out-of-scope RPC result aborts without sending or changing it in JavaScript. Existing consent rechecks before send remain in place. Requests remain unpaid and have no monetary conversion value.

No status-constraint change is needed: ambiguous request sends use existing terminal `suppressed` with `last_error=request_send_outcome_unknown`. A crash or failed receipt save leaves `sending`; the next narrow claim quarantines it after ten minutes. Diagnostic failures are also held for review, rather than automatically uploaded again. These holds trade possible missed delivery for avoiding an unsafe duplicate. Only operator reconciliation under a separate explicit action can resolve them. Do not clear suppression or edit timestamps as a shortcut.

## Local validation

The reviewed cutoff parser accepts a valid ISO cutoff and rejects impossible dates. Root coordinating-chat independent source review reported no blocking source issue; this is a source review, not a production acceptance test.

The final execution receipt supplies the test count and exact commit. Verification includes targeted mocked API/Ads/GA4 regression suites, targeted lint, website TypeScript, patch whitespace and **22 disposable local PostgreSQL checks**. SQL checks cover other milestones left byte-for-byte unchanged, test/provider/cutoff exclusion, repeated claim, submitted polling without incrementing upload attempts, stale-send quarantine, terminal validation/uncertainty exclusion, finite cutoff, service-role privileges and explicit search path. Actual multi-connection PostgreSQL concurrency was not exercised; SQL uses `FOR UPDATE SKIP LOCKED`. Required full release CI remains mandatory before merge.

## Exact staged release proposal

1. Approve only the candidate commit in the execution receipt for push/PR and normal protected merge after required checks. Check the PR against current main; stop if unrelated changes appear. Keep both consumers' Ads mode disabled through deployment. Do not touch GA4 mode or keys.
2. Under the explicit production-schema exception, verify migration prerequisites through schema metadata only, apply only `20261103180000_booking_request_only_claim.sql`, and verify its function definition/grants. It adds a function; applying the migration does not execute a claim or rewrite historical data. Missing prerequisites stop this plan; do not apply older migrations speculatively.
3. Verify both runtime deployments, disabled Ads modes, correct existing request action/account binding and credential presence without revealing values. Stage `request_only` in both consumers. Establish the actual scheduler ownership so the same work is not independently triggered by an undocumented consumer. Do not invoke the broad business worker to test readiness.
4. Fresh provider validation is a **separate bounded phase within the approved plan**, only after the secure execution gate below is met. Manifest: one synthetic request payload, at most one Google validation-only ingest plus its necessary OAuth exchange, maximum two-hour execution window beginning when the operator starts the approved session, with approval itself expiring 24 hours after owner approval if not started. No synthetic live conversion, real click ID, customer identifiers, queue claim or customer notification. Use the existing payload builder with validation-only=true. This proves validation acceptance, not ingestion/attribution. Preserve test exclusion; never relabel a test booking as genuine.
5. If all gates pass and the owner has approved activation, choose and record a fresh current UTC cutoff **after validation**, stage it on both consumers while disabled, verify it and the request scope, then enable Ads live mode only. No backfill or validation-row promotion. Use the established scheduler normally; no manual broad worker call. If any gate fails leave disabled.
6. Under narrowly scoped metadata-read approval, observe the next eligible genuine request's opaque event key, state, attempt count, provider receipt and processing diagnostics. Do not retrieve full customer records. A consent-denied or unmatched request remains legitimately excluded. An accepted request should produce one canonical queue identity; Google submission, processing and Ads attribution are distinct evidence stages. The Ads chat checks action reporting without adding a duplicate GA4-import conversion. No eligible request means waiting, not completed.

## Secure validation execution gate — not yet resolved

This checkout does not establish an approved existing operator runtime with securely bound Google credentials. No credential export or new credential access is assumed. The old untracked validation harness and expired October diagnostic are not part of this candidate and must not be reused as authority. No temporary public diagnostic is needed for the code change, but **fresh external validation cannot presently be promised in one batch**.

Before step 4, identify an already-authorised secure runtime capable of executing this exact payload/adapter validation without exporting credentials, accessing customer rows or running the broad business worker. Review its execution command and scope. If no such context exists, stop before provider validation/activation and report that exact missing capability. A new execution channel requires its own reviewed change/approval; do not silently add a route or copy secrets locally. This gate cannot be waived by local tests.

## Proposed single owner approval

Once the exact candidate hash is attached, request:

> Approve this request-only Google Ads candidate for push, required checks and normal merge/release; approve only its additive claim migration and secure request-only configuration on the website and CRM. Keep reporting disabled until metadata checks and the bounded fresh validation pass. Permit the stated validation window only using a reviewed existing secure credential context, then request-only activation with a fresh recorded cutoff and limited status/diagnostic observation of the next genuine eligible request. No GA4, payment, deposit, customer messaging, historical replay or campaign changes. If the secure validation context or any release gate is missing, stop with reporting disabled.

This wording is a proposal, not approval. It deliberately does not authorise inventing an execution channel. The owner can approve the concrete release and gated activation together; that does not turn unmet gates into permission to bypass them.

## Rollback

Set Ads mode disabled in both consumers first, preserving request scope/cutoff. Do not unset scope while live, since unset selects legacy behavior. Leave the additive function in place and preserve all event receipts/holds. If required, revert application code via normal reviewed release only after disabled mode is verified. Never replay ambiguous events or modify customer/payment records. Already transmitted events cannot be unsent by rollback.
