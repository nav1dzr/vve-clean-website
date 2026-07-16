# Invoices & Receipts — setup

One-time manual steps required before the invoices/receipts feature is
usable in a real environment. Mirrors the style of `admin/SETUP.md` — these
are dashboard/environment actions that can't be expressed as a migration or
committed to the repo.

## 1. Apply the migrations, in order

```
supabase/migrations/20260722000000_create_invoice_receipt_tables.sql
supabase/migrations/20260723000000_add_customers_and_payment_options.sql
```

The first creates `document_number_counters`, `invoices`, `invoice_items`,
`invoice_payments`, `receipts`, `invoice_events`, the `next_document_number()`
RPC, and the private `financial-documents` storage bucket. The second
(additive-only, applied after it) creates `customers` and adds per-invoice
payment-option, service-contact, and recipient-override columns to
`invoices` — see that file's own header for the full column list and
rationale. Apply both the same way `admin/SETUP.md`'s existing migrations
are applied (there is no CI automation in this repo for `supabase db push`;
each must be run manually against the live database, same as every other
migration in this project).

After applying each, run the manual verification SQL included as comments
at the bottom of that migration file (checks numbering, RLS status, absence
of anon/authenticated policies, and the storage bucket's `public = false`
flag for the first; RLS/columns for `customers` and the new `invoices`
columns for the second).

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
| `INVOICE_BANK_REFERENCE_INSTRUCTIONS` | Optional free text (e.g. "Please use your invoice number as reference") shown under the bank details on the PDF/email | — (bank details still work without it) |
| `INVOICE_VAT_ENABLED` | `"true"` to enable VAT (default: disabled) | only if VAT-registered — see below |
| `INVOICE_VAT_NUMBER` | Printed only when `INVOICE_VAT_ENABLED=true` | — |

### Payment options (per invoice)

Every invoice independently chooses how the customer is told to pay —
**bank transfer**, a **Stripe payment link**, or **both** — defaulting to
bank transfer. This is stored on the invoice itself
(`invoices.payment_option`), not a global setting, and is frozen into
`invoices.payment_instructions_snapshot` the moment the invoice is issued —
see `admin/INVOICE_NUMBERING_POLICY.md`-style immutability: changing
`INVOICE_BANK_*` env vars or an admin's Stripe link habits afterwards never
alters an already-issued invoice's PDF or email.

The bank-transfer option only ever shows the bank block when all three
`INVOICE_BANK_*` variables above are set (same "omit, never fabricate" rule
as before). The Stripe option requires the admin to paste an actual
Stripe-hosted payment-link URL when creating/editing the draft — validated
server-side (`admin/api/_lib/paymentOptions.js`) to be `https://` and hosted
on `buy.stripe.com` or `checkout.stripe.com` only; anything else (including
`javascript:`/`data:` URLs or lookalike domains) is rejected with a 400
before it is ever stored. **This never creates a Stripe charge and never
marks the invoice paid** — clicking the link is between the customer and
Stripe; the admin still records the payment manually once it arrives (see
`admin/INVOICES_USER_GUIDE.md`). It also never touches or changes the
public site's existing £30 booking-deposit Stripe Checkout flow — that is a
completely separate code path (`api/create-checkout-session.js`) that this
feature does not import from or write to.

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

1. Confirm `SELECT * FROM pg_policies WHERE tablename IN ('invoices', 'invoice_items', 'invoice_payments', 'receipts', 'invoice_events', 'document_number_counters', 'customers');` returns zero rows.
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
5. Go to **Customers → + New customer**, create a test customer, then use
   its **Create invoice** and **Create booking** quick actions and confirm
   both land correctly (a prefilled invoice draft; a booking visible on
   **Bookings** with source `admin_manual`).

## Vercel function count

The admin project has a 12-function ceiling on its current plan. This
feature (invoices, receipts, and now customers) fits at **exactly 12/12**
by consolidating routes with Vercel's optional catch-all segment rather
than one file per action or resource — see
`INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md` §7 and the header comments in
`admin/api/invoices/[id]/[[...action]].js`,
`admin/api/receipts/[[...segments]].js`, and
`admin/api/customers/[[...segments]].js`. **Do not add another file under
`admin/api/`** without first checking the count
(`find admin/api -name "*.js" -not -path "*/_lib/*" | wc -l` from the repo
root) — extend one of the three existing catch-all dispatchers instead.

## 6. Customers

`customers` is a new, entirely additive table — it does **not** add a
`customer_id` column to `bookings`. Customer "history" (bookings shown on
a customer's detail page) is matched at query time by normalised
email/phone, not a foreign key; invoices/receipts are matched exactly via
the new `invoices.billing_customer_id`/`service_customer_id` columns. No
manual setup is required for this beyond applying migration #2 above — see
`admin/INVOICES_USER_GUIDE.md` for how admins use it day to day.

## Rollback

Both migrations are purely additive and touch nothing that already existed
(`bookings`, `admin_users`, `internal_notes`, `processed_stripe_events`, or
any of their policies) beyond the two new nullable FK columns on `invoices`.

To roll back migration #2: `DROP TABLE customers` (this also drops the
`billing_customer_id`/`service_customer_id` foreign keys via
`ON DELETE SET NULL`, but to fully remove the columns themselves also run
`ALTER TABLE invoices DROP COLUMN payment_option, DROP COLUMN
stripe_payment_link_url, DROP COLUMN payment_instructions_snapshot, DROP
COLUMN service_contact_name, DROP COLUMN service_contact_email, DROP COLUMN
service_contact_phone, DROP COLUMN service_address, DROP COLUMN
service_contact_postcode, DROP COLUMN invoice_recipient_email, DROP COLUMN
receipt_recipient_email, DROP COLUMN billing_customer_id, DROP COLUMN
service_customer_id`).

To roll back migration #1: `DROP TABLE` the six original tables (in
dependency order: `invoice_payments`, `invoice_items`, `invoice_events`,
`receipts`, `invoices`, then `document_number_counters`), `DROP FUNCTION
next_document_number(text)`, and delete the `financial-documents` bucket
from the Storage dashboard once it's empty. No existing booking, payment,
or notification behaviour depends on any of these objects existing.
