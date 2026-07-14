# Phase 4 — CRM migration status and manual application guide

Covers every migration created for the admin CRM (Phases 1–3). None have been run by Claude — this repository has no configured, verified-safe Supabase CLI/remote-migration workflow, so per the Phase 4 instructions, none were applied automatically. **Status as of this document: unknown to this task** — Phase 1's `admin_users` and RLS-removal migrations were reported applied by the project owner at the start of Phase 2, but the three migrations created during Phases 2–3 (`717`, `718`, `719`) have not been confirmed applied. Treat all five as "apply before live testing" until confirmed otherwise.

## How the code behaves if a migration is missing

Every admin API route wraps its Supabase calls in error handling that returns a generic `500` (never a crash, never leaked detail — see `ADMIN_CRM_PLAN.md` §32). If a referenced column, table, or function doesn't exist yet, Postgres/PostgREST returns an error, which the route logs server-side and turns into `{ "error": "..." }` with a `500` status. **Concretely: the CRM will not silently corrupt or misrepresent data if a migration is missing — the affected feature will just fail safely with a generic error until the migration is applied.** This means Phase 4's local (mocked) tests all pass regardless of live migration status, but real end-to-end testing against the live Supabase project will not fully work until all five migrations below are applied, in order.

---

## Migration 1 of 5 — `20260715000000_create_admin_users.sql`

- **Purpose**: creates `admin_users`, the authorisation table every admin API route checks.
- **Order**: must run first — everything else depends on it existing (either directly, or via `admin/api/_lib/adminAuth.js`).
- **Additive**: yes — new table only.
- **Affects the public booking system**: no. Does not touch `bookings`, `quote_requests`, `contact_messages`, or `processed_stripe_events`.
- **Manual steps** (Supabase Dashboard → SQL Editor):
  1. Open the file, copy its full contents, paste into a new SQL Editor query, run it.
  2. Then follow `admin/SETUP.md` steps 4–6 to create the owner's `auth.users` account and insert their row into `admin_users` — this migration alone does not create any admin account.
- **Verification query**:
  ```sql
  select column_name, data_type from information_schema.columns where table_name = 'admin_users';
  select count(*) from admin_users; -- 0 until SETUP.md's manual insert step is done
  ```
