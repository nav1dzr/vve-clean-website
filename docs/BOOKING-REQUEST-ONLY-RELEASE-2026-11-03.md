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
4. The candidate validates each eligible genuine request in the existing secure runtime immediately before its single intended live ingest. It uses the same payload with `validateOnly=true`, through the existing adapter and existing runtime credentials. It rejects a validation timeout, malformed response, provider error or field warnings without any live ingest. Validation success is not saved as terminal `validated` before sending; the later live request ID remains the submitted receipt. This is not a synthetic test and must be explicitly included in activation approval.
5. If metadata/release gates pass and the owner has approved activation, record a fresh current UTC cutoff, stage it on both consumers while disabled, verify it and the request scope, then enable Ads live mode only. No backfill or validation-row promotion. Use the established scheduler normally; no manual broad worker call. Every eligible request passes the validation gate in step 4 before ingestion. Failed or uncertain preflight is held with its distinct reason for review, not replayed automatically.
6. Under narrowly scoped metadata-read approval, observe the next eligible genuine request's opaque event key, state, attempt count, provider receipt and processing diagnostics. Do not retrieve full customer records. A consent-denied or unmatched request remains legitimately excluded. An accepted request should produce one canonical queue identity; Google submission, processing and Ads attribution are distinct evidence stages. The Ads chat checks action reporting without adding a duplicate GA4-import conversion. No eligible request means waiting, not completed.

## Secure execution and remaining gates

The existing production scheduler/adapter supplies the execution channel; no operator credential export, separate harness or temporary public diagnostic is required. Its existing credential presence, account/action binding, OAuth readiness and scheduling must still be verified under the approved metadata checks. Those operational facts were not inspected or altered in this local preparation. Expired October approvals and untracked validation scripts are not reused.

The worker supplies a mandatory callback that re-reads persisted consent, test status and outbox state **after** validation returns and immediately before live ingest. Direct request-only adapter live calls without this guard fail closed. Selection and mode are rechecked as well. Mocked withdrawal during validation prevents live ingest. The normal worker's existing customer-record eligibility reads continue operationally; approval to observe a receipt does not authorise an operator to browse customer records.

No eligible genuine request means delivery/attribution remain unproved. A missing migration, invalid configuration, expired OAuth access, validation rejection or unsafe runtime identity stops delivery; do not bypass it. Google validation acceptance is not ingestion, processing success or attributed conversion evidence. Required full release CI and production metadata checks remain gates.

## Proposed single owner approval

Once the exact candidate hash is attached, request:

> Approve this request-only Google Ads candidate for push, required checks and normal merge/release; approve only its additive claim migration and secure request-only configuration on the website and CRM. After deployment/configuration checks pass, approve request-only activation at a fresh recorded cutoff. Each eligible genuine request must pass Google validation and a renewed consent/test/state check in the existing secure worker before its single live ingest; hold uncertain outcomes for review. Permit limited status/diagnostic observation of the next genuine eligible request. No GA4, payment, deposit, customer messaging, historical replay or campaign changes. If a release/configuration gate fails, leave reporting disabled; if per-request validation fails, do not ingest that request.

This wording is a proposal, not approval. The owner can approve the exact release and gated activation together; unmet gates cannot be bypassed. There is no separate synthetic validation window or historical test authority to reuse.

## Rollback

Set Ads mode disabled in both consumers first, preserving request scope/cutoff. Do not unset scope while live, since unset selects legacy behavior. Leave the additive function in place and preserve all event receipts/holds. If required, revert application code via normal reviewed release only after disabled mode is verified. Never replay ambiguous events or modify customer/payment records. Already transmitted events cannot be unsent by rollback.
