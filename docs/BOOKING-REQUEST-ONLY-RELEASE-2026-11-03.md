# Website click-ID request tracking — 3 November 2026

## Approved scope

Plan VVE-20261103-CLICK-ID-REQUEST-TRACKING-V1, SHA256 896d8cfc02a1e865cf7e3a71afbab5e9aea5ca7a4805f4f0d6f601b9ba0c082b, authorises proposal B. The human accepted reduced matching coverage. Released baseline is 6faaa4f50a2aaaf1bc7e6398893b8b841ea9132b. This amendment changes only api/_lib/depositMeasurement.js, tests/api/booking-request-only-measurement.test.js and this document. Preserve unrelated local work.

Implementation executor may push a candidate and obtain exact-head CI/previews, but must STOP BEFORE MERGE for coordinating-chat independent source review and explicit executor handoff. The immutable candidate receipt records commit/tree/diff and tests. No activation in this preparation phase.

## Runtime contract

Only the WEBSITE runs the existing scheduled reporting worker. CRM remains disabled, receives no credentials and needs no scope/cutoff changes. Website configuration must be staged while disabled:

- BOOKING_MEASUREMENT_SCOPE=request_only
- BOOKING_MEASUREMENT_MATCHING=click_id_only
- BOOKING_MEASUREMENT_REQUEST_SINCE=a fresh reviewed UTC ISO timestamp with milliseconds; never backdate
- BOOKING_MEASUREMENT_MODE=disabled until release/configuration gates pass
- Existing advertiser 5569099303 and request action 7793322917 must be verified, not recreated. Existing website Data Manager credentials are reused without export.

Missing or unknown request matching configuration fails closed. With all three selection values absent, legacy behaviour remains compatible; never enable reporting with scope missing. Direct adapter use cannot override disabled/validate mode into live. Configuration is checked again after OAuth preparation, after validation and after the asynchronous eligibility guard. Removing scope cannot silently turn an in-flight request into legacy delivery.

For request-only delivery, choose one usable identifier in existing precedence order: gclid, then gbraid, then wbraid. The request payload omits userData and encoding even when stored hashes exist. It retains consent, event time, stable canonical transaction ID and WEB source. Requests have no monetary conversion value. Legacy payload behaviour is unchanged and is not activated.

Newly eligible claimed requests without a usable click ID are suppressed before OAuth/ingestion with request_click_id_unavailable and no retry. This narrow operational state update is expressly covered by the amendment. It does not delete hashes, edit customer content, backfill history or replay old events. Submitted receipts are still polled without re-upload even if matching data is absent. A failed exclusion-state save stops rather than claiming a successful exclusion.

## Existing safeguards retained

The already released claim function filters request event, provider, non-test status and both creation/occurrence timestamps at or after cutoff atomically. No new migration is included. Existing consent/test/state checks run before preparation/send and again after validation. Every request passes identical-payload validateOnly preflight before live ingestion. Provider errors, warnings, malformed validation or timeouts stop live ingestion. Unknown send outcomes and failed processing stay held for review; a failed receipt save leaves sending for existing stale-send quarantine. No automatic replay.

Google validation is not a live conversion. Ingestion acknowledgement is not terminal processing. Terminal processing is not proof of Ads attribution. The current batch cap is ten, not a one-event canary.

## Validation and release gates

1. Run offline mocked request/worker/legacy/deposit/GA4 regressions, lint and TypeScript. Cover identifier precedence, omitted hashes, missing/invalid identifiers before OAuth, consent/test exclusions, configuration changes, receipt polling and uncertainty holds. No synthetic live uploads or customer data are required.
2. Produce immutable candidate manifest and normal PR. Obtain all required exact-head checks and website/CRM previews. Coordinating chat reviews source and hands off a single release/configuration executor before merge.
3. After approved normal merge, verify website production source is READY. Verify CRM remains disabled, website credential presence, exact advertiser/request action and the established website scheduler. Do not invoke the multi-purpose worker manually.
4. Stage website selection/matching/fresh cutoff while mode stays disabled. Verify the complete configuration before activation. Preserve GA4 and CRM settings. No Google lead-method Save, tag edit, new action, goal or campaign change.
5. After gated activation, allow existing scheduler to process genuine eligible requests. Observe only permitted opaque event/status/time/attempt/receipt evidence and aggregate reporting. Demonstrate one canonical request identity, preflight, ingestion receipt, terminal processing, and no resend on subsequent polling. Check Ads attribution separately after processing delay. No eligible genuine traffic means awaiting evidence, not complete.

## Coverage, privacy and exclusions

Requests lacking stored valid click IDs, including hash-only requests, are not uploaded. This does not measure every enquiry, phone call or WhatsApp conversation. Existing Google-managed automatic browser detection remains unchanged; this amendment neither adds collection nor certifies that separate setup. Enhanced lead matching and browser collection narrowing require a separate reviewed scope.

No schema, Stripe, deposit, price, payment, GA4, customer notification, scheduler, credential provisioning, historical cleanup or Google setting changes are included.

## Rollback / stop

Keep website mode disabled if a release/configuration gate fails. On unexpected payload, provider prerequisite, warning or ambiguous delivery, disable website reporting and hold affected events without replay. Preserve matching/scope/cutoff, receipts and database history; do not unset selection while live. CRM remains disabled. Any code rollback uses normal reviewed release. Already transmitted events cannot be unsent.
