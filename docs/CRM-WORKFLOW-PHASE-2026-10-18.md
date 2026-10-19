# CRM manual booking and workflow refinement — 18 October 2026

## Scope and release boundary

Implemented in `feature/website-final-completion` at `D:\VVE_WORKTREES\website-final-completion`. This phase makes manual bookings easier to create, protects uncertain saves from duplication, and removes conflicting booking/payment controls. It does not change the public website deposit journey, the £30 deposit amount, Stripe behaviour, service prices, DNS, production secrets or production data. No production deployment was performed by the workflow subagent. Root owns the final full-suite validation, review, commit and release decision.

The runtime checks used the isolated CRM at `127.0.0.1:8871`, a real local PostgreSQL/PostgREST database, simulated authentication, and disabled external delivery/payment adapters. They are API/database evidence, not proof of delivery to Gmail, Telegram, Stripe, Google Calendar or a live customer. Parent-agent browser evidence is tracked separately.

## What changed

### Manual creation and recovery

- Bookings now has an **Add booking** entry leading to customer selection or creation. The customer page explains the next step.
- Manual creation requires an explicit **£30 deposit** or **No deposit — payment on the cleaning day** choice. There is no source-based default. The selected arrangement and optional arrival window survive a fresh booking read and initialise the agreement form.
- Phone-only customers can remain phone-only; an optional email can be added to this booking without overwriting the customer's saved record. No email address is fabricated. Actual API testing confirmed that a no-deposit appointment can be confirmed without customer email; delivery limitations remain explicit.
- Checkatrade is an owner-facing source choice stored compatibly as `other` plus `Customer source: Checkatrade.` in notes. Editing the source preserves unrelated notes; no database enum or migration was added.
- The browser assigns one stable request UUID and retains the exact submitted request in account/customer-scoped session storage. A retry after a lost response or refresh uses the same UUID and payload.
- The backend uses the booking primary key for idempotency, checking the original normalised payload fingerprint and authenticated owner/customer binding. Simultaneous identical requests return one booking. Reusing the UUID with a different amount, customer or admin is rejected. Existing callers without the optional UUID remain compatible.
- Expired recovery removes the submitted customer details but retains the non-PII operation UUID. A read-only lookup verifies the stored booking's owner and customer before offering **Open saved booking** or **Start a different booking**. Old/corrupt markers without a UUID retain a truthful history-review path; owners are no longer forced to claim that no booking exists when one was saved.
- Blocked session storage prevents an unsafe new submission. Logout clears pending requests. A late save response cannot navigate away from a different customer's page.

### One managed booking workflow

- Booking detail now reads journey state for paid/completed records too, not only fresh unpaid requests. An unexpected agreement-read failure returns retryable 503 instead of exposing the wrong editing controls. Missing legacy migration remains compatible.
- For a journey-managed booking, the legacy **Update booking status** and **Save balance status** controls are hidden. Appointment confirmation, cancellation, completion and recorded payments use the existing agreement workflow. The old internal balance summary is also hidden to avoid displaying a stale total-minus-deposit calculation beside the payment ledger.
- Existing status and balance API guards continue returning 409 for managed records; no action silently sends a cancellation or changes payment data.
- Cards, list, search, dashboard and detail derive the payment arrangement from the saved agreement. Confirmed no-deposit bookings display **No deposit required**, with **Due on cleaning day** while the balance is not yet due. This does not set `payment_status=paid` or claim money was received.
- A pending change continues using the previous accepted agreement's payment plan. Proposed details are not presented as already accepted. The card's appointment badge reflects the journey state where available.
- Raw request configuration, including technical identifiers, is collapsed under **Technical request details** rather than occupying the main service section.
- Booking list filters and the deposit column now distinguish **Deposit pending / Deposit paid** from the separate balance. No-deposit rows retain **No deposit required**. Help explains using Balance status and leaving Deposit status on All for no-deposit jobs; API filter values and financial behaviour are unchanged. The list now ignores stale success/error responses after filters change or the component unmounts.

## Source files

Manual creation and source handling:

