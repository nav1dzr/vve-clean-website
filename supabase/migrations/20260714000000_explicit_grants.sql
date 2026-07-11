-- Explicit table privileges for the service_role PostgreSQL role.
--
-- Root cause of production 42501 errors: the webhook API connects with
-- SUPABASE_SERVICE_ROLE_KEY. Even though service_role bypasses RLS, it still
-- requires table-level GRANT from the database owner. Standard Supabase projects
-- set these via ALTER DEFAULT PRIVILEGES, but that guarantee does not always hold
-- for tables created outside the Supabase dashboard flow.
--
-- This migration adds explicit grants so service_role can operate on both tables
-- regardless of how or when ALTER DEFAULT PRIVILEGES was applied.
--
-- GRANT is idempotent — safe to run more than once.
-- This does NOT change any RLS policies.
-- The anon role still cannot read or write booking data.

-- Schema access
GRANT USAGE ON SCHEMA public TO service_role;

-- bookings — INSERT (pending_payment on checkout), SELECT (verify-payment,
-- confirmation-details), UPDATE (payment_status, notification flags, attribution)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.bookings
  TO service_role;

-- processed_stripe_events — INSERT (claim), SELECT (state read), UPDATE (complete/fail)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.processed_stripe_events
  TO service_role;

-- Sequences — needed for any SERIAL or BIGSERIAL primary keys; harmless for
-- UUID primaries (gen_random_uuid() is a function, not a sequence).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Set default privileges so any future tables created by postgres also grant
-- service_role access automatically — prevents this class of issue recurring.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
