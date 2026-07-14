# Phase 3 testing notes

Covers internal notes, operational booking-status editing, and internal balance tracking.

## 1. Apply the migration manually

Phases 1 and 2's migrations must already be applied (see `admin/SETUP.md` and `admin/PHASE2_TESTING.md`). Then apply:

```
supabase/migrations/20260719000000_create_internal_notes.sql
```

Additive-only, idempotent. Verify afterwards:

```sql
select column_name from information_schema.columns where table_name = 'internal_notes';

select policyname from pg_policies where tablename = 'internal_notes';
-- expect: no rows — RLS is enabled with zero anon/authenticated policies.
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

To exercise the new nested routes locally (`/api/bookings/:id/notes`, `/status`, `/balance`), run `vercel dev` from `admin/` — see `admin/VERCEL_SETUP.md`.

## 3. Notes tests to try once live

- Add a note with normal text — appears at the top of the list immediately, no page reload.
- Add a note with only whitespace — rejected client-side (`Enter a note before saving.`) before any request is sent.
- Add a note over 2000 characters — the textarea's `maxLength` prevents typing past the limit in the first place; the server independently rejects anything over 2000 too (defence in depth — test this by calling the API directly with a longer string, bypassing the UI).
- Confirm the author shown is always the currently logged-in admin, never something supplied by the client.
- Confirm there is no edit or delete control anywhere in the notes UI.

## 4. Status tests to try once live

- Change to each of the 8 values (`new`, `confirmed`, `scheduled`, `in_progress`, `completed`, `rescheduled`, `cancelled`, `no_show`) — all except `cancelled`/`no_show` apply immediately with a "Status updated." message.
- Change to `cancelled` or `no_show` — a confirmation panel appears first; clicking Cancel there applies nothing (no PATCH request is sent); clicking Confirm applies it.
- Confirm `payment_status` never changes as a side effect (check the Payment-status badge in the header stays the same before/after any status change).
- Confirm no email/Telegram/Sheets notification fires from a status change (nothing in this route touches those integrations — they live exclusively in the public site's `api/stripe-webhook.js`, untouched by Phase 3).

## 5. Balance tests to try once live

- Set balance status to `outstanding`, `waived`, `not_due` — no payment-method field appears, `balance_paid_at`/`balance_payment_method` are cleared.
- Set balance status to `paid` — a payment-method selector appears; saving without picking one still succeeds (method is optional), `balance_paid_at` is set to the current time automatically.
- Move a `paid` balance back to `outstanding` — confirm `balance_paid_at` and the payment method both clear (documented rule, see `ADMIN_CRM_PLAN.md`'s Phase 3 note).
- Confirm the deposit `payment_status` badge ("Paid"/"Pending payment") and the balance `balanceStatus` badge are always shown as two distinct badges — never collapsed into one.
- Confirm no Stripe call happens (there is nothing to click that would trigger one — `admin/api/bookings/[id]/balance.js` has no Stripe import; this is also asserted by a test that reads the file's source directly).
- With a booking that has no `total_price` recorded: confirm the detail page shows "Total not recorded — balance cannot be calculated." rather than a number or blank.

## 6. Security checks specific to Phase 3

- `GET /api/bookings/:id/notes`, `POST .../notes`, `PATCH .../status`, `PATCH .../balance` all return 401 with no `Authorization` header and 403 for a Supabase-authenticated account not in `admin_users`.
- All four return 400 for a non-UUID booking id, and 404 for a well-formed UUID that doesn't exist.
- `PATCH .../status` rejects any value outside the 8-item whitelist, including payment-related values like `deposit_paid`/`refunded` that were deliberately excluded from the operational-status vocabulary (`ADMIN_CRM_PLAN.md` §21).
- `PATCH .../balance` rejects any `balanceStatus`/`balancePaymentMethod` outside their whitelists.
- Confirm `internal_notes` cannot be queried by `anon` or `authenticated` directly:
  ```sql
  set role anon;
  select * from internal_notes limit 1;  -- should return zero rows
  reset role;
  ```
- Confirm no admin API response anywhere contains `confirmation_token` (covered by automated tests, worth spot-checking against real data once live).
- Confirm server logs for these three routes contain only booking id / admin id / status-or-balance-status value — never note text, phone, email, address, or tokens (read the `console.log`/`console.error` calls in `notes.js`/`status.js`/`balance.js` directly if in doubt).

## 7. What must be verified online in Phase 4 (deferred — not testable locally)

- The Modal's focus-management fix (mount-only effect, prefers `textarea` over the close button) behaves correctly in a real browser, not just jsdom — jsdom's focus/keyboard event simulation is a reasonable approximation but not identical to Chrome/Safari/mobile Safari.
- The add-note bottom-sheet-on-mobile / centred-card-on-desktop layout at real 360px/390px viewport widths.
- The sticky Call/WhatsApp/Email action bar's position relative to the mobile bottom nav and the on-screen keyboard when the add-note textarea is focused (a real risk on mobile Safari specifically, which resizes the viewport when the keyboard opens).
- Escape-to-close and click-outside-to-close on real touch devices (touch doesn't have a true "outside click" the same way a mouse does).