- **Rollback**: `drop table if exists admin_users;` — safe, nothing else references it yet at this point in the sequence (migration 2 doesn't create a foreign key to it; migration 5's `internal_notes.author_admin_id` does, so roll back migration 5 first if it's been applied).

## Migration 2 of 5 — `20260716000000_remove_broad_bookings_select_policy.sql`

- **Purpose**: drops the pre-CRM `authenticated_read_bookings` RLS policy on `bookings` (`SELECT ... USING (true)`), with no replacement — closes a latent gap where any Supabase-authenticated account (not just admins) could read every booking row directly.
- **Order**: independent of the others — can run any time after or before migration 1, but logically belongs with it as the Phase 1 security pair.
- **Additive**: it's a removal, not an addition — but it removes a policy, not data or a table, and is fully reversible (see rollback). It does not touch any column or row.
- **Affects the public booking system**: no — verified by inspection in `ADMIN_CRM_PLAN.md` §10: the only Supabase client that ever runs in a browser (`src/lib/supabase.ts`, anon key) is never used to query `bookings`, and every server route that does query it uses the service-role key, which bypasses RLS and is unaffected by this policy's removal.
- **Manual steps**: paste and run the file's contents in the SQL Editor.
- **Verification query**:
  ```sql
  select policyname from pg_policies where tablename = 'bookings';
  -- expect: no row named authenticated_read_bookings
  ```
- **Rollback**: re-create the old policy if ever needed —
  ```sql
  create policy "authenticated_read_bookings" on bookings for select to authenticated using (true);
  ```
  (Not recommended — this is the exact policy Phase 1 removed as a security hardening measure.)

## Migration 3 of 5 — `20260717000000_add_crm_booking_fields.sql`

- **Purpose**: adds `bookings.status` (operational status, defaulted to `'new'`) and the six approved future fields — `total_price`, `quote_config`, `service_date`, `balance_status`, `balance_paid_at`, `balance_payment_method` — plus three supporting indexes.
- **Order**: after migrations 1–2; before migration 4 (its indexes reference these columns) and migration 5 (not directly dependent, but logically follows).
- **Additive**: yes. `status` is `NOT NULL` but is backfilled to `'new'` for every existing row in the same statement before the constraint is applied — no existing row is left without a valid value. Every other column is nullable.
- **Affects the public booking system**: no. `stripe-webhook.js` and `create-checkout-session.js` are untouched — they will simply continue to leave every new column `NULL` on every row they write, exactly as before this migration existed.
- **Manual steps**: paste and run the file's contents in the SQL Editor.
- **Verification query**:
  ```sql
  select column_name from information_schema.columns where table_name = 'bookings'
   and column_name in ('status','total_price','quote_config','service_date','balance_status','balance_paid_at','balance_payment_method');
  -- expect all 7 rows

  select conname from pg_constraint where conrelid = 'bookings'::regclass
   and conname in ('bookings_status_check','bookings_balance_status_check');
  -- expect both rows

  select count(*) from bookings where status is null; -- expect 0
  ```
- **Rollback**: each column can be dropped independently and safely, since nothing in the public site's code reads or writes them:
  ```sql
  alter table bookings drop column if exists status;
  alter table bookings drop column if exists total_price;
  alter table bookings drop column if exists quote_config;
  alter table bookings drop column if exists service_date;
  alter table bookings drop column if exists balance_status;
  alter table bookings drop column if exists balance_paid_at;
  alter table bookings drop column if exists balance_payment_method;
  drop index if exists idx_bookings_service_date;
  drop index if exists idx_bookings_total_price;
  drop index if exists idx_bookings_status_created_at;
  ```

## Migration 4 of 5 — `20260718000000_add_booking_search_support.sql`

- **Purpose**: enables `pg_trgm`, adds 6 trigram indexes (including 2 expression indexes on normalised phone/postcode), and creates `search_bookings()`.
- **Order**: after migration 3 (some indexes are functionally related to columns it adds, though not a hard `REFERENCES` dependency).
- **Additive**: yes — extension, indexes, and one function; no table/column changes.
- **Affects the public booking system**: no. `pg_trgm` is a standard, widely-used Postgres extension; enabling it has no effect on existing queries. `search_bookings()` is a new function nothing else calls.
- **Manual steps**: paste and run the file's contents in the SQL Editor. If `CREATE EXTENSION IF NOT EXISTS pg_trgm;` fails with a permissions error, it needs to be run as a superuser/via the Dashboard's SQL Editor (which runs as the project owner) rather than via a restricted role — this is a one-time step per Supabase project.
- **Verification query**:
  ```sql
  select extname from pg_extension where extname = 'pg_trgm'; -- expect 1 row
  select indexname from pg_indexes where tablename = 'bookings' and indexname like '%trgm%'; -- expect 6 rows
  select proname from pg_proc where proname = 'search_bookings'; -- expect 1 row

  -- Confirm EXECUTE is properly restricted:
  select grantee, privilege_type from information_schema.routine_privileges
   where routine_name = 'search_bookings';
  -- expect only service_role listed with EXECUTE, never anon/authenticated/PUBLIC
  ```
- **Rollback**:
  ```sql
  drop function if exists search_bookings(text, integer);
  drop index if exists idx_bookings_full_name_trgm;
  drop index if exists idx_bookings_address_trgm;
  drop index if exists idx_bookings_email_trgm;
  drop index if exists idx_bookings_booking_ref_trgm;
  drop index if exists idx_bookings_phone_normalized_trgm;
  drop index if exists idx_bookings_postcode_normalized_trgm;
  -- pg_trgm is left enabled (harmless, and other future features may want it)
  ```

## Migration 5 of 5 — `20260719000000_create_internal_notes.sql`

- **Purpose**: creates `internal_notes`, the append-only notes table.
- **Order**: last — its `author_admin_id` column references `admin_users(id)` (migration 1) and its `booking_id` column references `bookings(id)` (pre-existing table).
- **Additive**: yes — new table only.
- **Affects the public booking system**: no.
- **Manual steps**: paste and run the file's contents in the SQL Editor.
- **Verification query**:
  ```sql
  select column_name from information_schema.columns where table_name = 'internal_notes';
  select policyname from pg_policies where tablename = 'internal_notes'; -- expect 0 rows (RLS on, no policies)
  select indexname from pg_indexes where tablename = 'internal_notes'; -- expect idx_internal_notes_booking_id
  ```
- **Rollback**: `drop table if exists internal_notes;` — safe, nothing else references it.

---

## Recommended application order (all five, if none are applied yet)

```
1. 20260715000000_create_admin_users.sql
2. 20260716000000_remove_broad_bookings_select_policy.sql
3. 20260717000000_add_crm_booking_fields.sql
4. 20260718000000_add_booking_search_support.sql
5. 20260719000000_create_internal_notes.sql
```

Each is idempotent (`IF NOT EXISTS` guards throughout) — safe to re-run any of them if application order or completion is uncertain.

## What will not work until all five are applied

- Login/logout/password-reset: work with **only migration 1** applied (and the manual owner-account setup in `admin/SETUP.md`).
- Dashboard, search, booking list, booking detail (read-only): need migrations **1, 3, and 4**.
- Internal notes: need migration **5** in addition to the above.
- Status/balance editing: need migration **3** in addition to the above (the columns must exist to be updated).

If only migration 1 is applied, the app is fully usable for login but every data-bearing page will show a generic error state (§ "How the code behaves if a migration is missing" above) rather than breaking or showing wrong data.
