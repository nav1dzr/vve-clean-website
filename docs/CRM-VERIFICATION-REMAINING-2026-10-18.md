# Verification status and remaining work

Updated 18 October 2026. All evidence here is from the isolated local stack unless explicitly stated. It uses the actual repository API and PostgreSQL with synthetic authentication, a file-backed image adapter, and disabled external messaging/payment providers. These counts describe granular evidence/action rows, not a completion percentage.

## Current coverage

CRM ledger: **481 evidence rows**. Of its **269 browser-action inventory rows**:

- 236 passed in the local browser.
- 16 partly checked; remaining variants are described in the ledger.
- 11 have not been established by a matching browser observation.
- 2 are blocked by browser-tool/security boundaries.
- 2 require an actual provider-created state unavailable in this local environment.
- 2 describe absent controls, not broken buttons.
- 0 records confirmed defects awaiting merged after-proof.

There are also separate API, DB, component and additional browser observations. They must not be counted as proof that an untested UI/provider action works. The owner cancellation confirmation is an additional tool-blocked observation outside the original browser inventory.

Gallery ledger: **89 actions**; the status distribution is:

- LIMITED: 10.
- PARTIAL_API_LOCAL: 2.
- PARTIAL_BROWSER_LOCAL: 4.
- PASS_API_LOCAL: 4.
- PASS_BROWSER_LOCAL: 53.
- UNVERIFIED: 16.

The gallery has four dedicated cloud-integration rows, all separate from local image/DB proof. New Mux video upload/processing remains unverified. Bundled local videos playing does not establish uploaded Mux delivery.

## What the final browser pass established

- Customer creation/editing, exact-contact duplicate advisory, source changes with unrelated notes preserved, search/type/source filters, error retry, booking prefill and leaving unsaved edits. Exact new/changed records are synthetic and original customer/enquiry notes were restored after conflict checks.
- Global search returns the matching booking, clears stale results, preserves the query on failure, recovers by retry, and restores state on browser Back/Forward.
- Enquiry stale edits are rejected with HTTP409 while retaining unsaved notes. Discard/reload recovers the latest version. The customer overwrite was also reproduced, fixed with a conditional version check, and retested: stale PATCH409 retains edits; explicit discard/reload recovers the latest version. Original fixture notes were restored.
- Manual booking dates/payment choices, no-deposit confirmation, deposit-request workflow, synthetic bank-deposit confirmation, proposed booking amendments, explicit customer acceptance, reschedule requests and cancellation requests. The native cancellation prompt was tool-blocked; later read-only DB evidence shows the synthetic appointment cancelled at revision8. This is separate from UI proof.
- The corrected booking panel was retested while its real workflow read was held: neutral loading, no false Draft or unconfigured claim, and Save disabled. Releasing the response showed correct cancellation guidance with refunds separate. That loading/guidance check performed no cancellation. Later root-cancellation-state-readonly.json proves cancellation at revision8, at20:41:02+01:00 on18October; no UI completion is inferred.
- Synthetic invoice/receipt creation and payment persistence, including actual payment-handler success followed by a lost browser response and exact-request recovery. Later financial observations add their precise scope; no real money or delivered email is implied.
- Stored invoice and receipt Download links opened PDFs normally, including the second-page cleaning record. Invoice/receipt21-record pagination, no-match search, receipt-lookup empty/retry state, required/amount boundaries, and saved payment-option selection were exercised. The earlier blocked draft Preview action remains separate.
- A scoped local expiry worker expired one synthetic offer once; a late synthetic bank entry entered staff review, then explicit reconciliation confirmed it. One payment and one resolution event remained. Actual bank movement, scheduler delivery and sent customer messages were not tested.
- Website price search, invalid-value rejection, unchanged-price draft save/retry and saved review. No business prices were changed. Publication remained disabled by readiness configuration.
- Media upload/editor/position filters, before/after and photo publication/history restore, public filtering/deep links, local image display and lightbox keyboard/focus behavior. The latest lightbox-shrink crash was reproduced and fixed; its two new regressions and browser retest pass.
- The final CRM Media keyboard pass reached selectors, file-input focus, captions, archive/restore, position selection, preview and publication using Tab/Shift+Tab, Arrow/Home/End, Enter and Space. Each tested mutation returned200; the database confirms one synthetic PHOTO14 assignment and one history entry. OS-native file-picker traversal and every conditional retry/cancel/history keyboard variant remain outside that proof.