- `admin/api/_lib/customerLifecycle.js` — manual input validation, saved choice/window, UUID replay guard and owner/customer/payload binding. Other customer identity work in this shared file belongs to the separate identity audit.
- `admin/src/types/customer.ts` — optional manual request UUID, payment arrangement and arrival window.
- `admin/src/components/ManualBookingModal.tsx` — explicit choice, optional email, stable retry, expired recovery resolution.
- `admin/src/lib/pendingManualBooking.ts` — scoped session recovery and expiry.
- `admin/src/lib/invoiceDraftRecovery.ts` — pending-manual-booking cleanup on the existing logout path.
- `admin/src/lib/customerSource.ts` — compatible Checkatrade marker handling.
- `admin/src/pages/CustomerFormPage.tsx`, `CustomerDetailPage.tsx`, `CustomerListPage.tsx` — source choice, manual creation and navigation.
- `admin/src/pages/BookingListPage.tsx` — Add booking entry and derived badges.
- `admin/src/lib/bookingAgreementDefaults.ts`, `admin/src/components/BookingJourneyPanel.tsx` — explicit manual arrangement restoration and accurate introduction.

Managed status/payment display:

- `admin/api/bookings/[id].js` — authoritative detail state and fail-closed read error.
- `admin/api/_lib/bookingFields.js` — active payment-plan projection and card enrichment.
- `admin/api/dashboard-summary.js`, `admin/api/search.js` — enriched summary/search cards.
- `admin/src/types/booking.ts`, `admin/src/lib/format.ts` — safe derived arrangement and badge labels.
- `admin/src/components/BookingCardItem.tsx`, `admin/src/pages/BookingDetailPage.tsx` — consistent cards and removal of invalid legacy editing controls.

Relevant regression tests are beside those components/helpers and in `admin/tests/api/customers/id.test.js`, `admin/tests/api/bookings/{id,balance,index}.test.js`, `admin/tests/api/_lib/bookingFields.test.js`, `admin/tests/api/dashboard-summary.test.js` and `admin/tests/api/search.test.js`.

## Validation and evidence

Evidence directory:

`C:\Users\navid\.codex\visualizations\2026\09\08\01a080b9-7a2b-7dd1-87e3-15320ad66890\crm-gallery-audit-2026-10-15`

Final focused regression run: **143 passed across 11 files**, `manual-status-final-tests.log`. This is not the complete repository suite. TypeScript passed (`manual-status-typecheck.log`) and changed-file lint passed (`manual-status-lint.log`). Earlier manual idempotency-specific run: **44 passed**, `manual-idempotency-after.log`; counts overlap and must not be added together.

Final independent review found and closed an additional uncertain-write response gap: a failed database insert response was mapped to HTTP 400, allowing the form to discard its request UUID even if the insert had committed. Manual booking insert and customer-lookup operational failures now return 503, preserving the same request for reconciliation. `admin/tests/api/_lib/manualBookingOperationalFailure.test.js` simulates both committed-then-lost and pre-commit database responses; same-UUID retry leaves exactly one booking. The two insert regressions failed before the fix (`manual-operational-before.log`). The follow-up run passed **68 tests across 5 files** (`manual-operational-after.log`), including three new operational-failure tests and the existing API/form/recovery suites. These counts overlap earlier runs. TypeScript and changed-file lint passed again (`manual-operational-typecheck.log`, `manual-operational-lint.log`).

Final browser follow-up found the booking list could show an older unfiltered response under a new selected filter. Actual isolated API reads were correct: all 21 fixtures; deposit-paid filter 1; balance-paid filter 1 (a settled no-deposit booking); confirmed filter 5 (`booking-filter-read-runtime.json`). A delayed-response component regression failed before the generation guard; deposit-label assertions also failed before the copy change (`booking-filter-before.log`: 2 failed, 8 passed). After the fix, **48 tests across 4 files** passed (`booking-filter-after.log`), with TypeScript and changed-file lint passing (`booking-filter-typecheck.log`, `booking-filter-lint.log`). Root will recheck the rebuilt browser. A distinct no-deposit filter remains a possible follow-up, not an implemented financial rule.

Reproduction evidence before fixes:

- `booking-status-before.log`: 3 failed / 45 passed — conflicting legacy controls, missing managed state on paid bookings, ignored agreement-read error.
- `booking-payment-labels-before.log`: 2 failed / 22 passed — no-deposit cards lacked the authoritative plan and showed misleading labels.
- `manual-expired-recovery-before.log`: 2 failed / 6 passed — no saved-booking resolution after expiry. Root also reproduced the actual overnight recovery dead end in the browser.
- `manual-idempotency-before.log`: 1 failed / 21 passed — original manual save lacked the replay guard.

