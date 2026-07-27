-- Products & Services catalogue — admin-only list of reusable invoice line
-- items (name, optional description, default unit price in pence, service/
-- product type, optional category, active/archived status). Lets an admin
-- add a saved item to a draft invoice without retyping it. Invoice lines
-- store a plain copy of the text/price at insertion time, never a foreign
-- key back to this table, so editing a catalogue item can never alter an
-- existing invoice and editing an invoice line can never alter the
-- catalogue.
--
-- Additive only. Does not touch bookings, invoices, customers, or any
-- existing table/policy/index.
--
-- RLS convention matches the rest of this project: enable RLS, create zero
-- anon/authenticated policies, so the only access path is the service-role
-- key used by admin/api/catalogue.js (which itself re-checks admin_users
-- membership on every request). Explicit GRANTs are added below even though
-- 20260714000000_explicit_grants.sql's ALTER DEFAULT PRIVILEGES should
-- already cover new tables created by the postgres role — that migration's
-- own header comment explains why this project prefers to be explicit
-- rather than rely on the default alone.

CREATE TABLE IF NOT EXISTS catalogue_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text,
  -- Stored in pence (integer) so a default price can never accrue binary
  -- floating-point error; the admin API validates integer >= 0 on every
  -- write and the UI converts to pounds only at display time.
  default_price_pence integer     NOT NULL CHECK (default_price_pence >= 0),
  item_type           text        NOT NULL CHECK (item_type IN ('service','product')),
  category            text,
  status              text        NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive name lookup for the admin list/search and for the seed
-- endpoint's "skip names that already exist" idempotency check.
CREATE UNIQUE INDEX IF NOT EXISTS catalogue_items_lower_name_key
  ON catalogue_items (lower(name));

CREATE INDEX IF NOT EXISTS catalogue_items_status_name_idx
  ON catalogue_items (status, lower(name));

-- Keep updated_at honest without relying on every writer remembering it.
CREATE OR REPLACE FUNCTION set_catalogue_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalogue_items_set_updated_at ON catalogue_items;
CREATE TRIGGER catalogue_items_set_updated_at
  BEFORE UPDATE ON catalogue_items
  FOR EACH ROW EXECUTE FUNCTION set_catalogue_items_updated_at();

ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalogue_items TO service_role;

-- ---------------------------------------------------------------------
-- Manual verification (run in Supabase SQL editor after applying):
--
--   select relrowsecurity from pg_class where relname = 'catalogue_items';
--   -- expect: true
--
--   select * from pg_policies where tablename = 'catalogue_items';
--   -- expect: zero rows (no anon/authenticated policies)
--
--   insert into catalogue_items (name, default_price_pence, item_type)
--     values ('Test item', 5000, 'service');
--   update catalogue_items set name = 'Test item renamed' where name = 'Test item';
--   select name, default_price_pence, status, created_at < updated_at as bumped
--     from catalogue_items where name = 'Test item renamed';
--   -- expect: bumped = true
--   delete from catalogue_items where name = 'Test item renamed';
-- ---------------------------------------------------------------------
