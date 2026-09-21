# VVE Clean booking and advertising measurement audit

Reviewed 17 September 2026. Baseline: `db960ecffbf075377f1039f7b97da2cadc130ee5` (latest approved website/email release). Audit branch: `codex/booking-measurement-audit-20260917`.

## Decision

**The booking system has substantial tested safeguards, but paid-conversion measurement is not finished. Do not describe it as fully verified or optimise Ads around its current payment signals.** The approved website/email design is released; that is different from proving every operational and measurement requirement.

No production records, Stripe configuration, deposit amounts, prices, secrets, Ads settings or deployments were changed. This is a report-only audit; the proposed fixes below are not live. Existing historical transactions and customer messages were left alone.

## Evidence and limits

Source inspection covered the form, attribution/consent, contact tracking, request endpoint, CRM offer/payment handler, Stripe webhook, legacy payment confirmation, customer wording and relevant tests. Public production HTML and JavaScript were fetched without submitting forms or firing browser analytics.

The live homepage loads `index-BznLOxcf.js`; its application loads `analytics-TB5gTeVW.js`. That tracking chunk contains the current event names and three Ads labels listed below. Its optional GA4 measurement ID is compiled as undefined and its optional request conversion label is absent. Therefore **the optional GA4 integration and direct request conversion action are not configured in this production build**. A destination connected remotely to the Google tag might still exist: that cannot be determined from source. The Ads base tag's ownership and dashboard configuration also remain unverified.

No authenticated Ads/GA4 dashboard inspection, network collection trace, real payment, new production request or live email/Telegram delivery test was performed. A passing mocked test is not evidence that Google received a conversion or that a message reached an inbox.

## 1. Current request/payment implementation

| Stage | Implementation and conclusion | Source reference |
|---|---|---|
| Request | Server validates details and trusted prices, saves before notification, then returns an opaque request UUID. Browser calls success tracking only after an accepted response. No payment is taken. | `src/pages/BookingPage.tsx:695`, `:758`, `:774`; `api/create-booking-request.js:577`, `:637`, `:687` |
| Retry | Request key/fingerprint handles lost responses and concurrent retries. A replay returns the saved request instead of inserting or emailing again. The API still permits callers without a request key. | `api/create-booking-request.js:80`, `:144`, `:464`, `:473` |
| Notifications | Customer and owner SMTP messages, plus Telegram alert. A saved request can succeed even when notification delivery fails. A replay does not automatically retry initial notifications. | `api/create-booking-request.js:257`, `:315`, `:664`, `:675` |
| Offer | CRM saves agreed details and sends a deposit offer. Deposit-based offers remain offered until payment. A separate explicit `after_clean` mode can directly confirm without a deposit; this is an operational exception to the user's universal paid-first rule. Do not silently alter existing agreements. | `admin/api/_lib/bookingJourney.js:620` |
| Stripe | Server creates a checkout using the configured deposit and redirects to the private management page. Stripe metadata binds payment to booking, offer version and payment kind. | `admin/api/_lib/bookingJourney.js:1003`, `:1012`, `:1060`, `:1065` |
| Verified deposit | Signature-verified webhook invokes payment reconciliation. Currency, paid status, amount and offer/session validity are checked. Ledger uses Stripe session ID; repeat delivery does not create another payment. Late/stale payments go to review rather than confirming a cancelled booking. | `api/stripe-webhook.js:549`, `:565`; `admin/api/_lib/bookingJourney.js:1113` |
| Bank transfer | Staff must explicitly confirm receipt. Recorded transfer and reference are reconciled once; valid deposit confirms the appointment without creating another Stripe payment. | `admin/api/_lib/bookingJourney.js:732` |
| Customer confirmation | Payment reconciliation queues confirmation/receipt and owner notifications. Delivery retry is separate from payment recording. There is **no `deposit_paid` analytics dispatch** here. | `admin/api/_lib/bookingJourney.js:1113`, `:1253` |

