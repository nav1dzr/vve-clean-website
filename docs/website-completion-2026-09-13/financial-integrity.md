# Invoice financial integrity — local review phase, 13 September 2026

The owner approved the phone-form fix first, then financial fixes. This phase repairs F1/F2/F3 locally on `feature/website-final-completion`. It is not a deployment or approval to apply a migration. No production rows, Stripe behavior, £30 deposit, prices or historic document numbers were changed.

## Changes

- Payment recording and reversal use one database transaction: lock the invoice, validate the current ledger, record the payment/reversal, update its aggregate balance and write its audit event. A unique operation UUID makes an identical payment retry idempotent. Reversal retries use the payment UUID and original reason. Changed payment details cannot reuse an operation UUID.
- Draft replacement locks and compares the displayed `updatedAt`, then updates the header, replaces the items and writes its audit event atomically. An item trigger locks the parent invoice and rejects edits to issued items. Failed item or audit writes roll the whole transaction back.
- Issuance compares the displayed timestamp and validates items against totals. Revision issuance locks source and replacement, checks the recorded source timestamp and rejects any intervening source change/payment/receipt/superseding. Issue, number allocation, audit events and source superseding commit together.
- HTTP save/issue requests require `expectedUpdatedAt`; payment requests require `operationId`. There is no fallback to old split writes if the transaction RPC is missing. Trusted internal lifecycle calls may obtain a current timestamp or create a new operation UUID, but HTTP validation runs before those calls.
- The payment modal keeps an unresolved operation ID and its payment values per user/invoice in tab-only recovery, including across close/reopen and reload. It locks uncertain details until the same attempt is resolved or explicitly discarded after review; it never automatically submits a recovered attempt. Replayed successful requests return the same payment ID and current invoice totals; the UI does not automatically send another acknowledgement. PDF generation remains after financial commit and can use the existing download/regeneration path.

## Validation

884 tests passed across 73 files; 1 existing todo, no failures. Full CRM lint has no errors and 1 existing Fast Refresh warning. TypeScript and the isolated front-end build passed. The final migration passed 11 actual PostgreSQL validation groups. Final phone-width browser checks passed with synthetic data and all foreign requests blocked. Independent review approved the SQL/API after a regression fix preserving reversal on void invoices; full details are in the parent status document.

The actual SQL runner uses the existing invoice, customer/payment-option, numbering and revision migrations in disposable in-memory PostgreSQL. It validates anonymous/authenticated execution denial, stale/missing timestamps, atomic item replacement rollback, issued-item insert/update/delete rejection, payment deduplication and overpayment prevention, audit-failure rollback for payments/reversals, reversal on void invoices without reopening them, source-paid-after-revision rejection, atomic issue/supersede rollback and unchanged deposit/number format.

Run from the repository root:

```powershell
node scripts/validate-invoice-financial-db.mjs
# Skips by default. An explicit run creates a new in-memory database only:
node scripts/validate-invoice-financial-db.mjs --run --pglite 'C:/Users/navid/.codex/tmp/vve-media-db-validation/node_modules/@electric-sql/pglite/dist/index.js'
```

The module path is workstation-specific; use any already installed local PGlite module. The runner accepts no database URL, reads no application credentials, connects to no server, and closes its disposable database. PGlite serializes one connection. Its simultaneous-request checks establish serialized outcomes and actual PostgreSQL transaction rollback; they are not certification of production multi-connection load/races. A later explicitly approved isolated Postgres environment should run competing sessions against the row-lock paths before release.

Audit probe mapping: concurrent payments, stale revision issuance, failed draft-item replacement and draft-save-versus-issue now have passing regression equivalents. The two receipt lifecycle findings remain below; they are not falsely counted as fixed.

## Deployment order and compatibility — future approval required

1. Review the complete migration and prerequisites, especially `admin/migrations/20260728000000_add_invoice_revision_links.sql`. Prepare an explicitly approved isolated database and test identities. No migration was applied remotely by this phase.
2. Apply `supabase/migrations/20260913100000_invoice_financial_integrity.sql` to that isolated database, then deploy the matching API and UI together for connected checks. The database function is executable only by `service_role`; anonymous/authenticated execution stays denied.
3. The new API with an old database fails closed with a retryable unavailable response rather than doing split writes. Old browser tabs do not have required `expectedUpdatedAt`/`operationId`; the new API rejects those requests with a clear refresh/reopen message.
4. An older deployed API remains capable of its old unsafe writes even after this migration. A future production release therefore needs a coordinated migration/API/UI cutover with financial mutations paused during the mixed-version window. Applying the migration alone does not complete this fix. No production cutover is authorized here.
5. Existing revision drafts have NULL `revision_source_updated_at`. They intentionally cannot be issued under the new code. Review the original invoice and create a fresh revision draft; there is no automatic historical backfill. Do not invent a source timestamp for an old draft.
6. Keep the migration and API aligned if rolling back. Do not restore the old financial-writing code while presenting the fixes as active. Rollback/maintenance actions need their own release approval and must preserve records and consumed document numbers.

## Remaining scope

- F4 receipt reversal/status and durable receipt-generation recovery are not fixed in this phase. Reversing a payment can still leave its old historical receipt labeled paid in full; a receipt-creation failure after a successful payment can still return `receiptId: null`. Replaying a payment never creates another payment or deliberately creates a second receipt, but it is not a receipt-repair operation.
- Draft creation itself retains the pre-existing create-header/create-items cleanup path; this phase changes replacement of existing drafts, issuance and payment mutations. Issued-document contact corrections and a full immutable financial snapshot/audit redesign remain separate findings.
- No customer messages or invoices were sent, no live payment was created/refunded, and no data repair/backfill was performed. Follow-up checks must continue using synthetic records until a specific release is authorized.