Actual isolated API/database evidence:

| Evidence | Result | What it proves |
| --- | --- | --- |
| `manual-concurrency-review.json` | 5/5 | Concurrent identical manual POSTs returned the same booking; database has exactly one booking and one creation note; changed amount/customer rejected 409; exact later replay returns original. |
| `manual-booking-after.json` | 14/14 | Both explicit arrangements and arrival windows persist; no-deposit send confirms with zero paid/no checkout; deposit option is offered awaiting payment. Notification kinds are correct; external delivery is blocked. |
| `manual-phone-only-runtime.json` | 7/7, environment-agent proof | Customer without email can be created and directly confirmed with no deposit. No customer email delivery is claimed. |
| `booking-status-payment-runtime.json` | 18/18 | Status and balance bypasses reject 409; unpaid completion denied; wrong/unacknowledged bank deposit denied; recorded £30 confirms both state models; duplicate retries denied; price and completion guards behave as described below. |
| `booking-status-payment-evidence.json` | Read-only DB check | Deposit fixture has exactly one `manual_deposit` row totalling 3000 pence and journey paid amount 3000. No-deposit fixture has one `manual_balance` row totalling 10000 pence. |
| `receipt-concurrency-review.json` | 5/5 | Independent review: concurrent same-UUID receipt creates one receipt and one creation event; changed payload rejects 409; exact replay returns original. Receipt implementation is owned by the receipt audit. |

Runtime marker for the final financial/state test: `VVE-CRM-AUDIT-STATUS-PAYMENT-1792342736282`. Synthetic deposit booking: `36d09884-d30b-4506-9fd7-46847d2d7d43`. Synthetic no-deposit booking: `3eb01948-84c8-418f-9fc1-d84f53c37222`. These are local test records only, never live jobs.

A controlled native date-input change test confirms the chosen date is included in the saved agreement body. Root observed a CUA/native-fill case where the visible date changed but the submitted date did not; no application defect was reproduced by the component test. Treat that browser interaction as requiring recheck, not a proven fix.

## Existing payment/price behaviour verified, not redesigned

- A bank deposit requires the operator's received-money acknowledgement, bank-transfer method, reference and exactly £30. Repeating the operation cannot record a second deposit.
- Confirmed price changes are proposals: journey becomes `change_pending`, retaining the prior accepted agreement and operational booking total until customer acceptance. The runtime script tested that intermediate state, not the customer's acceptance action.
- A revised total below already-recorded money cannot be sent. Completed agreements cannot be silently repriced.
- Completion aligns booking and journey state. A received balance can then be recorded with a real payment method/reference, and exact settlement updates the balance without inventing a deposit.
- **There is no manual booking-deposit amendment/reversal operation.** An unsupported correction is rejected. Invoice-payment correction is a different ledger and must not be used as a substitute. Do not report this requested capability as finished; a properly authorised, audited correction design is still required if the owner needs it.

## Remaining boundaries

- Root's browser review, complete repository test/build run, focused commit/push and deployment status must be added to the final release report. They are not asserted by this subagent document.
- Email/Telegram/Calendar/Stripe live delivery is not demonstrated by the isolated test stack. Correct queue kinds and local state changes are proven; live provider operation needs separately authorised evidence.
- No production data was changed. No customer payment was taken. No Stripe configuration or £30 deposit behaviour was changed.

## Root validation and browser follow-up

The combined CRM suite passed 1,143 tests with zero failures or pending tests on 18 October 2026. TypeScript, lint and the isolated CRM build passed; the existing Fast Refresh and bundle-size warnings remain. This validates the current feature branch, not a production deployment.

The rebuilt browser independently verified Deposit paid returns the single deposit-paid fixture, while All deposit statuses + Balance Paid returns the settled no-deposit fixture. Pagination went to page 2 and back to page 1. A phone-only confirmed booking displayed No deposit required and omitted the legacy status/balance controls. Its internal note persisted after refresh. The browser then completed that synthetic job, rejected a £101 balance against £100 due, recorded £100 by bank transfer and retained Paid £100 / Balance £0 after refresh. Read-only local database evidence is recorded in phone-only-browser-payment-db.json. External delivery remained disabled and failures were shown explicitly.

