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
