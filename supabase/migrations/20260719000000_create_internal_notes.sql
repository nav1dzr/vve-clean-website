-- Internal notes for the admin CRM dashboard (Phase 3).
--
-- Append-only in version one — no UPDATE/DELETE policy or API route exists
-- for this table (ADMIN_CRM_PLAN.md 20). Notes are never visible to
-- customers: RLS is enabled with zero anon/authenticated policies, so the
-- only access path is the service-role key from admin/api/bookings/[id]/
-- notes.js, which itself re-checks admin_users membership on every request.
--
-- Additive-only migration — does not touch bookings, admin_users, or any
-- public-site table/policy, and has no effect on the Stripe webhook or
-- checkout flow.

CREATE TABLE IF NOT EXISTS internal_notes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  author_admin_id  uuid        NOT NULL REFERENCES public.admin_users(id),
  note             text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'internal_notes' AND indexname = 'idx_internal_notes_booking_id'
  ) THEN
    CREATE INDEX idx_internal_notes_booking_id ON internal_notes (booking_id, created_at DESC);
  END IF;
END $$;

ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policy is created, by design — see the header
-- comment. RLS with zero policies means anon/authenticated get zero rows
-- back even if a future bug ever queried this table from the browser.