Native date keyboard interaction was also verified in the invoice completion-record builder: adjusting the date with arrow keys updated application state, a future date blocked the completion statement, editing the work reset its acknowledgement, and the reviewed statement saved into a draft. The earlier CUA fill-only issue remains a tool interaction limitation, not evidence of a general broken date field.

## Linked invoice warning after a booking balance payment

The browser follow-up found a settled no-deposit booking could prefill a new invoice with its service total, deposit £0 and the same total still due. The booking and invoice payment ledgers are separate; this prefill was not a second payment or an issued invoice. A complete financial reconciliation workflow remains a P1 planned change, detailed in the audit artifact `CRM-improvement-plan.md` and `booking-invoice-ledger-finding.md`.

`admin/src/pages/InvoiceEditorPage.tsx` now reads the existing authenticated booking journey before presenting payment guidance. A positive recorded `manual_balance` or `balance` entry shows an advisory to review the booking payment and any refunds before issuing/sending an invoice or recording the same money again, with a link to that booking. It does not assume the booking is fully settled. A failed/incomplete history read shows neutral retry guidance. Late responses are ignored after changing the linked booking/account. Deposit-only history does not trigger the balance warning.

This is a nonfinancial UI mitigation: no payment is moved, applied, duplicated or reversed; invoice prefill, draft save, amounts and Stripe behavior are unchanged. It does not block an ordinary invoice. The current history endpoint returns its latest 50 payment rows, so absence of a matching row is not a claim that the booking has never had a balance payment. Future reconciliation must use complete canonical payment history and unique source allocations.

Focused proof: the new positive-history/error tests failed before the UI change (`invoice-booking-warning-before.log`: 3 failed, 4 passed, 39 skipped). The complete invoice editor component suite then passed **46 tests**, including 7 new balance-warning cases (`invoice-booking-warning-after.log`). Cases cover bank/Stripe balance entries, unchanged amounts and successful draft save, no-journey/deposit/refund-only histories, transient read failure/retry and a late response after changing bookings. TypeScript and changed-file lint passed (`invoice-booking-warning-typecheck.log`, `invoice-booking-warning-lint.log`). The complete suite and rebuilt browser recheck remain separate evidence; this section does not claim production delivery or financial reconciliation is finished.

The advisory is shared through `admin/src/components/BookingBalancePaymentNotice.tsx` and also appears in `InvoiceDetailPage.tsx` while a linked saved invoice is still a draft. It remains present after reopening, without altering issue/save handlers or issued invoice behavior. The two reopened-draft regressions failed before the extension (`invoice-draft-warning-before.log`); the combined new/saved invoice suites passed **77 tests** afterward (`invoice-draft-warning-after.log`), with TypeScript/lint passing. Root verified the new-invoice warning in the browser; the saved-draft browser recheck remains separate evidence.

## New manual bookings use the workflow before their first agreement

Root's next browser check found that a newly created manual booking still exposed the legacy internal status and balance controls before its first agreement was saved. The original guard only checked whether a `booking_journeys` row existed. The page now treats a stored `first_source = admin_manual` plus an explicit `quote_config.manualPaymentPlan` of `after_clean` or `deposit_after_agreement` as managed from creation. It presents the same agreement/payment workflow and hides both legacy controls.

The legacy status and balance endpoints independently check that stored marker and reject 409 before writing. A failed marker lookup returns 503 instead of allowing the update. Historical manual records without the explicit supported choice, and non-manual records without a journey, retain their existing controls. No appointment is silently confirmed, no payment is recorded, and £30/Stripe behavior is unchanged.

Files: `admin/src/pages/BookingDetailPage.tsx`, `admin/api/_lib/bookingFields.js`, `admin/api/bookings/[id].js`, `admin/api/bookings/[id]/balance.js`, with component/API regressions beside them. Initial run: **8 failed / 66 passed** (`manual-initial-workflow-before.log`); corrected focused run: **90 passed across 4 files** (`manual-initial-workflow-after.log`), including 13 new tests for both arrangements, preserved historical behavior and read-failure protection. TypeScript and changed-file lint passed. Actual isolated API and rebuilt browser evidence are recorded separately after the coordinated reload.

