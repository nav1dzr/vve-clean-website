# Invoice & receipt numbering policy

## Format

- Invoice: `INV-YYYY-NNNNNN` (e.g. `INV-2026-000001`)
- Receipt: `REC-YYYY-NNNNNN` (e.g. `REC-2026-000001`)

`YYYY` is the calendar year at the moment of allocation (not the invoice's
issue date, service date, or due date — see "Year boundary" below).
`NNNNNN` is a zero-padded, strictly sequential counter, independent per
document type and per year.

## How a number is allocated

A single Postgres function, `next_document_number(p_doc_type text)`
(defined in `supabase/migrations/20260722000000_create_invoice_receipt_
tables.sql`), backed by one counter table, `document_number_counters`
(`doc_type text, year int, last_number int`, primary key `(doc_type,
year)`).

Allocation is one atomic statement:

```sql
INSERT INTO document_number_counters (doc_type, year, last_number)
VALUES (p_doc_type, v_year, 1)
ON CONFLICT (doc_type, year)
DO UPDATE SET last_number = document_number_counters.last_number + 1
RETURNING last_number INTO v_number;
```

Postgres guarantees `INSERT ... ON CONFLICT DO UPDATE` is atomic — two
concurrent callers can never receive the same number, without any
application-level locking.

## When a number is assigned

- **Never** for a draft. A draft invoice has `invoice_number = NULL` for
  its entire life until issued (or forever, if it's deleted or stays a
  draft).
- **Exactly once**, at the moment `POST /api/invoices/:id/issue` succeeds
  (`admin/api/_lib/invoiceLifecycle.js`'s `issueInvoice`). The number is
  allocated from the RPC immediately before the guarded `UPDATE ...
  document_status = 'issued' ... WHERE document_status = 'draft'` that
  marks the invoice issued.
- **Exactly once**, automatically, when an invoice's balance reaches zero
  (`admin/api/_lib/receiptLifecycle.js`'s `createReceiptIfPaid`, called
  only from `recordPayment`). There is no manual "create receipt" action.

## Numbers are never reused or reclaimed

- Voiding an invoice (`POST /api/invoices/:id/void`) does not release its
  number — `void_reason`/`void_at` are set, the row and its number stay
  permanently visible and retired.
- Deleting a draft cannot cause reuse, because a draft never had a number
  to begin with — deletion only removes rows that were always
  `invoice_number = NULL`.
- **Known, accepted gap case**: if two "Issue" requests for the same
  invoice race (e.g. a double-click before the button disables), both may
  successfully call `next_document_number()` before the losing request's
  guarded `UPDATE` fails (see the concurrency note in
  `invoiceLifecycle.js`'s file header). The losing request's allocated
  number is simply never attached to any invoice and never appears again —
  consistent with "numbers are never reused," at the cost of an occasional
  gap in the sequence. This is a deliberate tradeoff for a low-concurrency
  internal admin tool rather than adding a distributed lock; documented
  here so a gap in the sequence is never mistaken for a bug or a sign of a
  missing/lost invoice.

## Year boundary

Because `year` is part of the counter table's primary key, 1 January
automatically starts a fresh counter at `...-000001` for both invoices and
receipts, independently, with no cutover code, cron job, or manual reset
required. This is exercised directly in
`tests/supabase/invoiceReceiptMigration.test.js` (static checks that the
primary key includes `year`) and in
`admin/tests/api/_lib/invoiceLifecycle.test.js` (sequential allocation
within a single run).

## Receipts are numbered independently of invoices

An invoice's number and its resulting receipt's number are unrelated
sequences — `INV-2026-000047` does not imply `REC-2026-000047` exists or
corresponds to it. The receipt links back to its invoice via
`receipts.invoice_id` and a frozen `invoice_number_snapshot` (so a receipt
PDF can always show which invoice it was for, even if that invoice's live
row somehow changed later — it can't, since issued invoices are immutable,
but the snapshot removes any dependency on that guarantee holding forever).

## Booking references stay separate

A booking's `booking_ref` (format `POSTCODEDDMMYY`, e.g. `N152NG140726` —
see `api/create-checkout-session.js`) is never used as, or confused with,
an invoice or receipt number. An invoice created from a booking stores that
booking's reference as a read-only snapshot
(`invoices.booking_ref_snapshot`) purely for display — it plays no role in
invoice number allocation.