Payment ledger and message deduplication are established in `supabase/migrations/20260908100000_booking_journey.sql:53`, `:72`, `:114`. Unit tests exercise application behaviour with mocked persistence; the deployed database function was not re-audited through production SQL during this pass.

The deposit currently genuinely uses `DEPOSIT_PENCE = 3000` in `admin/api/_lib/bookingDeposit.js`. This audit does not change that amount. Analytics must nevertheless use the **actual verified payment amount**, not copy that constant.

## 2. Current event inventory

These are code-configured emissions, not a claim that every event was observed arriving at Google.

| Current event | Trigger | Current Google Ads destination / issue |
|---|---|---|
| `quote_start` | Calculator interaction | Diagnostic only in code |
| `quote_complete` | Proceeding from quote | Diagnostic; not a saved request |
| `booking_initiated` | Quote/book CTA | Direct `conversion` to `AW-18214693277/cmLZCIm-6eEcEJ3TuO1D`; dashboard must be secondary |
| `request_start` | First request-form interaction | Rename to `booking_request_started` |
| `form_error` | Validation/submission error | Diagnostic, never a completed request |
| `request_submitted` | Accepted request response | Rename to `booking_request_submitted`; optional direct Ads label is absent in live build |
| `phone_click` | Telephone link | Rename to `phone_contact`; no dedicated direct Ads action in this helper |
| `whatsapp_click` | WhatsApp link | Rename to `whatsapp_contact`; direct `conversion` to `AW-18214693277/zzetCIy-6eEcEJ3TuO1D` |
| `email_click` | Email link | Separate interaction |
| `contact_form_submitted` | Accepted contact enquiry | Direct `conversion` to `AW-18214693277/XA4UCI--6eEcEJ3TuO1D` |
| Legacy `conversion` | Verified payment on old `/confirmation.html` | `AW-18214693277/hUwdCK68gswcEJ3TuO1D`; fixed value, wrong path for current emailed offers |
| `leaflet_booking_completed` | Legacy paid page with leaflet attribution and no gclid | Alternative to legacy Ads conversion; GA4 destination not established |
| `deposit_paid` | — | **Missing** |
| `booking_confirmed` | — | **Missing as analytics; operational state exists** |

Exact definitions: `src/lib/analytics.ts:24`, `:47`, `:51`, `:56`, `:61`, `:69`, `:87`, `:90`, `:93`. Call sites: `src/pages/BookingPage.tsx:774`, `:788`, `:949`; `src/components/QuoteCalculator.tsx:355`, `:699`, `:909`; `src/pages/Contact.tsx:76`. Link handling is centralised in `src/components/ContactLinkTracking.tsx`.

Base Ads configuration: `index.html:90`. Optional GA4 configuration requests `send_page_view: true` at `src/lib/analytics.ts:99`, but is inactive in the inspected build. Other automatic Google-tag events, enhanced measurement and remotely linked destinations require dashboard/network verification. No GTM container installation was found in the audited source: loading `googletagmanager.com/gtag/js` is not itself a GTM container.

## 3. Duplicate counting and attribution risks

1. **New deposit journey emits zero deposit-paid events.** Its success URL is the private management page, not the old confirmation page. Refresh/retry protection in the payment ledger does not automatically create analytics protection.
2. Request deduplication (`src/lib/analytics.ts:79`) is module memory plus session storage only when advertising consent exists. Without that consent, a module reload loses its guard. It is not a cross-tab, cross-device or server delivery guarantee. The helper also permits a missing request UUID. A generic GA4 event's `transaction_id` is not a universal deduplication mechanism.
3. Legacy confirmation uses `ref || sid` for the transaction ID (`public/confirmation.html:668`). The same payment may have two identifiers depending on URL. The reference includes postcode/date. The marker is written after a callback or timeout (`:765`), leaving a duplicate window on quick revisits; a timeout also does not prove successful delivery. Storage calls outside a safe guard can fail in restricted browsers.
4. Legacy conversion value is hardcoded to 30 (`public/confirmation.html:787`, `:799`). Verification returns only paid/livemode (`api/verify-payment.js:28`), not actual amount or payment kind. Its session fallback does not establish a deposit-only conversion contract.
5. Both an imported GA4 key event and a direct Ads conversion must not be primary for the same deposit. The current code's label name `SECONDARY_ADS_CONVERSIONS` cannot enforce account settings.
6. Click/start actions currently emit direct Ads conversions. If configured primary, bids may optimise for interactions rather than bookings. This is a dashboard risk, not evidence of the current account setting.