After reload, actual local API/PostgreSQL checks passed **10/10** (`manual-initial-workflow-runtime.json`, marker `VVE-CRM-AUDIT-INITIAL-WORKFLOW-1792347754389`). Fresh synthetic bookings `ffd4c2e9-3beb-4a16-828e-975fb34bf61a` (no deposit) and `062c13db-7f12-41ad-9eb8-b970cff0ef23` (£30 arrangement) each had no journey yet. Both legacy status and balance writes rejected 409; status, deposit, total and Stripe fields were unchanged, and no agreement or notifications were created. These are local test fixtures, not customer jobs. Root owns the separate browser confirmation.

## Final catalogue/invoice browser sweep and presentation corrections

`financial-browser-observations-2026-10-18.json` records a separate named Playwright session (`crm-financial-final`) against the real isolated local CRM. It covers synthetic product/service creation, duplicate-name rejection with retained fields, search, edit/cancel and refresh persistence, archive cancellation/confirmation, archived-item exclusion in the invoice picker, reactivation, and a no-results search. There is no catalogue type filter; Product/Service is an item field, not an untested filter. No standard catalogue prices were changed.

A fresh synthetic business customer (`5728b5a4-5ad2-4c41-9c17-9adcb9dae9d9`) supplied the invoice customer's name, email and structured billing address automatically. Draft `a59dc970-7a69-44b4-93ce-348003b1fdcd` retained selected catalogue description/price, manual and catalogue quantities, line/document discounts, a separate service address, recipient overrides, both note types and item order after save/refresh. Its calculated subtotal £70 and discounted total/due £65 matched the saved draft. It was not issued or sent. PDF and reversal actions previously blocked by tool review were not retried or worked around. Provider delivery remains outside this local proof.

The browser found the reference Auto-fill used the billing postcode even with a separate service address. `admin/src/components/InvoiceItemsForm.tsx` now uses the enabled nonempty service postcode, falling back to billing postcode. The existing automatic convenience behaviour uses the same postcode so it cannot immediately replace the explicit button result. Saved/prefilled booking references and manually edited references remain protected until the operator explicitly selects Auto-fill; historical documents are not modified.

The booking amendment preview also showed an `APPOINTMENT CONFIRMED` badge next to a proposed date. `admin/api/_lib/bookingEmailLayout.js` now labels `change_proposal` messages `CHANGES AWAITING YOUR APPROVAL` with a blue pending badge and `Proposed appointment` in HTML/plain text. Accepted `revised_confirmation` messages keep the confirmed badge. This only changes presentation: the previously accepted appointment remains in force until acceptance, and no journey/payment/Stripe operation was changed.

Six new regressions cover both deposit arrangements and accepted revisions, service-vs-billing postcode, absent service postcode, disabled separate-address mode and absent billing postcode. The pre-fix run reproduced **5 failures / 61 passes**; after correction, the two presentation/form suites plus booking lifecycle suite passed **126/126** (`reference-amendment-after.log`). TypeScript passed; lint reported zero errors and the existing InvoiceItemsForm Fast Refresh warning. Full-suite and rebuilt-browser evidence remain separate from these focused checks.

The same isolated browser then verified ordinary unsaved draft recovery: after editing an internal note and refreshing, the exact text returned with a recovery banner and issue/preview controls disabled until saving. The test invoice was subsequently issued through its explicit in-app confirmation as `VVE-INV-2026-013248`, without sending it.

For payment-response recovery, a one-shot browser route intercepted only that synthetic invoice's payment endpoint. It awaited the actual handler/database response first, then substituted a labelled 503 response. The form retained the exact £65 bank-transfer request and locked its fields. Refresh showed Paid £65 / Due £0 plus the unresolved-request review action. Reopening and choosing `Retry same request` cleared the warning while keeping the same single visible payment and receipt `87e4aef8-c79c-4fe0-90d3-45af43c2ef41`. The route was removed afterward. This was a local record of simulated received money, not a charge or bank transfer. Read-only database counts are recorded separately by the environment agent. The earlier statement that this invoice remained unissued describes the initial sweep; this later, explicitly approved test issued it for recovery verification.

## Current combined validation

The final source check now supersedes the earlier incremental counts above: **1,180 CRM tests passed, zero failed/pending; 2,459 website tests passed, zero failed and299 existing pending**. Both TypeScript checks and isolated builds pass. Lint reports no errors and existing warning counts of CRM1/website7. See `CRM-FINAL-VALIDATION-2026-10-18.md` and the `final-browser-*` logs for current evidence. This is local source/workflow validation, not proof of every external integration or a production release.

