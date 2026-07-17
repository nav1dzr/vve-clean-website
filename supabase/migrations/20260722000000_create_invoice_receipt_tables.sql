-- Invoices & Receipts feature — core schema (Phase 1).
--
-- Additive only. Does not touch bookings, admin_users, internal_notes,
-- processed_stripe_events, or any existing policy/index/column. See
-- INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md for the full design rationale.
--
-- RLS convention matches the rest of this project: enable RLS, create zero
-- anon/authenticated policies, so the only access path is the service-role
-- key used by admin/api/invoices/* and admin/api/receipts/* (which
-- themselves re-check admin_users membership on every request). Explicit
-- GRANTs are added below even though 20260714000000_explicit_grants.sql's
-- ALTER DEFAULT PRIVILEGES should already cover new tables created by the
-- postgres role — that migration's own header comment explains why this
-- project prefers to be explicit rather than rely on the default alone.

-- ---------------------------------------------------------------------
-- 1. Document numbering — atomic, concurrency-safe, per-type, per-year.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_number_counters (
  doc_type    text NOT NULL,
  year        int  NOT NULL,
  last_number int  NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);

-- Atomic "give me the next number" operation. The INSERT ... ON CONFLICT
-- DO UPDATE is a single atomic statement in Postgres — two concurrent
-- callers cannot both receive the same number, and a new calendar year
-- starts a fresh row (and therefore a fresh count from 1) automatically
-- because `year` is part of the primary key, with no cutover code needed.
CREATE OR REPLACE FUNCTION next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year   int;
  v_number int;
  v_prefix text;
BEGIN
  v_year := date_part('year', now())::int;

  IF p_doc_type = 'invoice' THEN
    v_prefix := 'INV';
  ELSIF p_doc_type = 'receipt' THEN
    v_prefix := 'REC';
  ELSE
    RAISE EXCEPTION 'next_document_number: unknown doc_type %', p_doc_type;
  END IF;

  INSERT INTO document_number_counters (doc_type, year, last_number)
  VALUES (p_doc_type, v_year, 1)
  ON CONFLICT (doc_type, year)
  DO UPDATE SET last_number = document_number_counters.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------
-- 2. invoices
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  invoice_number         text        UNIQUE,

  customer_name          text        NOT NULL,
  customer_email         text,
  customer_phone         text,
  customer_address       text,
  customer_postcode      text,
  po_reference           text,

  issue_date             date,
  due_date               date,
  service_date           date,
  booking_ref_snapshot   text,

  currency               text        NOT NULL DEFAULT 'GBP',
  subtotal               numeric     NOT NULL DEFAULT 0,
  document_discount      numeric     NOT NULL DEFAULT 0,
  tax_total              numeric     NOT NULL DEFAULT 0,
  total                  numeric     NOT NULL DEFAULT 0,
  deposit_applied        numeric     NOT NULL DEFAULT 0,
  amount_paid            numeric     NOT NULL DEFAULT 0,
  amount_due             numeric     NOT NULL DEFAULT 0,

  customer_notes         text,
  internal_notes         text,
  payment_terms          text,

  document_status        text        NOT NULL DEFAULT 'draft'
                          CHECK (document_status IN ('draft','issued','void','cancelled')),
  payment_status         text        NOT NULL DEFAULT 'unpaid'
                          CHECK (payment_status IN ('unpaid','partially_paid','paid')),
  void_reason            text,

  created_by_admin_id    uuid        REFERENCES public.admin_users(id),
  issued_by_admin_id     uuid        REFERENCES public.admin_users(id),

  pdf_storage_path       text,
  document_version       int         NOT NULL DEFAULT 1,
  business_snapshot      jsonb,

  duplicated_from_id     uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  issued_at              timestamptz,
  sent_at                timestamptz,
  paid_at                timestamptz,
  void_at                timestamptz
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoices' AND indexname = 'idx_invoices_booking_id'
  ) THEN
    CREATE INDEX idx_invoices_booking_id ON invoices (booking_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoices' AND indexname = 'idx_invoices_status'
  ) THEN
    CREATE INDEX idx_invoices_status ON invoices (document_status, payment_status);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoices' AND indexname = 'idx_invoices_due_date'
  ) THEN
    CREATE INDEX idx_invoices_due_date ON invoices (due_date);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. invoice_items
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description    text        NOT NULL,
  quantity       numeric     NOT NULL DEFAULT 1,
  unit_price     numeric     NOT NULL DEFAULT 0,
  line_discount  numeric     NOT NULL DEFAULT 0,
  tax_rate       numeric,
  line_total     numeric     NOT NULL DEFAULT 0,
  sort_order     int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoice_items' AND indexname = 'idx_invoice_items_invoice_id'
  ) THEN
    CREATE INDEX idx_invoice_items_invoice_id ON invoice_items (invoice_id, sort_order);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. invoice_payments — append-only, reversals never delete.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_payments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount                numeric     NOT NULL,
  payment_date          date        NOT NULL,
  method                text        NOT NULL
                        CHECK (method IN ('bank_transfer','card','stripe','cash','other')),
  reference             text,
  notes                 text,
  created_by_admin_id   uuid        REFERENCES public.admin_users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  reversed_at           timestamptz,
  reversed_by_admin_id  uuid        REFERENCES public.admin_users(id),
  reversal_reason       text
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoice_payments' AND indexname = 'idx_invoice_payments_invoice_id'
  ) THEN
    CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments (invoice_id, created_at DESC);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. receipts
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS receipts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number       text        UNIQUE,
  invoice_id           uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  booking_id           uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,

  customer_name        text        NOT NULL,
  customer_email       text,
  customer_phone       text,
  customer_address     text,
  customer_postcode    text,

  invoice_number_snapshot text,
  invoice_total        numeric,
  total_paid           numeric     NOT NULL DEFAULT 0,
  payment_date         date,
  payment_method       text,
  payment_reference    text,

  business_snapshot    jsonb,
  created_by_admin_id  uuid        REFERENCES public.admin_users(id),
  pdf_storage_path     text,
  document_version     int         NOT NULL DEFAULT 1,

  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'receipts' AND indexname = 'idx_receipts_invoice_id'
  ) THEN
    CREATE INDEX idx_receipts_invoice_id ON receipts (invoice_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'receipts' AND indexname = 'idx_receipts_booking_id'
  ) THEN
    CREATE INDEX idx_receipts_booking_id ON receipts (booking_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6. invoice_events — append-only audit trail for both document types.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type  text        NOT NULL CHECK (document_type IN ('invoice','receipt')),
  document_id    uuid        NOT NULL,
  event_type     text        NOT NULL CHECK (event_type IN (
                    'created','updated','issued','previewed','pdf_generated',
                    'sent','resent','send_failed','payment_recorded',
                    'payment_reversed','paid','receipt_created','downloaded',
                    'duplicated','voided','cancelled'
                  )),
  admin_id       uuid        REFERENCES public.admin_users(id),
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'invoice_events' AND indexname = 'idx_invoice_events_document'
  ) THEN
    CREATE INDEX idx_invoice_events_document ON invoice_events (document_type, document_id, created_at DESC);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. RLS — enable, zero anon/authenticated policies (default-deny).
-- ---------------------------------------------------------------------

ALTER TABLE document_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_events           ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policy is created for any of the six objects
-- above, by design — see the header comment. RLS with zero policies means
-- anon/authenticated get zero rows back even if a future bug ever queried
-- these tables from the browser.

-- ---------------------------------------------------------------------
-- 8. Explicit service_role grants (belt-and-suspenders — see header).
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_number_counters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices                 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_items            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_payments         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipts                 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_events           TO service_role;
GRANT EXECUTE ON FUNCTION next_document_number(text) TO service_role;

-- ---------------------------------------------------------------------
-- 9. Private storage bucket for issued invoice/receipt PDFs.
--
-- `public = false` — no public URL ever works for this bucket. Downloads
-- only happen through the authenticated admin API routes, which mint a
-- short-lived signed URL after re-verifying admin_users membership. No
-- storage.objects RLS policy is added for the same reason no table policy
-- is added above: the service_role key bypasses RLS entirely in Supabase's
-- standard setup, so a policy would only matter for anon/authenticated
-- access, which this feature never grants.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-documents', 'financial-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Manual verification (run in Supabase SQL editor after applying):
--
-- select next_document_number('invoice'); -- expect INV-<current-year>-000001
-- select next_document_number('invoice'); -- expect INV-<current-year>-000002
-- select next_document_number('receipt'); -- expect REC-<current-year>-000001 (independent counter)
--
-- select relrowsecurity from pg_class where relname in
--   ('invoices','invoice_items','invoice_payments','receipts','invoice_events','document_number_counters');
-- -- expect relrowsecurity = true for all six rows
--
-- select * from pg_policies where tablename in
--   ('invoices','invoice_items','invoice_payments','receipts','invoice_events','document_number_counters');
-- -- expect zero rows (no anon/authenticated policies)
--
-- select id, public from storage.buckets where id = 'financial-documents';
-- -- expect one row, public = false
-- ---------------------------------------------------------------------
