# Website measurement release: Ads handover

Status recorded 27 September 2026. Website and CRM release is live at main commit `541536317e6014aca4bef8b7402bf711a9801ff2` (PRs #39 and #40). The three approved measurement/notification database migrations are installed in VVE Website. **Google delivery remains disabled. This is not yet a verified live-conversion release.**

## Canonical actions

Google Ads account: `5569099303`. Read-only API verification found all four actions ENABLED and Secondary.

| Event | Action ID | Value and counting intent |
| --- | --- | --- |
| `booking_request_submitted` | `7793322917` | One committed request; no monetary value |
| `booking_request_qualified` | `7793447502` | Reviewed/offered request; no monetary value |
| `deposit_paid` | `7793447505` | Actual verified ledger amount in GBP; no forced £30 analytics value |
| `booking_confirmed` | `7793447508` | Durable confirmation with deposit evidence; no monetary value |

Browser response diagnostics do not submit a second request conversion. Stable event/transaction identifiers and a durable delivery outbox protect retries. Do not make both deposit and confirmation Primary for the same customer outcome. Existing phone/WhatsApp/started diagnostics remain separate. No GA4 property or GTM container was added.

## Evidence completed

- Required Root/Admin CI validation passed. Root: 133 test files, 2,068 passed, 283 skipped.
- `VVE-MEAS-OS-E2E-20260927`: 11 connected request/payment checks passed against VVE OS, including duplicate request handling, signature validation, unpaid-event rejection and paid-event replay deduplication.
- `VVE-MEAS-OS-GOOGLE-20260927`: 4 connected delivery-worker checks passed. Google validated all four milestone payloads; an injected transient failure retried successfully and a subsequent run sent nothing again. The fixture used 4,700 pence to verify non-hardcoded value handling.
- These used synthetic payments and Google `validateOnly`; **zero real charges and zero counted conversions**. Test provider notifications were not delivered externally.
- Production website deployment READY, CRM deployment status SUCCESS, live website and authenticated CRM opened successfully.
- Existing 10-minute worker dispatch schedule remains active. Its three inspected SQL dispatch runs succeeded; provider completion is a separate check.
- Ads auto-tagging is enabled and customer-data terms are accepted. The four action IDs and supplied-value deposit setting were verified using read-only Google Ads API queries.

## Still required

1. Live internal test **completed** with explicit approval: `VVE-LIVE-MEAS-20260927-01` / `E81AA171026`. One request, one submitted milestone even after refresh; customer email verified in the owner inbox. Business email and Telegram each recorded one successful provider-send attempt (recipient inbox/chat not independently opened). Test cancelled, marked test and measurement suppressed. No journey/payment rows or deposit request. The rejected empty-date attempt created zero bookings.
2. Ads owner/task: verify and, with authorization, configure enhanced-conversion eligibility. `enhanced_conversions_for_leads_enabled` was selected but omitted from the API response (default false/not reported enabled). Do not assume terms acceptance alone enables hashed matching. See [Google's setting definition](https://developers.google.com/google-ads/api/reference/rpc/v24/ConversionTrackingSetting) and [account-level setup](https://support.google.com/google-ads/answer/14662970?hl=en). Review the current UI before changing any automatic user-data collection behavior.
3. After prerequisites and production test pass, activate website reporting through the controlled release process. Currently `BOOKING_MEASUREMENT_MODE=disabled`; saved OAuth credentials alone do not start uploads.
4. Reconcile the first genuine consented, attributed request/payment through outbox acknowledgement and Ads diagnostics. Validation-only receipts prove payload acceptance, not attribution or counted conversions. Do not fabricate a click or submit synthetic paid conversions to obtain a dashboard count.
5. Keep new actions Secondary until reconciliation. Assess the old Primary deposit action and campaign goals separately in the Ads task; this website release changed no Ads settings or campaign goals.

## Boundaries

Prices, configured deposit amounts, Stripe behavior, DNS and real customer records were not changed in this release. No real customer emails were sent by these release tests. The explicitly approved synthetic request sent owner/business email and Telegram alerts. Its customer email was independently verified in the owner inbox; business and Telegram evidence is the successful provider-send status. The customer's earlier reported successful paid booking remains separate historical evidence.

Full release record and OS test evidence are in `BOOKING-MEASUREMENT-RELEASE-2026-09-24.md`, `BOOKING-MEASUREMENT-OS-E2E-2026-09-27.json` and `BOOKING-MEASUREMENT-OS-GOOGLE-2026-09-27.json`.