The manual Google review-request feature and other missing conveniences are documented separately in `CRM-IMPROVEMENT-PLAN-2026-10-18.md`. No review request was enabled or sent.

## Final receipt date correction and bounded browser follow-up

The financial browser sweep additionally exercised invoice search/document/payment/due-date filters, sorting, no-results state and read failure/retry; receipt search, list/detail/history failures and independent retries; contact and zero-amount validation; and deposit-greater-than-total validation in a draft. The updated observation artifact records exact screenshots/snapshots and distinguishes partial coverage. Invoice and receipt lists each had only one page, so their second-page controls were not claimed as tested. Receipt search's empty-state copy still says “No receipts yet”; more specific no-match wording is a nonblocking refinement.

The rebuilt browser verified the explicit service-postcode reference persisted as `N11AA281026` on a separate new draft, without changing the issued original. On an owned synthetic confirmed booking, an unsent revision preview showed “CHANGES AWAITING YOUR APPROVAL” and “Proposed appointment”; its accepted amount/state remained unchanged. Read-only `invoice-payment-final-browser-db.json` confirms the response-loss payment test created exactly one payment and one receipt for £65, with paid £65 / due £0 and no email send events.

The same sweep exposed a real financial accuracy defect: on 18 October, a standalone receipt accepted 19 October as the date money had already been received. The synthetic failing record `852d8d47-1301-44c9-89a6-9e8cf53a1cb4` is retained as test evidence; it represents no actual payment. `admin/api/_lib/receiptLifecycle.js` now checks new receipt dates against the actual Europe/London day before allocating a number, inserting a receipt or generating a PDF. Existing exact request-ID recovery runs first so historical saved receipts remain recoverable and immutable. `admin/src/pages/ReceiptEditorPage.tsx` applies the same submission limit, a native date maximum refreshed on focus, and preserves frozen pending-request replay.

Seven new regressions cover summer/winter midnight, submission after an open form crosses London midnight, no writes/PDF on a future date, and unchanged recovery of a previously saved receipt. The before run reproduced **4 failures / 38 passes**; after implementation, **42/42** focused lifecycle/editor tests passed (23 server lifecycle, 19 UI). TypeScript and focused lint passed. See `receipt-future-date-before.log`, `receipt-future-date-after.log`, `receipt-future-date-typecheck.log` and `receipt-future-date-lint.log`. A coordinated rebuilt-browser/API rejection check and the final combined suite supersede earlier incremental totals when reported; they are not implied by this focused test result.

No production records, actual funds, Stripe configuration, deposit amounts or historical documents were changed. Previously tool-blocked PDF and reversal browser actions were not bypassed. This section completes the bounded financial checks rather than asserting every external delivery path passed.

The rebuilt receipt date check is now proven independently: the browser rejected 19 October on 18 October with native `rangeOverflow` and **zero POST requests**; the real isolated handler returned **400**, and querying the same generated UUID returned **404**. See `receipt-future-date-runtime.json` and screenshot `page-2026-10-18T20-41-23-603Z.png`. The original failing fixture remains intact.

A later browser check confirmed that an **unsent** receipt lost its fields after refresh, although tab switching alone retained them. This is distinct from the already-working submitted-request recovery. `admin/src/lib/standaloneReceiptDraft.ts` now stores partial receipt fields in account-bound session storage for up to24hours, with strict shape/size/owner validation and truthful storage-failure feedback. `ReceiptEditorPage.tsx` restores those fields, resets the payment-confirmation checkbox for review, supports an explicit discard/keep-editing choice, and retains intentionally cleared fields. Pending submitted operations take precedence and cannot be replaced by an unsent draft. The existing logout/account-change cleanup in `invoiceDraftRecovery.ts` clears these copies; late pagehide cannot recreate them. After a confirmed save, the unsent copy is cleared before releasing the pending identity, preventing stale recovery from reopening as a new payment.

