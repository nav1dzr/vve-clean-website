# Invoices & Receipts — Implementation Plan

Branch: `feat/crm-invoices-receipts` (off `main` @ `3c46455`)

This plan is written after inspecting the existing repo (admin app, Supabase
schema, Stripe webhook, email sending, Vercel config, tests) so the feature
reuses existing conventions rather than introducing new ones. No code has
been written yet at the time this plan is committed; implementation proceeds
immediately after in the phases below, without waiting for approval, per the
originating spec.

## 1. Systems being reused (not rebuilt)

- **Auth**: `admin/api/_lib/adminAuth.js` (`verifyAdminRequest`) — same
  Bearer-token + `admin_users` allowlist check every existing admin route
  uses. No new auth mechanism.
- **CORS / response conventions**: `admin/api/_lib/cors.js`
  (`corsHeaders(origin)`, `ADMIN_ALLOWED_ORIGINS` allowlist), `Cache-Control:
  no-store` on every response, `OPTIONS → 204`, `405` on wrong method,
  generic `{ error: '...' }` bodies, explicit column allowlists (never
  `select('*')`) — copied verbatim from `admin/api/_lib/bookingFields.js`'s
  pattern.
- **Service client**: `admin/api/_lib/supabaseAdmin.js` (`getServiceClient`)
  — same service-role client every route already uses.
- **RLS convention**: enable RLS, zero `anon`/`authenticated` policies,
  service-role-only access — same as `bookings`, `admin_users`,
  `internal_notes`, `processed_stripe_events`.
- **Frontend fetch**: `admin/src/lib/authFetch.ts` — same typed wrapper
  every admin page already uses; no new HTTP client.
- **Frontend auth gating**: `RequireAuth` / `ProtectedShell` — new pages
  slot into the existing protected route tree in `admin/src/App.tsx`.
- **Test conventions**: Vitest, `admin/tests/api/**` mirroring
  `admin/api/**`, the existing `vi.mock()` + hand-rolled `makeReq`/`makeRes`
  pattern from `admin/tests/api/bookings/balance.test.js` — no new test
  tooling.
- **Escaping**: `escHtml()` (currently private to `api/stripe-webhook.js`)
  is duplicated into a small shared admin helper rather than imported
  cross-project (the two Vercel projects/`api` trees do not share code
  today, and introducing a cross-project import would be a bigger,
  riskier change than a 4-line duplicated function).

## 2. What does NOT exist yet and must be built fresh

- Any invoice/receipt/financial-document table (confirmed via repo-wide
  grep — none exist).
- Any central business-identity/settings source (confirmed — none exists;
  brand facts are hardcoded ad hoc in `api/stripe-webhook.js`).