## Exact remaining actions

See **REMAINING-BROWSER-ACTIONS.md** for module/action names, and **remaining-browser-actions.csv** for each limitation and current evidence. Current groups:

- Absent capability: 2.
- Known usability limitation: 1.
- Known workflow limitation: 2.
- Local controls possible; provider completion blocked: 9.
- Outbound interaction deliberately not performed: 3.
- Partial keyboard variants and native-picker boundary: 1.
- Provider or account handoff required: 4.
- Provider state unavailable: 2.
- Tool or security blocked: 3.
- Unavailable in current local configuration: 6.

No unresolved main local workflow is labelled as a runnable check in this closeout. The Media keyboard row remains partial: its main workflow passed, while OS-native file-picker traversal and every conditional retry/cancel/history variant were not keyboard-tested. Other remaining rows have the specific provider, configuration, workflow or tool boundaries listed above. An unverified row is not automatically a known bug. This does not declare every integration or the broader audit complete.

## Boundaries and important limitations

- Real Supabase login/recovery, Stripe checkout/webhooks, real bank reconciliation, actual customer email/Telegram delivery, Mux processing, production R2/CDN behavior and production deployment/smoke testing are unverified here. Failed/suppressed local deliveries and pending Calendar entries are reported honestly.
- Normal stored invoice and receipt Download links were verified in the browser, including the receipt cleaning record on page2. The unsaved invoice draft Preview action remains blocked by the recorded browser/security boundary, separately from stored downloads. The payment-reversal and owner-cancellation native prompts also remain tool-blocked observations. No alternate mechanism bypassed those boundaries; API/PDF-renderer tests are independent evidence.
- Booking payments and invoice payments are separate ledgers. A settled synthetic booking produced an unsent linked invoice draft still showing due. New/saved-draft UI warns and links to payment review, but explicit reconciliation is still P1 planned. Do not record a second real payment merely to make screens agree.
- Gallery combines managed slots with bundled content. Only its existing three service categories are available. True unpublish and arbitrary drag ordering do not exist. Interrupted batches require explicit retry, unsaved metadata can be discarded without warning, and broken-image/RPC fallback feedback needs improvement. These are recorded limitations, not cloud passes.
- Manual Google review-request sending is **plan only**: deliberate owner action, reviewed eligible customer email, branded preview/editing, existing direct Google review link, prior-send history and duplicate guard. No automatic review email was implemented or sent.
- Advertising-consent withdrawal was exercised on one clearly marked local test: confirmation required, reporting flag disabled, fake hashes cleared, unsent test event suppressed and matching/attribution payload emptied. Original request campaign fields remain stored; the revised owner wording makes that distinction. No Google event was uploaded or deleted externally.

## Evidence and validation

Browser evidence: customer-browser-observations-2026-10-18.json; financial-browser-observations-2026-10-18.json; root-browser-observations-oct18-journey.json; root-booking-filter-browser-results.json; root-browser-observations-oct18-pricebook.json; gallery-final-browser-summary.json and its per-action text/screenshot files. Earlier exact observations remain in the ledger.

Strong persisted evidence: browser-invoice-linkage.json; receipt-refresh-browser-db.json (in this report directory); manual-deposit-browser-db.json; phone-only-browser-payment-db.json; booking-amendment-pending-db.json; booking-amendment-accepted-and-reschedule-db.json; booking-cancellation-request-db.json; root-cancellation-state-readonly.json; gallery-final-browser-db.json; invoice-payment-final-browser-db.json. These are read-only checks of marked local PostgreSQL, not bank/provider evidence.

Final coordinated CRM validation in final-closeout-crm-tests.log: 89 files, 1233 tests passed, 0 failed. CRM TypeScript/lint/build logs also pass, with one Fast Refresh lint warning and the existing bundle-size warning. Latest website result: 2459 passed, 0 failed, 299 pending. The consent-copy change is committed and pushed as 2bf69e2 on feature/website-final-completion, with rebuilt browser after-proof. Final release, merge, deployment and live verification remain with the main audit owner. This document does not declare a live release.

The implementation plan is docs/CRM-IMPROVEMENT-PLAN-2026-10-18.md in the approved worktree. Planned features are distinct from the verified fixes.


Raw evidence files named above are preserved in the local artifact folder:
`C:/Users/navid/.codex/visualizations/2026/09/08/01a080b9-7a2b-7dd1-87e3-15320ad66890/crm-gallery-audit-2026-10-15`.