The initial three component regressions failed before implementation; the final focused receipt run passed **69/69** (27editor,7draft helper,12pending-request helper,23server lifecycle). It covers refresh-style remount, storage failure, explicit discard/cancel, account change/logout,24-hour expiry, malformed data, same-request priority and safe cleanup failure. TypeScript and focused lint passed. Evidence: `receipt-draft-before.log`, `receipt-draft-after.log`, `receipt-draft-typecheck.log`, `receipt-draft-lint.log`. Actual rebuilt tab/refresh recovery remains a separate next check, not inferred from component tests.

## Rebuilt receipt draft and final unpaid-invoice browser proof

The rebuilt receipt form now passes the previously failing browser check. A fresh unsent TEST ONLY receipt retained its customer, phone, structured address, service, £12.50 amount, Cash method and reference across tab switching and full refresh. The received-payment acknowledgement reset for explicit review. Keep editing preserved the recovered inputs; explicit Discard this draft cleared them and the next refresh remained empty. No request or receipt was created by this recovery check. Screenshot `page-2026-10-18T21-02-02-680Z.png` and the appended `Draft persistence after fix` observation provide after-proof.

The final bounded invoice sweep used only disposable synthetic records. It rejected zero quantity, blank item description, excessive line discount and excessive document discount, retaining valid values for correction. Contact correction supported Cancel and then a successful saved name/phone correction without changing invoice number or amounts. A service-price revision created a separate numbered invoice: original `95654f3a-c5eb-4b4d-b0d1-f1aaaf31de50` (`VVE-INV-2026-013249`, £45) remained preserved and Superseded; revision `31136030-6aea-40ad-93d6-e688a63a4814` (`VVE-INV-2026-013250`, £55) was explicitly voided with a test-only reason. Blank void reason was rejected, Cancel preserved Issued, and Void removed payment/sending controls after refresh. No email or payment was initiated.

A new disposable draft `c9e44e44-2243-423f-b717-7e368754c52e` separately retained an unsaved note across tab switch and refresh, with Issue disabled until save. Delete draft required an in-app confirmation; Cancel retained the note, and explicit deletion returned the list and then an honest missing-record screen. Only this newly-created test draft was removed; issued documents and historical records were untouched.

The stable financial observation artifact now has75 individually scoped entries. It retains the before-fix failures alongside their rebuilt after-proof and does not treat partial, unavailable or provider-blocked paths as passes. Remaining examples include real provider delivery, PDF/reversal actions previously blocked by tool review, and second-page financial-list pagination without enough eligible local rows. The void dialog's old “Duplicate as corrected draft” wording is a minor copy observation reported to root; the current action is “Adjust services or price”.

## Validated source closeout — 18 October 2026

Full CRM source suite: **1233 passed, zero failed or pending**,89 test files. TypeScript passes; lint has zero errors and one existing Fast Refresh warning; the isolated build passes with its existing large-chunk warning. Logs: `final-closeout-crm-tests.log`, `final-closeout-crm-typecheck.log`, `final-closeout-crm-lint.log`, `final-closeout-crm-build.log`. Website source remains unchanged since2459passing/299existing pending/zero failures.

New-invoice form defaults and the creation-only server fallback now use the previously agreed “Payment is due on the cleaning day.” Existing saved terms and legacy email fallback are preserved.130 focused tests, TypeScript, lint and the full suite pass. Rebuilt browser read-only checks show the new default and unchanged historical saved terms. Evidence: `new-invoice-terms-browser.txt`. Commit `f7e207d`.

Consent withdrawal wording now accurately separates removed reporting identifiers/suppressed unsent events from retained original request source details. Actual local withdrawal and refreshed UI/DB evidence passed; no external reporting or financial change occurred. Commit `2bf69e2`.

## Final handoff supersedes incremental counts

Earlier sections record the sequence of findings and intermediate checks. For current status use CRM-FINAL-VALIDATION-2026-10-18.md and the versioned action ledgers. Final validation is 1,233 CRM passes and 2,459 website passes with 299 existing pending website tests; TypeScript/build checks pass. Final financial observations total 91, including actual 21-record pagination and normal stored document downloads; the previously blocked draft-preview/reversal actions remain unclaimed. The final CRM browser inventory has 269 actions (236 pass browser local; 16 partial browser local; 11 unverified; 2 blocked unverified; 2 blocked provider state; 2 not present). The final gallery inventory has 89 overlapping actions (53 pass browser local; 2 partial api local; 16 unverified; 4 partial browser local; 10 limited; 4 pass api local). No production release occurred.
