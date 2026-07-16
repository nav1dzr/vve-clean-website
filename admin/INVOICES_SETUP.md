# Invoices & Receipts — setup

One-time manual steps required before the invoices/receipts feature is
usable in a real environment. Mirrors the style of `admin/SETUP.md` — these
are dashboard/environment actions that can't be expressed as a migration or
committed to the repo.

## 1. Apply the migration

```
supabase/migrations/20260722000000_create_invoice_receipt_tables.sql
```

Creates `document_number_counters`, `invoices`, `invoice_items`,
`invoice_payments`, `receipts`, `invoice_events`, the `next_document_number()`
RPC, and the private `financial-documents` storage bucket. Additive only —
apply it the same way `admin/SETUP.md`'s existing migrations are applied
(there is no CI automation in this repo for `supabase db push`; it must be
run manually against the live database, same as every other migration in
this project).

After applying, run the manual verification SQL included as comments at the
bottom of the migration file (checks numbering, RLS status, absence of
anon/authenticated policies, and the storage bucket's `public = false`
flag).

## 2. Configure business identity

`admin/api/_lib/businessSettings.js` ships with the already-public identity
facts hardcoded (trading name, company number, phone, website, email — the
same values already printed on live booking confirmation emails) and three
groups of fields deliberately left **unset**, because none of them exist
anywhere in this repository and guessing them would be worse than leaving
them blank:

Set these as environment variables on the **admin** Vercel project
(Project Settings → Environment Variables — separate from the public site's
project):

| Variable | Purpose | Required before... |
|---|---|---|
| `INVOICE_BUSINESS_ADDRESS` | Registered/trading address printed on invoices | issuing any real invoice |
| `INVOICE_BANK_ACCOUNT_NAME` | Payment-details block | accepting bank transfer payments |
| `INVOICE_BANK_SORT_CODE` | Payment-details block | accepting bank transfer payments |
| `INVOICE_BANK_ACCOUNT_NUMBER` | Payment-details block | accepting bank transfer payments |
| `INVOICE_VAT_ENABLED` | `"true"` to enable VAT (default: disabled) | only if VAT-registered — see below |
| `INVOICE_VAT_NUMBER` | Printed only when `INVOICE_VAT_ENABLED=true` | — |

**VAT**: leave `INVOICE_VAT_ENABLED` unset (or `"false"`) unless the
business is confirmed VAT-registered. No invoice/receipt template prints a
VAT row, VAT number, or VAT-related wording unless this flag is explicitly
`"true"` — this was a hard requirement from the original feature spec, not
a default that can be silently overridden by another setting.

The bank-details block on a PDF/email is simply omitted (not shown as
blank/"—") until all three `INVOICE_BANK_*` variables are set — see
`hasBankDetails()` in `businessSettings.js`.

## 3. Configure the mailer

Invoice/receipt sending is the first email sender inside the admin app
(separate from the public site's `api/stripe-webhook.js` mailer). Set on
the **admin** Vercel project:

- `GMAIL_SENDER` — the Google Workspace address to send from
- `GMAIL_APP_PASSWORD` — an app password for that address (not the account
  password — same requirement as the public site's existing mailer)

Until both are set, `admin/api/_lib/mailer.js`'s `isMailerConfigured()`
returns `false` and the send/resend routes return a clear 500 rather than
attempting a send and failing silently or partially.

## 4. Create the private storage bucket (if the migration couldn't)

The migration attempts `INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-documents', 'financial-documents', false)`. If your
Supabase project's permissions don't allow creating a bucket via SQL
(this varies by plan/project configuration), create it manually instead:

Supabase dashboard → **Storage** → **New bucket** → name
`financial-documents` → **Public bucket: OFF**. No storage policies need to
be added — the service-role key used by every admin API route bypasses RLS
entirely (same reasoning as the public-site tables' service-role-only
access pattern), so a bucket with zero policies and `public: false` is the
correct, complete configuration.

## 5. Verify

1. Confirm `SELECT * FROM pg_policies WHERE tablename IN ('invoices', 'invoice_items', 'invoice_payments', 'receipts', 'invoice_events', 'document_number_counters');` returns zero rows.
2. Confirm `SELECT id, public FROM storage.buckets WHERE id = 'financial-documents';` returns one row with `public = false`.
3. Sign in to the admin app, go to **Invoices → New invoice**, create a
   test draft with a fake customer, issue it, and confirm a PDF becomes
   downloadable. This exercises the number-allocation RPC and the storage
   upload path end-to-end without needing a real payment or a real email.
4. Only once `GMAIL_SENDER`/`GMAIL_APP_PASSWORD` are set, send that test
   invoice to an address you control and confirm the PDF attachment opens
   correctly and the HTML email renders as expected in a real mail client
   (this repository's test suite mocks the mailer everywhere — it never
   sends a real email, so this manual check is the only way to confirm
   real deliverability/rendering).

## Rollback

The migration is purely additive — it creates six new database objects and
one storage bucket, and touches nothing that already existed (`bookings`,
`admin_users`, `internal_notes`, `processed_stripe_events`, or any of their
policies). To roll back: `DROP TABLE` the six new tables (in dependency
order: `invoice_payments`, `invoice_items`, `invoice_events`, `receipts`,
`invoices`, then `document_number_counters`), `DROP FUNCTION
next_document_number(text)`, and delete the `financial-documents` bucket
from the Storage dashboard once it's empty. No existing booking, payment,
or notification behaviour depends on any of these objects existing.