- Any email-sending code inside `admin/` (confirmed — the only mailer in
  the repo is `api/stripe-webhook.js`'s inline Nodemailer transport, on the
  *public* Vercel project, not admin's).
- Any PDF generation anywhere in the repo (confirmed — no PDF library is a
  dependency of either `package.json`).

## 3. Business identity / VAT — what's known vs. unknown

Confirmed-safe-to-hardcode facts (already public, printed on the live
site's booking emails): legal/trading name "VVE Limited t/a VVE Clean",
Company No. 17234391, phone 020 8050 2233, website www.vveclean.co.uk,
email contact@vveclean.co.uk.

**Not found anywhere in the repo, and therefore NOT guessed**: registered
office address, bank account/sort-code details, VAT registration status.
Per `BUSINESS_DECISIONS_REQUIRED.md`, these are open business decisions.
The settings source (`admin/api/_lib/businessSettings.js`) ships with these
fields explicitly `null`/empty and a code comment marking them as
"fill in before first real invoice is issued." The PDF/email templates
render conditionally — a bank-details block is only printed if the value is
set, and no VAT row/label appears unless `vatEnabled: true` is set (default
`false`). This satisfies "do not guess... VAT status... bank details" while
still giving the feature a real settings source to build against.

## 4. Data model (all additive, one migration)

`supabase/migrations/20260722000000_create_invoice_receipt_tables.sql`:

- **`document_number_counters`** (`doc_type text, year int, last_number int,
  PRIMARY KEY (doc_type, year)`) + RPC function `next_document_number(doc_type
  text) RETURNS text` — atomic `INSERT ... ON CONFLICT (doc_type, year) DO
  UPDATE SET last_number = document_number_counters.last_number + 1
  RETURNING last_number`, called inside the same transaction as the
  issue/receipt-creation write. Postgres guarantees this upsert is
  concurrency-safe without explicit row locking. Format assembled in SQL:
  `INV-YYYY-NNNNNN` / `REC-YYYY-NNNNNN`, year from `date_part('year',
  now())`, counter reset happens naturally because `year` is part of the
  primary key (a new year starts a fresh row at 1).
- **`invoices`**: uuid PK, nullable `booking_id` (FK → `bookings`, no
  cascade delete — invoices must survive even if a booking row is ever
  removed, so `ON DELETE SET NULL`), nullable `invoice_number` (unique,
  assigned only at issue time), customer/billing snapshot columns, PO
  reference, issue/due/service dates, `booking_ref_snapshot`, currency
  (default `GBP`), `subtotal/discount/tax/total/deposit_applied/
  amount_paid/amount_due numeric`, `customer_notes/internal_notes/
  payment_terms text`, `document_status text CHECK IN ('draft','issued',
  'void','cancelled')`, `payment_status text CHECK IN ('unpaid',
  'partially_paid','paid')`, timestamps
  (`created_at/updated_at/issued_at/paid_at/void_at`), `created_by_admin_id/
  issued_by_admin_id` (FK → `admin_users`), `pdf_storage_path text`,
  `document_version int DEFAULT 1`, `business_snapshot jsonb` (frozen copy
  of business settings at issue time — required so a later settings change
  never silently rewrites an already-issued PDF's on-file data).
- **`invoice_items`**: uuid PK, `invoice_id` FK `ON DELETE CASCADE`,
  `description text NOT NULL`, `quantity numeric NOT NULL DEFAULT 1`,
  `unit_price numeric NOT NULL`, `line_discount numeric NOT NULL DEFAULT
  0`, `tax_rate numeric` (nullable, unused while VAT is disabled),
  `line_total numeric NOT NULL`, `sort_order int NOT NULL DEFAULT 0`,
  timestamps.
- **`invoice_payments`**: uuid PK, `invoice_id` FK `ON DELETE CASCADE`,
  `amount numeric NOT NULL`, `payment_date date NOT NULL`, `method text
  CHECK IN ('bank_transfer','card','stripe','cash','other')`, `reference
  text`, `notes text`, `created_by_admin_id` FK, `created_at`,
  `reversed_at timestamptz`, `reversed_by_admin_id` FK, `reversal_reason
  text` — append-only; a "reversal" sets `reversed_at`/`reversed_by`/
  `reversal_reason` on the original row rather than deleting it, and the
  aggregate recalculation excludes reversed rows.
- **`receipts`**: uuid PK, `receipt_number text UNIQUE`, `invoice_id` FK
  `ON DELETE SET NULL`, `booking_id` FK `ON DELETE SET NULL`, customer
  snapshot columns, `total_paid numeric`, `payment_date date`,
  `payment_method text`, `payment_reference text`, `business_snapshot
  jsonb`, `created_by_admin_id` FK, `created_at`, `pdf_storage_path text`,
  `document_version int DEFAULT 1`.
- **`invoice_events`**: uuid PK, `document_type text CHECK IN ('invoice',
  'receipt')`, `document_id uuid NOT NULL`, `event_type text` (`created,
  updated, issued, previewed, pdf_generated, sent, resent, send_failed,
  payment_recorded, payment_reversed, paid, receipt_created, downloaded,
  duplicated, voided, cancelled`), `admin_id` FK, `metadata jsonb`,
  `created_at`. Single append-only audit table covering both document
  types, indexed on `(document_type, document_id, created_at)`.

All six objects: `ENABLE ROW LEVEL SECURITY`, zero `anon`/`authenticated`
policies, explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO
service_role` (belt-and-suspenders alongside the existing
`ALTER DEFAULT PRIVILEGES FOR ROLE postgres` from
`20260714000000_explicit_grants.sql`, matching that migration's own stated
rationale for being explicit rather than relying on the default alone).

## 5. Numbering policy (`admin/INVOICE_NUMBERING_POLICY.md`)

- Invoice: `INV-YYYY-NNNNNN`, receipt: `REC-YYYY-NNNNNN`, independent
  per-type counters.
- Number allocated only inside the atomic "issue" / "create receipt"
  transaction — a draft invoice never has a number.
- Numbers are never reused, changed, or reclaimed — a voided invoice's
  number stays permanently retired; deleting an unissued draft does not
  decrement any counter (drafts never touched the counter in the first
  place).
- Year boundary: the counter table's primary key includes `year`, so 1
  January automatically starts `...-000001` again for the new year with no
  cutover code required; this is exercised directly in the migration test
  (insert two counter rows for consecutive years, assert both start at 1
  independently).

## 6. Lifecycle summary

Draft (editable, no number, `DRAFT` watermark on preview) → **Issue**
(atomic: revalidate → allocate number → snapshot business/customer/items →
generate final PDF → store → mark issued → `invoice_events` row) → Send
(only marks `sent` after the mail provider accepts; retry reuses the same
number + exact stored PDF, never regenerates) → Payments (`invoice_payments`
insert, server recalculates `amount_paid`/`amount_due`/`payment_status`,
rejects overpayment) → at zero balance, one receipt created atomically
(numbered, PDF generated, linked) → Void/cancel (reason required, number
stays retired, row never deleted). Corrections after issue are always
"duplicate as corrected draft," never an edit to `invoices` fields once
`document_status = 'issued'` — enforced both in the API layer (issued
invoices reject PATCH on financial/customer fields) and documented as a
hard rule for reviewers.

## 7. API design (Vercel function budget)

**Admin Vercel project is currently at 8/12 functions (Hobby-plan cap).**
The existing `bookings/[id]/{status,balance,notes}.js` pattern (one file
per action) does not scale to this feature's action count (preview, issue,
send, resend, void, duplicate, record-payment, reverse-payment, download,
plus the receipt equivalents), so this feature uses Vercel's optional
catch-all segment (`[[...action]].js`) to consolidate, staying at exactly
**12/12** total:

- `admin/api/invoices/index.js` — `GET` (search/filter/sort/paginate list),
  `POST` (create draft, booking-based or manual).
- `admin/api/invoices/[id]/[[...action]].js` — `GET` with no action segment
  = detail; `GET .../preview` = draft PDF preview (generated on demand, not
  stored); `POST .../issue`; `POST .../send` / `.../resend`; `GET
  .../download`; `POST .../payments` (record) and `.../payments/reverse`;
  `POST .../void`; `POST .../duplicate`; `GET .../events` (audit history).
- `admin/api/receipts/index.js` — `GET` (list/search/filter/paginate).
- `admin/api/receipts/[id]/[[...action]].js` — `GET` detail/`.../download`;
  `POST .../send` / `.../resend`.

New total: 8 existing + 4 new = **12/12** — at, not over, the plan cap.
Nothing further can be added to the admin project without either
consolidating an existing route or upgrading the Vercel plan; this is
called out explicitly in the final report rather than discovered later.

Every route follows the exact existing boilerplate (`config.api.bodyParser
= false`, CORS + `no-store`, `OPTIONS → 204`, method check, `verifyAdminRequest`,
input validation, `getServiceClient()`, try/catch → generic 500).

## 8. PDF generation & storage

**Library**: `pdfkit` — pure-JS, no Chromium/Puppeteer dependency (fits the
existing lightweight serverless functions; avoids the cold-start and bundle-
size cost a headless-browser PDF approach would add to a Hobby-plan
project), deterministic vector output, well-suited to a fixed-layout
business document (logo/header, item table, totals, footer) rather than
arbitrary HTML.

**Storage**: private Supabase Storage bucket `financial-documents`
(created via the same migration, `NOT` public), paths
`invoices/{invoice_id}/invoice-v{version}.pdf` and
`receipts/{receipt_id}/receipt-v{version}.pdf`. Downloads go through the
authenticated API routes above, which mint a short-lived signed URL
(`createSignedUrl`, ~60s TTL) rather than returning a public URL or the raw
service-role-fetched bytes inline. Draft previews are generated on demand
in-memory and streamed back, never written to storage. Issued PDFs are
immutable — `document_version` only increments if a genuinely new formal
document is ever required (e.g. re-issue after a correction), never for a
routine resend.

## 9. Email

No shared mailer exists yet; this feature adds
`admin/api/_lib/mailer.js`, a Nodemailer Gmail transport mirroring
`api/stripe-webhook.js`'s `makeTransport()` exactly, using **new** admin-
project env vars `GMAIL_SENDER` / `GMAIL_APP_PASSWORD` (documented in
`admin/INVOICES_SETUP.md` — these must be configured on the **admin**
Vercel project specifically; they are not shared with the public site's
project). Emails are HTML + a plain-text fallback (`text:` field) — new
for this repo, since the existing webhook emails are HTML-only; the plan
adds `text` alongside `html` here rather than leaving it out, since PDF-
carrying business emails are more likely to hit strict corporate mail
filters that penalize HTML-only mail. All interpolated customer text goes
through the shared `escHtml()` copy. Before sending, the API requires an
explicit confirm step from the UI (recipient + document number shown), and
an `Idempotency-Key`-style guard (a `sending` flag set at the start of the
send transaction, cleared on success/failure) prevents duplicate sends from
a double click.

## 10. Security controls

- Every route: Bearer token + `admin_users` check (existing pattern), UUID
  validation on every `:id`/`:invoiceId` param, `no-store`, restricted
  CORS.
- No `select('*')` — explicit column allowlists per query, mirroring
  `bookingFields.js`.
- IDOR: invoice/receipt IDs are UUIDv4 (unguessable) and every read is
  still gated by admin auth regardless — there is no "public" invoice view
  in v1.
- Path traversal: PDF storage paths are always server-constructed from the
  row's own UUID (never from user input) before being handed to Supabase
  Storage.
- Financial calculations: server-authoritative only, `numeric` columns in
  Postgres, integer-pence arithmetic in the JS calculation layer to avoid
  float rounding; the browser-side total shown in the editor is a preview
  and is fully recomputed server-side on every write.
- Concurrency: issuing and payment-recording both re-read the invoice row
  inside the same transaction as the write, so two simultaneous "Issue"
  clicks or two simultaneous payments can't double-allocate a number or
  double-count a balance (enforced via the atomic counter RPC for numbering
  and a `WHERE document_status = 'draft'` / `WHERE payment_status <>
  'paid'` guard on the respective UPDATE for the other cases).

## 11. Migration / testing strategy

- Migration: additive only, `IF NOT EXISTS` guards throughout (matching
  existing migration style), zero changes to `bookings`, `admin_users`, or
  any existing table/policy/index. A dedicated
  `admin/tests/supabase/invoiceMigration.test.js` (mirroring the existing
  root-level `tests/supabase/migrations.test.js` static-content-check
  pattern) verifies the SQL file's content by regex rather than requiring a
  live DB connection.
- API/lifecycle/PDF/email/security tests per the original spec's full list,
  added incrementally per phase, using the existing `vi.mock()`
  Supabase/adminAuth mocking pattern; Stripe, storage, and the mailer are
  all mocked — no real network calls, no real email, no real payment, in
  any test.

## 12. Expected file changes (high level)

```
supabase/migrations/20260722000000_create_invoice_receipt_tables.sql   (new)
admin/api/_lib/businessSettings.js                                     (new)
admin/api/_lib/mailer.js                                                (new)
admin/api/_lib/escHtml.js                                               (new)
admin/api/_lib/invoiceCalculations.js                                   (new)
admin/api/_lib/invoicePdf.js                                            (new)
admin/api/invoices/index.js                                             (new)
admin/api/invoices/[id]/[[...action]].js                                (new)
admin/api/receipts/index.js                                             (new)
admin/api/receipts/[id]/[[...action]].js                                (new)
admin/src/pages/InvoiceListPage.tsx (+ .test.tsx)                       (new)
admin/src/pages/InvoiceEditorPage.tsx (+ .test.tsx)                     (new)
admin/src/pages/InvoiceDetailPage.tsx (+ .test.tsx)                     (new)
admin/src/pages/ReceiptListPage.tsx (+ .test.tsx)                       (new)
admin/src/pages/ReceiptDetailPage.tsx (+ .test.tsx)                     (new)
admin/src/App.tsx                                                       (edit — add routes)
admin/src/components/*  (financial-document UI pieces)                  (new)
admin/src/pages/BookingDetailPage.tsx                                   (edit — "Create invoice" entry point)
admin/package.json                                                      (edit — add pdfkit)
admin/INVOICES_SETUP.md / INVOICES_TESTING.md / INVOICES_USER_GUIDE.md / INVOICE_NUMBERING_POLICY.md  (new)
```

## 13. Owner decisions still required before go-live

1. Registered office address, bank/payment details, and VAT registration
   status — none of these exist in the repo; must be supplied by the owner
   into `businessSettings.js` before the first real invoice is issued.
2. `GMAIL_SENDER` / `GMAIL_APP_PASSWORD` must be provisioned on the admin
   Vercel project specifically (separate from the public site's).
3. The `financial-documents` Supabase Storage bucket must be created (the
   migration will attempt to create it via SQL where possible, but bucket
   creation/policy is partly a dashboard-level action depending on the
   Supabase project's storage API — documented precisely in
   `admin/INVOICES_SETUP.md`).
4. Confirm the admin project's 12/12 function count after this feature is
   acceptable, or whether headroom is needed for future features (would
   require either further consolidation or a Vercel plan upgrade).

## 14. Implementation order (commits)

1. `feat(db): add invoice and receipt schema` — this plan doc + migration +
   migration test.
2. `feat(admin): add numbering and calculation services`.
3. `feat(admin): add invoice APIs and lifecycle`.
4. `feat(admin): add invoice UI and booking integration`.
5. `feat(admin): add PDF generation and storage`.
6. `feat(admin): add email sending and history`.
7. `feat(admin): add payments and receipts`.
8. `test(admin): cover financial document workflows`.
9. `docs(admin): add setup and user guides`.

Not merged into `main`, not deployed, per the original instruction.
