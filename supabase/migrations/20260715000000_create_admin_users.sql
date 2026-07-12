-- Admin authorisation table for the admin CRM dashboard (Phase 1).
--
-- This table is the single source of truth for "is this Supabase Auth
-- account allowed to use the admin dashboard" — it deliberately does NOT
-- duplicate the account's email. auth.users remains the source of truth for
-- email; admin_users only proves authorisation. See ADMIN_CRM_PLAN.md §9.
--
-- No row is inserted by this migration: the first admin's auth.users UUID
-- does not exist yet at migration-authoring time (the account must be
-- created manually first). See admin/SETUP.md for the exact manual step.
--
-- This migration only adds a new table. It does not touch `bookings`,
-- `quote_requests`, `contact_messages`, or `processed_stripe_events`, and
-- has no effect on the public site, Stripe, the webhook, or any existing
-- API route.

CREATE TABLE IF NOT EXISTS admin_users (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- No policy is created for `anon` or `authenticated` — this table is only
-- ever read via the admin app's server-side API routes using the
-- service-role key, which bypasses RLS. Leaving RLS enabled with zero
-- policies means anon/authenticated get zero rows back, as a defence-in-depth
-- backstop even if a future bug ever queried this table from the browser.
