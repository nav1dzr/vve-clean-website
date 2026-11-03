# Booking payment → invoice allocation: Phase 1B design

3 November 2026. Starts after PR #63, merge 7264263. Current status: **read-only preview policy implemented and tested locally; no allocation endpoint, write migration, payment-linking button or production financial change yet.**

## Owner experience

1. On a linked issued invoice, open Review booking payments.
2. Choose an existing, received balance payment from its complete booking payment record.
3. Review invoice amount due, payment reference, deposit already credited and proposed remaining invoice amount.
4. Explicitly acknowledge a deposit already credited after checking its actual source reference.
5. The eventual action is labelled **Apply existing booking payment**, not Record a new payment. It changes invoice allocation, not money received.
6. Show a saved result and receipt status separately. A failed/unknown acknowledgement must preserve the same operation ID for reconciliation; never offer a blind new payment.

The current preview policy returns either review_ready or a named needs_review reason. It performs no reads/writes, calls no provider and creates no receipt.

## Conservative first allocation scope

A single active issued GBP invoice explicitly linked to its booking; complete source histories; whole existing balance payment only; no refund, reversal, unknown invoice-payment provenance, competing draft/invoice or automatic split.

- Deposit/no-deposit bookings are both supported by the preview.
- The source payment must belong to the same booking and its full ledger must reconcile to the authoritative journey total.
- Existing applied deposit must equal the complete recorded deposit amount AND be deliberately reviewed. Matching amounts alone are not proof.
- Older invoice payments, allocations or reversed records go to manual review; they cannot be safely inferred as different money.
- A smaller whole source payment can preview a partial settlement. Further allocations against that invoice require the provenance-aware second version, rather than silently treating existing activity as unrelated money.
- Refunded bookings, multiple/revised invoices and split allocations remain blocked until their explicit reconciliation flows are designed and tested.
- Never use the capped 50-row journey-screen history as proof of completeness.

Implementation: admin/api/_lib/bookingInvoiceAllocationPreview.js.
Tests: admin/tests/api/_lib/bookingInvoiceAllocationPreview.test.js.
This policy is not a financial authorization boundary and is not exposed by a live route.

## Required write design before any release

Use a dedicated service-role-only transaction with immutable allocation identity, booking source external ID, invoice ID, allocation amount, resulting invoice-payment ID, operation UUID, actor and review reason/source evidence. Preserve a distinction between an allocation and newly received funds in records, UI, exports and receipts.

Required transaction steps:

1. Verify authenticated/admin authority server-side; no browser/service-role credentials.
2. Lock booking journey then related invoice rows in stable order, then the selected source payment and allocation identity. Coordinate with the existing invoice financial mutation lock rules. Re-read state/version after locks.
3. Validate the complete booking relationship, currency, source ledger/refunds, current invoice state/totals and existing credits. Never trust preview totals or completeness booleans sent by the client.
4. Check a unique operation UUID. A replay is permitted only when invoice/source/amount/acknowledgement fingerprint is identical. Changed details or a reversed operation must conflict.
5. Enforce database-level uniqueness of source allocation and ensure amount is within both source capacity and invoice due. A unique source link must survive a later reversal so an old request cannot silently become a fresh allocation.
6. Write allocation provenance, its invoice credit and attributed invoice/booking audit entries atomically. Recompute invoice money from authoritative records, preserve original booking paid/refunded counters, document number and issued PDF.
7. Return the operation result. Generate/reconcile the one paid receipt through a deliberately idempotent document workflow. A receipt/PDF failure must never make a successful allocation look unsaved.
8. Never send a customer email, payment reminder, refund, new Stripe checkout, new Ads event or Calendar event merely because an invoice allocation was created.

The existing generic recordPayment API must not accept a user-entered source reference as proof of allocation. The future dedicated RPC must enforce provenance itself.

## Refunds and wrong bank entries

Do not implement a bank correction by editing/deleting a booking payment row or calling invoice-payment reversal. Those are different records.

A booking correction needs its own append-only adjustment, reason and operator; guarded net received/refunded counters; agreement/deposit state decisions; existing source allocations and receipts reviewed first. A correction is not a refund or notification. Real Stripe refunds remain outside this scope.

Define how linked invoice credits and paid receipts are corrected when a later refund/correction occurs. Avoid a global trigger that silently revises historical issued documents.

## Isolated database acceptance gates

- Two concurrent attempts cannot allocate the same source twice.
- Competing invoice payment/void/revision and refund operations serialize or conflict safely.
- Identical retry returns the same result; changed retries fail.
- Audit failure rolls back both credit and allocation.
- No overpayment, precision loss, cross-booking/cross-currency allocation or null/stale version.
- Applied deposit, refunded source, duplicate legacy payment and extra active invoice are held.
- Receipt creation/PDF failures, unknown network outcomes and reversal/retry preserve the original operation and history.
- Browser preview is read-only; actual apply requires deliberate confirmation and all server guards.

No production migration should be requested until those transaction tests and the actual write interface are ready for review. The next production exception must name that exact migration and write scope.

## Phase 1A release evidence

PR #63 passed all required checks and merged normally at 7264263214c875c4fead5bd328240263ca713f3f.
Website and CRM are Ready on that revision. CRM live bundle /assets/index-G9tF30e1.js includes the new review panel.
No production financial data, Stripe, prices, deposit amount or Google settings changed.

Phase 1B remains in progress. This document does not mark the full financial reconciliation roadmap complete.

## Local validation of the preview policy

43 allocation-preview tests passed, covering conservative eligibility, incomplete histories, deposits, no-deposit jobs, refunds, stale/malformed data, existing activity, reuse, partial settlement and input immutability. The full CRM suite passed with 1,360 tests in 97 files, zero failures/skips. TypeScript, lint and build passed; the existing Fast Refresh and bundle-size warnings remain. These tests do not validate a database transaction or authorize production writes.
