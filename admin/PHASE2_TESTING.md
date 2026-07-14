# Phase 2 testing notes

Covers the read-only CRM: dashboard home, global search, booking list, booking detail.

## 1. Apply the migrations manually

Phase 1's migrations must already be applied (`admin_users` exists, an owner account is linked — see `admin/SETUP.md`). Then apply, in order, via the Supabase SQL editor or CLI:

1. `supabase/migrations/20260717000000_add_crm_booking_fields.sql`
2. `supabase/migrations/20260718000000_add_booking_search_support.sql`

Both are additive/idempotent (`IF NOT EXISTS` guards throughout) — safe to re-run. Verify afterwards:

```sql
select column_name from information_schema.columns
 where table_name = 'bookings' and column_name in
   ('status','total_price','quote_config','service_date','balance_status','balance_paid_at','balance_payment_method');

select proname from pg_proc where proname = 'search_bookings';

select extname from pg_extension where extname = 'pg_trgm';
```

## 2. Local test steps

From `admin/`:

```
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

To exercise the API routes locally (not just unit tests), run `vercel dev` from `admin/` (requires the Vercel CLI, linked to the project, and `admin/.env` populated from `admin/.env.example`) — plain `vite dev` does not run the `admin/api/*` serverless functions.

## 3. Example search cases to try once `vercel dev` + real data are available

| Input | Expected to match |
|---|---|
| `Jasmine` | Partial name, case-insensitive |
| `07123 456789` | Phone with spaces |
| `+447123456789` | Same booking as above (07/+44 equivalence) |
| `n15 5nj` | Postcode, lowercase, with space |
| `N155NJ` | Same booking, no space, uppercase |
| `N15NJ180726` | Exact/partial booking reference |
| a booking's real UUID | Exact match only (not a partial-UUID match) |
| `a` | Rejected client-side before any request — below the minimum length and not UUID-shaped |
| 101+ character string | Rejected — over the maximum length |

## 4. Expected missing-data behaviour

Every historical booking (created before Phase 2's columns existed) will have `status = 'new'` (backfilled default) and `NULL` for `total_price`, `quote_config`, `service_date`, `balance_status`, `balance_paid_at`, `balance_payment_method`. Confirm the UI never shows `£undefined`, `£NaN`, or `Invalid Date` for these rows — it should show "Not recorded" / "Date not structured" / "Itemised quote unavailable" / "Balance unavailable" instead (see `admin/src/lib/format.ts`). The dashboard's "Outstanding balances" tile should read "No data yet" rather than "0" until at least one row has a `balance_status` set.

## 5. Security checks specific to Phase 2

- Confirm `search_bookings` cannot be called by `anon` or `authenticated`:
  ```sql
  set role anon;
  select * from search_bookings('test');  -- should fail: permission denied
  reset role;
  ```
- Confirm `/api/bookings/:id` returns 400 for a non-UUID id (e.g. a booking reference) and 404 for a well-formed UUID that doesn't exist.
- Confirm none of the four Phase 2 API responses ever contain `confirmation_token` (covered by automated tests in `admin/api/bookings/id.test.js`, `bookingFields.test.js`, but worth re-checking against real data once live).
- Confirm `/api/search`, `/api/bookings`, `/api/bookings/:id`, `/api/dashboard-summary` all return 401 with no `Authorization` header and 403 for a Supabase-authenticated account that isn't in `admin_users`.

## 6. What must be verified online in Phase 4 (deferred — not testable locally)

- Real search behaviour against production-shaped data volume and formatting variance (the 07/+44 and postcode-normalisation rules were written against the confirmed logic in `stripe-webhook.js`/`create-checkout-session.js`, but have not been run against real customer-entered phone/postcode strings).
- `pg_trgm` index actually being used by the query planner at real data volume (`EXPLAIN ANALYZE` on `search_bookings` and the booking list query).
- Mobile layout at 360/390px on a real device — the booking list's filter panel, table→card breakpoint, and the detail page's sticky action bar were built to spec but not visually verified in a real browser in this environment.
- Pagination UX with a realistic number of bookings (the current dataset size in Supabase is unknown to this task).
- `vercel dev` actually serving `admin/api/*` correctly end-to-end (only unit-tested with mocked Supabase clients so far).