Google documents Ads transaction IDs separately from [GA4 purchase deduplication](https://support.google.com/analytics/answer/12313109?hl=en). Use an opaque stable payment identifier and a durable server dispatch record; do not assume a generic custom event gets purchase deduplication. See [Ads transaction IDs](https://support.google.com/google-ads/answer/6386790).

## 4. Consent, privacy and attribution

**Working foundations:** main HTML defaults all four Consent Mode signals to denied before tag loading (`index.html:65`); category updates map analytics and advertising separately (`src/lib/consent.ts:45`). Main consent restoration checks policy version (`:60`). Advertising attribution waits for consent and expires after 30 days (`src/lib/attribution.ts:57`, `:231`). Stored landing path strips query/fragment (`:203`). Private management pages are excluded by `src/lib/privatePage.ts` and the HTML guard.

**Gaps:**

- `gbraid`, `wbraid` and `utm_term` are absent. gclid and four UTMs are captured and saved (`api/create-booking-request.js:609`), but the payment handler does not carry them into a measurement dispatch.
- No consent snapshot/version/time or GA client/session identifiers accompany the booking measurement journey. Server acceptance of attribution fields does not independently establish permission for a later upload. Withdrawal/retention policy for server-held attribution needs definition.
- The stored consent timestamp is not used for expiry; version changes prompt again. Advanced Consent Mode loads Google tags with denied consent and can send cookieless signals. This is not equivalent to blocking all pre-consent communication. Review the chosen policy against the actual banner and UK requirements, rather than claiming Consent Mode alone proves compliance. [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode), [ICO advertising guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-the-rules-apply-to-online-advertising/).
- The legacy confirmation page restores consent without the main policy-version check (`public/confirmation.html:24`) and reads measurement storage independently. Its tag can see a URL containing private reference/token/session parameters; its explicit conversion ID can contain postcode/date. `no-referrer` does not itself sanitise Google's collected page URL. Retire measurement on that private page or explicitly suppress/sanitise it before tags load. [Google PII guidance](https://support.google.com/analytics/answer/6366371?hl=en).
- Current request event IDs are restricted to UUIDs, and event parameters do not intentionally include customer names, phone numbers, email or addresses. However the legacy reference/URL issue prevents a blanket privacy pass. Arbitrary UTM/query input also needs an allowlist/sanitisation policy before being forwarded to Google.
- Test/preview domains suppress browser tracking and legacy Stripe test-mode payments are excluded, but there is no durable `is_test` booking/payment exclusion feeding production analytics. A live-card test could still count on the old path. Never infer test status only from a customer's name.

For Stripe-hosted payment, preserve consented attribution on the booking server-side before redirect, then associate it with the verified payment. Do not rely on a thank-you page or assume Stripe can run VVE's GA tag. Review payment-provider unwanted referrals in GA4; that does not recover missing click IDs or join an emailed payment days later. [Google payment-provider referral guidance](https://support.google.com/analytics/answer/10327750?hl=en).

## 5. Customer wording and notifications

Use consistently: **“No payment is required to submit a booking request. After we review and confirm the job details, we’ll email your deposit payment instructions. Your booking is confirmed once the deposit is paid.”**

| Finding | Exact source | Proposed correction |
|---|---|---|
| Telegram says no payment is required to confirm and to confirm directly | `api/create-booking-request.js:322` | Explain unpaid request → review → deposit instructions → paid confirmation |
| Disabled old checkout endpoint says “No deposit is required” | `api/create-checkout-session.js:110` | Keep endpoint disabled, correct explanation only |
| EOT wizard implies direct confirmation following contact | `src/components/EotQuoteWizard.tsx:1340`, `:1346` | Explicitly distinguish requested time from deposit-confirmed booking |
| Request success/form explanation mentions deposit options but can state the confirmation condition more clearly | `src/pages/BookingPage.tsx:890`, `:1490` | Use the consistent sequence |
| Explicit no-deposit/after-clean agreements remain supported | `admin/api/_lib/bookingJourney.js:383`, `:620` | Owner policy decision; retain truthful wording for historical exceptions |

Do not globally replace references to tenancy security deposits or historical refunds. Existing fixed £30 references are supported by current business configuration, but future measurement must use the received amount.

Email/Telegram remain unchanged by this audit. Request SMTP success means transport acceptance, not inbox receipt. Telegram currently marks success from HTTP `response.ok` (`api/create-booking-request.js:315`) without checking the provider's JSON `ok`; strengthen that check. Consider a durable initial-request notification outbox to recover a crash after saving but before sending.

## 6. Tests performed

Audit test run IDs below are labels for local synthetic test runs, **not new customer records or live conversion IDs**. All use the repository's test fixtures/mocks.

| Audit ID | Suite / result | Evidence provided |
|---|---|---|
| VVE-MEAS-20260917-01 | Request API: 16 passed | Valid save; invalid scheduling rejected; same/concurrent request key produces one saved request and one pair of email sends; customer reply routing; mocked Telegram send |
| VVE-MEAS-20260917-02 | Booking page: 30 passed | Validation prevents sending; accepted no-payment request; lost-response retry retains request key; no Stripe redirect |
| VVE-MEAS-20260917-03 | Analytics: 14 passed | Separate interactions; same UUID twice produces one `request_submitted` plus one configured Ads call; invalid identifiers/private/preview pages suppressed |
| VVE-MEAS-20260917-04 | Attribution: 23; consent regressions: 17 passed | Existing consent/storage and attribution contracts, not a legal certification |
| VVE-MEAS-20260917-05 | Legacy confirmation: 16; Stripe webhook: 23 passed | Unverified payments do not show success; webhook handling and notification contracts |
| VVE-MEAS-20260917-06 | CRM booking journey: 57 passed | Deposit request; verified card payment; bank transfer; duplicate receipt; unpaid return; stale/late payment review; notification retry |

**Total: 196 tests passed across eight test files.** A requested `verify-payment.test.js` path did not match a standalone suite; the runner executed the seven matching website suites plus the separate CRM suite. No claim is made of standalone verify-payment coverage.

Specific reproducible evidence: `tests/api/create-booking-request.test.js:241` (concurrent replay), `:377` (customer/owner multipart email), `:406` (Telegram); `src/lib/analytics.test.ts:97` (single request event under repeated call); `admin/tests/api/_lib/bookingJourney.test.js:846` (one paid deposit/confirmation), `:875` (bank transfer), `:360` (unpaid return), `:582` (wrong amount/currency).

**Required one-request/one-deposit analytics acceptance result:** partial/fail. Local evidence supports one existing `request_submitted` invocation for repeated same-ID calls in the tested context. It does not establish end-to-end GA4 ingestion or all refresh cases. One successful new-journey payment produces **zero `deposit_paid` events**, so that requirement fails. Payment ledger idempotency passes its mocked tests; analytics idempotency is missing.

Live delivery evidence is limited to Navid's earlier report that TEST request `E81AA210926 / VVE-TEST-20260914-01` was saved and its notification arrived. This audit did not independently recheck that delivery or resend it. It remains TEST ONLY: do not attend, request money or count it as a customer. A new approved isolated end-to-end test is needed for current live delivery and Google ingestion evidence.

## 7. Proposed implementation order

1. Correct contradictory copy and Telegram response validation. Require the returned opaque request UUID before success measurement. Rename the four requested lead/contact events; do not emit both old and new names as conversions.
2. Choose one primary paid-conversion route with the Ads owner: server/offline Ads conversion or a supported GA4 event import. GA4 reporting can coexist, but must not create a second primary Ads customer.
3. Add consented attribution/test metadata and a durable measurement outbox through an explicitly approved database migration. Persist a unique opaque payment event key, actual received amount/currency, paid timestamp and delivery state in the same reliable processing flow as the verified ledger. Include manually verified bank deposits; never emit on “send deposit request”. Do not send customer contact details or postcode references.
4. Add a retry worker/provider acknowledgement handling and reconciliation. Use provider-supported deduplication; arbitrary GA4 custom-event delivery cannot promise exactly once across network uncertainty. Do not mark a timeout as proof of receipt. Operational `booking_confirmed` may be logged separately, never another primary Ads conversion for the same deposit.
5. Retire/sanitise legacy private-page tracking and its fixed value without changing historic payment records or Stripe behaviour. Keep payment verification and customer access working.
6. Test denied/granted/withdrawn consent, gclid/braid campaigns, refresh/replay, multiple tabs, webhook retries, delayed payment, bank receipt and live-mode test exclusion. Then verify one request and one payment in provider diagnostics using approved test records before promotion to primary.

No new production secret or migration is needed merely to rename browser events, but naming alone will not complete paid attribution. Do not deploy an apparently complete tracking patch while the server delivery and destination configuration remain missing.

## 8. Manual Google Ads / GA4 checklist for Navid or the Ads operator

- Verify `AW-18214693277` belongs to the intended production account and inspect destinations linked to its Google tag. Supply/confirm the correct GA4 web-stream ID; it is absent from the inspected build.
- Check current action IDs above: booking CTA, WhatsApp and contact enquiry should be secondary if using the recommended strategy. Code names do not set this.
- Create/map `booking_request_started`, `booking_request_submitted`, `phone_contact`, `whatsapp_contact`; request submission stays secondary until verified. Ensure old event imports do not duplicate new ones.
- Create the paid-deposit action using the chosen supported integration. Set dynamic actual value, GBP when the received currency is GBP, appropriate count/window and primary status only after verified testing. Do not make both direct and imported versions primary.
- Leave `booking_confirmed` diagnostic/secondary when it refers to the same customer payment. Review account-default and campaign-specific goals, not just the action list.
- Review auto-tagging, consent diagnostics, unwanted payment referrals and any remotely configured enhanced measurement. Keep private URLs and customer details out of collection.
- Establish test exclusion before running live-mode tests. Do not import the known TEST booking or its payments.
- Use Tag Assistant/GA4 DebugView and Ads diagnostics for the approved end-to-end run. Confirm delivery and deduplication separately from attribution eligibility; some reporting is delayed.

None of these dashboard changes was made by this audit.

## 9. Files changed and deployment

Only this report was added: `docs/BOOKING-MEASUREMENT-AUDIT-2026-09-17.md`. Runtime application files were not changed. No push, merge, database mutation or deployment was performed. Production retains the existing approved release and the measurement gaps described above. Local dependency junctions were created solely to run the existing tests and are not release content.

## Copy to the Google Ads optimisation task

VVE audit 17 September 2026: the new CRM deposit flow verifies Stripe/bank payment and has tested ledger replay protection, but **does not emit `deposit_paid`**. Current browser events are `request_submitted`, `request_start`, `booking_initiated`, `phone_click`, `whatsapp_click`, `contact_form_submitted`, `email_click`, `quote_start`, `quote_complete`, `form_error`. Recommended request/contact names are not yet deployed. Live Ads base ID: **AW-18214693277**. Optional GA4 ID and request Ads label are absent in the inspected production build; remotely linked destinations/dashboard goals are unverified. Legacy `/confirmation.html` sends action **hUwdCK68gswcEJ3TuO1D**, hardcodes value 30 and is not the current emailed-payment return path. Do not treat it as verified new-flow deposit measurement. **196 local tests passed; no live test payment, Google receipt proof or production changes.** Keep lead/contact actions secondary pending verification. Implement consent-backed server paid-event delivery with actual received amount, opaque deduplication ID and test exclusion; choose one primary Ads route. No Ads settings were changed. Known TEST request E81AA210926 must be excluded.
