-- Invoices & Receipts feature — customers, payment options, and separate
-- service/billing contacts. Additive only, same convention as
-- 20260722000000_create_invoice_receipt_tables.sql: new table + new
-- nullable/defaulted columns on `invoices`, no existing column dropped or
-- redefined, nothing in `bookings`/`admin_users`/the public checkout or
-- webhook flow touched.
--
-- Design notes (see admin/INVOICES_SETUP.md and
-- admin/INVOICE_NUMBERING_POLICY.md's siblings for the user-facing version):
--
-- * `customers` is new and entirely owned by this feature. `bookings` is
--   NOT given a customer_id FK here — that would be a schema change to a
--   table this feature does not own, and is unnecessary: customer "booking
--   history" is derived at query time by matching normalised email/phone,
--   which is additive-safe and reversible (see customerLifecycle.js).
--
-- * The existing `invoices.customer_name/email/phone/address/postcode`
--   columns keep their current meaning — the BILLING contact (this is what
--   they have always represented: the addressee used for totals, the PDF
--   "Bill to" block, and the default send-to address). Nothing about them
--   changes here.
--
-- * A SEPARATE service contact is added as its own set of nullable columns
--   (service_contact_*), not a snapshot jsonb blob — this keeps it exactly
--   as editable-while-draft, frozen-once-issued as every other invoice
--   field already is, with no special-casing needed anywhere else.
--
-- * payment_instructions_snapshot (jsonb) freezes the resolved bank/Stripe
--   payment instructions at issue time, mirroring business_snapshot — so an
--   issued invoice's PDF/email never silently changes if bank env vars or
--   the business's Stripe link policy change later.

-- ---------------------------------------------------------------------
-- 1. customers
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text        NOT NULL,
  email                     text,
  phone                     text,
  address                   text,
  postcode                  text,
  customer_type             text        NOT NULL DEFAULT 'individual',
  source                    text        NOT NULL DEFAULT 'other',
  preferred_contact_method  text,
  notes                     text,

  -- Lowercased/trimmed email and digits-only phone, maintained by
  -- customerLifecycle.js on every create/update — used only for duplicate
  -- detection (never shown in the UI, never used for login/auth).
  normalised_email          text,
  normalised_phone          text,

  created_by_admin_id       uuid        REFERENCES public.admin_users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customers_customer_type_check' AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_customer_type_check
      CHECK (customer_type IN ('individual', 'landlord', 'letting_agent', 'agency', 'business'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customers_source_check' AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_source_check
      CHECK (source IN ('website', 'phone', 'whatsapp', 'email', 'referral', 'google', 'repeat_customer', 'other'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customers_preferred_contact_method_check' AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_preferred_contact_method_check
      CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('phone', 'email', 'whatsapp'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'customers' AND indexname = 'idx_customers_normalised_email') THEN
    CREATE INDEX idx_customers_normalised_email ON customers (normalised_email) WHERE normalised_email IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'customers' AND indexname = 'idx_customers_normalised_phone') THEN
    CREATE INDEX idx_customers_normalised_phone ON customers (normalised_phone) WHERE normalised_phone IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'customers' AND indexname = 'idx_customers_postcode') THEN
    CREATE INDEX idx_customers_postcode ON customers (postcode) WHERE postcode IS NOT NULL;
  END IF;
END $$;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policy — same default-deny convention as every
-- other table in this feature (see 20260722000000's header). Only the
-- service-role key, used by admin/api/customers/*, can read/write.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO service_role;

-- ---------------------------------------------------------------------
-- 2. invoices — payment options and separate service contact.
-- ---------------------------------------------------------------------

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_option text NOT NULL DEFAULT 'bank_transfer';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_payment_option_check' AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_option_check
      CHECK (payment_option IN ('bank_transfer', 'stripe_payment_link', 'both'));
  END IF;
END $$;

-- Validated server-side (admin/api/_lib/paymentOptions.js) before it is
-- ever stored: must be an https:// URL on an approved Stripe host. Never
-- rendered as a clickable link anywhere except that exact validated value.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_url text;

-- Frozen at issue time — see file header. NULL for a draft (a draft has no
-- frozen anything yet; its PDF preview uses live settings, same as
-- business_snapshot's existing behaviour).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_instructions_snapshot jsonb;

-- Separate SERVICE contact/address — who/where the work was actually done
-- for, when different from who is billed (e.g. tenant receives the
-- service, an agency is billed). NULL means "same as billing" and every
-- renderer (PDF/email/UI) must treat it that way, never show a blank
-- section.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_contact_name     text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_contact_email    text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_contact_phone    text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_address          text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_contact_postcode text;

-- Explicit per-document recipient overrides. NULL falls back to the
-- billing contact's customer_email — these exist so "send the invoice to
-- the agency but the receipt to the landlord" is a stored, reusable
-- default rather than something re-typed on every send (the existing
-- per-send `body.to` override in the send/resend routes still works on
-- top of this for a genuine one-off correction).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_recipient_email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_recipient_email text;

-- Optional links to a `customers` row. Both nullable and ON DELETE SET
-- NULL — an invoice must never become unreadable or be deleted as a
-- side-effect of a customer record being removed; it simply reverts to
-- showing its own already-stored snapshot fields (customer_name etc. /
-- service_contact_* are the source of truth for rendering, never a live
-- join to `customers`).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'invoices' AND indexname = 'idx_invoices_billing_customer_id') THEN
    CREATE INDEX idx_invoices_billing_customer_id ON invoices (billing_customer_id) WHERE billing_customer_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'invoices' AND indexname = 'idx_invoices_service_customer_id') THEN
    CREATE INDEX idx_invoices_service_customer_id ON invoices (service_customer_id) WHERE service_customer_id IS NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. invoice_events — widen document_type to also audit customer records.
--    event_type is unchanged: 'created'/'updated' already fit a customer
--    being created/edited without needing new enum values.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname FROM pg_constraint
   WHERE conrelid = 'invoice_events'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%document_type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoice_events DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE invoice_events ADD CONSTRAINT invoice_events_document_type_check
  CHECK (document_type IN ('invoice', 'receipt', 'customer'));

-- ---------------------------------------------------------------------
-- Manual verification (run in Supabase SQL editor after applying):
--
-- select relrowsecurity from pg_class where relname = 'customers';
-- -- expect true
--
-- select * from pg_policies where tablename = 'customers';
-- -- expect zero rows
--
-- select column_name from information_schema.columns
--  where table_name = 'invoices' and column_name in
--   ('payment_option','stripe_payment_link_url','payment_instructions_snapshot',
--    'service_contact_name','service_address','invoice_recipient_email',
--    'receipt_recipient_email','billing_customer_id','service_customer_id');
-- -- expect all nine rows
--
-- select conname from pg_constraint where conrelid = 'invoice_events'::regclass and contype = 'c';
-- -- expect the document_type check to include 'customer'
-- ---------------------------------------------------------------------
