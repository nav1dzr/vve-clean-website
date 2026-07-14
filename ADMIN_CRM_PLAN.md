# VVE Clean — Admin CRM / Booking Dashboard: Plan & Architecture

Status: Phase 1 (foundation/auth/authorisation) **complete**. Phase 2 (dashboard, search, booking list, booking detail — read-only) **complete on this branch**. Internal notes, status editing, and balance tracking (Phase 3) are **not** built yet.
Branch: `feat/admin-crm-dashboard`

This document was corrected after the Phase 1 review to reflect approved decisions on routes, authentication, data access, and the operational-status model — see the inline "Approved correction" notes throughout (§6, §13, §21, §22, §24, §35). See the "Phase 2 implementation decisions" note below for what was actually built in Phase 2 versus what remained design-only in the original plan.

> **Phase 2 implementation decisions** (read-only CRM: dashboard, search, booking list, booking detail):
> - **Migrations applied**: `20260717000000_add_crm_booking_fields.sql` (bookings.status + the six approved future fields from §24 item 7 — total_price, quote_config, service_date, balance_status, balance_paid_at, balance_payment_method — all created together in Phase 2, since the API layer needed them to exist to be buildable at all) and `20260718000000_add_booking_search_support.sql` (pg_trgm, matching indexes, `search_bookings()`).
> - **All four §25 API routes exist**: `/api/dashboard-summary`, `/api/search`, `/api/bookings`, `/api/bookings/:id` — each reusing `verifyAdminRequest()` (§9), each with an explicit column allowlist (`CARD_SELECT`/`DETAIL_SELECT` in `admin/api/_lib/bookingFields.js`) so `confirmation_token` can never leak even if a future column is added carelessly.
> - **Postcode list-filter scope note** (§18): the dedicated `/api/search` endpoint does full postcode normalisation (spaces/case, via `search_bookings()`) as originally specified in §17. The **booking list's** `postcode` filter, by contrast, is a simpler case-insensitive partial match on the stored column as-is — it does not independently re-normalise spacing between the query and stored data. This was a deliberate, documented scope reduction (see the comment in `admin/api/bookings/index.js`) to avoid building two separate normalisation code paths for a filter versus a search; use `/search` when a postcode's exact stored format is uncertain.
> - **Pagination**: page/pageSize with a hard cap of 50 per page, `range()`-based, returning `totalCount` (via Supabase's `count: 'exact'`) and `hasMore`. UI uses Previous/Next rather than infinite "load more" — both satisfy "pagination" without needing to accumulate result arrays across pages.
> - **"Today"/"upcoming" honesty**: driven exclusively by the structured `service_date` column, never by parsing `preferred_date`. A booking with no `service_date` is counted separately as `unscheduledCount` rather than guessed at or silently dropped.
> - **Root ESLint scope**: `admin/` was added to the root `eslint.config.js` ignore list during Phase 2 — a dev-tooling-only change (zero effect on the built public site) that fixes an inconsistency where the same admin file produced different lint results depending on which of the two independent configs ran against it.

---

## 1. Executive recommendation

Build a **separate admin application in the same repository**, deployed as its own Vercel project on **`admin.vveclean.co.uk`**, using **Supabase Auth** (email/password, no public sign-up) for login and a small set of **server-only admin API routes** that hold the `SUPABASE_SERVICE_ROLE_KEY`. The admin app never ships to the public site's bundle, never touches `AppRoutes.tsx` / `App.tsx` / `vite.config.ts` / the prerender pipeline, and the public site's Stripe/webhook/email/Telegram/Sheets flow is not modified.

Version one is: secure login → dashboard home → global search → filterable booking list → booking detail with click-to-call/WhatsApp/email → append-only internal notes → a new operational **booking status** field kept separate from the existing `payment_status`. No `customers` table in v1 — repeat-customer detection is done via search-time grouping on normalized phone/email, which is backward-compatible and carries zero migration risk.

Two real data gaps were found during inspection (not guessed — confirmed by reading the code) that materially affect scope and require a business decision before implementation: **(a)** the quoted total price is not stored in the `bookings` table at all today (only in Stripe metadata), which breaks "sort by highest value" as specified; **(b)** `preferred_date`/`preferred_time` are free-text, not real date/time columns, which breaks reliable "today's bookings" / date sorting. See §5, §26 and §35.

---

## 2. Existing repository assessment

- **Stack**: React 18 + TypeScript + Vite 5, `react-router-dom` v7, Tailwind CSS. The app is **prerendered/SSR** for SEO: `src/entry-server.tsx` + `prerender.mjs` generate `dist/server` and static HTML during `npm run build`. This makes the public app's build pipeline fragile to touch — any new route added to `AppRoutes.tsx` gets prerendered too, and the marketing site was just deliberately tuned for conversion (recent commits: "conversion design improvements", "booking funnel, trust signals, section order"). This is a strong argument against bolting `/admin` onto the same Vite app.
- **Deployment**: Vercel. `vercel.json` only contains a SPA rewrite (`/(.*) → /index.html`); `/api/*.js` files are auto-detected by Vercel as serverless functions (no `functions` block needed).
- **Backend**: No framework — each `/api/*.js` file is a hand-written Vercel serverless function using raw `req`/`res`, manual CORS, manual body parsing (`bodyParser: false`), and `stripe`, `@supabase/supabase-js`, `nodemailer` as the only server-side integrations.
- **No existing admin surface of any kind.** Repo-wide search for `admin`, `supabase.auth`, `onAuthStateChange`, `@supabase/ssr` returned nothing except an unrelated one-off script filename. There is no auth, no protected route, no role concept anywhere in the codebase today. This is a green-field addition.
- `src/lib/supabase.ts` is the only Supabase client in the app; it uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only (safe, public-key), and is used solely by public pages (quote/contact forms, presumably).
- `.env` is correctly gitignored. No secrets are committed to the repo.

---

## 3. Existing Supabase schema

Read directly from `supabase/migrations/*.sql` (7 files, `20260603` → `20260714`). Nothing below is guessed.

### `bookings`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`, not auto-updated by a trigger — only set explicitly in the webhook's upsert |
| `booking_ref` | text, UNIQUE | human reference, `POSTCODE+DDMMYY` (e.g. `N15NJ180726`), with `-1`, `-2` suffix appended on collision |
| `stripe_session_id` | text, UNIQUE | Stripe Checkout Session id |
| `stripe_payment_intent_id` | text | set by the webhook after payment |
| `payment_status` | text, NOT NULL, default `'pending_payment'` | free-text, not an enum. Values actually written by the code: `'pending_payment'`, `'paid'` |
| `deposit_amount` | numeric, default `30` | always £30 today (hardcoded deposit) |
| `full_name` | text | |
| `email` | text | |
| `phone` | text | free-text, whatever the customer typed |
| `address` | text | |
| `postcode` | text | free-text, whatever the customer typed |
| `service` | text | e.g. `end_of_tenancy`, `window`, `gutter`, `office`, `deep` |
| `preferred_date` | **text**, not `date` | raw string from the booking form — see §5 |
| `preferred_time` | **text**, not `time` | raw string |
| `notes` | text | customer's free-text message; this is also where "parking/access info" ends up — see §5 |
| `confirmation_token` | text, UNIQUE, indexed | 64-char hex, 256-bit random token generated server-side at checkout; required (with `booking_ref`) to look up a booking from the public confirmation page. **Never expose this in the admin UI's outbound links/URLs.** |
| `email_customer_sent`, `email_business_sent`, `telegram_sent`, `sheets_sent` | boolean, default `false` | notification delivery tracking, written by the webhook |
| `offer_code`, `discount_percent`, `standard_total`, `discount_amount`, `final_total_after_discount` | text/numeric | attribution/offer columns — only populated when `last_source` or `offer_code` is present (mainly the leaflet funnel) |
| `first_source`, `last_source`, `landing_page`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid` | text | marketing attribution, written best-effort |

RLS: enabled. Policy `authenticated_read_bookings` — `SELECT` for role `authenticated`, `USING (true)`. **No INSERT/UPDATE/DELETE policy exists for `authenticated`** — all writes today come exclusively from the service-role key (which bypasses RLS), used only inside `/api/*.js`.

### `processed_stripe_events`
Internal Stripe-webhook idempotency/state-machine table: `event_id` (PK), `event_type`, `processed_at`, `status` (`processing`/`completed`/`failed`), `claimed_at`, `completed_at`, `error_detail`. RLS explicitly denies `anon` all access. This is a technical/operational table, not customer data — out of scope for the CRM UI in v1 (could become a future "system health" panel).

### `quote_requests` (pre-booking quote capture, separate from `bookings`)
`id`, `name`, `email`, `phone`, `postcode`, `service_type`, `property_type`, `bedrooms`, `frequency`, `estimated_price`, `created_at`. RLS: `anon` can INSERT, `authenticated` can SELECT. **Not part of the booking/customer CRM** — these are quote-calculator submissions that may never convert into a paid booking. Out of scope for v1 search, could become a future "leads" view. Note: two migrations define this table with a slightly different `bedrooms` type (`int` vs `text`) both using `CREATE TABLE IF NOT EXISTS` — the live column type should be verified directly against Supabase before anything touches this table (not needed for this project).

### `contact_messages`
`id`, `name`, `email`, `phone`, `message`, `created_at`. Same RLS pattern as `quote_requests`. Not part of the CRM.

### No `customers` table, no `admin_users` table, no `internal_notes` table, no booking `status` column exist today.

---

## 4. Existing booking data available

Everything the spec asked to inventory, mapped to what actually exists:

| Requested field | Exists today as |
|---|---|
| Customer name | `bookings.full_name` |
| Phone | `bookings.phone` (free-text) |
| Email | `bookings.email` |
| Postcode | `bookings.postcode` (free-text) |
| Address | `bookings.address` |
| Booking reference | `bookings.booking_ref` (human, `POSTCODE+DDMMYY`) |
| Internal UUID | `bookings.id` |
| Stripe identifiers | `bookings.stripe_session_id`, `bookings.stripe_payment_intent_id` |
| Total price | **Not stored** — see §5 |
| Deposit | `bookings.deposit_amount` (always 30) |
| Balance | Not stored (derivable as total − deposit once total is known) |
| Payment status | `bookings.payment_status` (`pending_payment` / `paid` only) |
| Booking date/time | `bookings.preferred_date` / `preferred_time` — **free text**, see §5 |
| Services | `bookings.service` |
| Quote configuration (itemised: size, add-ons, carpet counts, etc.) | **Not stored** — computed server-side at checkout time from a `quoteConfig` object sent by the browser (`api/servicePrices.js`), used only to validate price, then discarded. Only the final `service` string and price (in Stripe metadata, not DB) survive. |
| Customer notes | `bookings.notes` |
| Parking/access information | **No dedicated field** — folded into `bookings.notes` (the booking form's placeholder literally says "Access notes, number of rooms, pets, parking, anything we should know…") |
| Attribution/source | `first_source`, `last_source`, `landing_page`, `utm_*`, `gclid` |
| Leaflet information | `offer_code` (`LEAFLET20`), `discount_percent`, `standard_total`, `discount_amount`, `final_total_after_discount` |
| Google Ads information | `utm_source`/`gclid` columns; separately, `api/verify-payment.js` exists purely to gate Ads conversion tracking — read-only, do not touch |
| `created_at` / `updated_at` | Present |
| Confirmation token | `bookings.confirmation_token` — **secure, must stay server-side/admin-only, never rendered as a clickable customer-facing link outside the existing confirmation flow** |

---

## 5. Missing data and limitations

These are real gaps confirmed by reading the code, not assumptions:

1. **No stored total price.** `create-checkout-session.js` computes `validatedPrice` server-side and puts it only in Stripe Checkout metadata (`metadata.price`). The Supabase insert/upsert in both `create-checkout-session.js` and `stripe-webhook.js` never writes a price/total column — because no such column exists. The only place the number lives durably is Stripe. This means: **"sort bookings by highest value" cannot be done efficiently in SQL today** without either (a) a stored, queryable column, or (b) fetching every row's price from Stripe per page view (slow, rate-limited, not viable for a list/sort). See §35 for the business decision this forces.
2. **`preferred_date`/`preferred_time` are free-text**, populated from whatever the booking form sent (`date`, `time` fields — themselves plain strings from a date/time picker, format not enforced at the DB layer). "Today's bookings" and "sort by service date" need a real `date` type to be reliable. Some rows may have inconsistent or empty values.
3. **No structured parking/access field** — it's whatever the customer typed into the general notes box, mixed in with "number of rooms, pets," etc. The dashboard will display it as free text; no clean separate widget is possible without a form change on the public site (explicitly out of scope).
4. **No itemised quote breakdown is stored.** The booking detail page can show `service` (a category, e.g. `end_of_tenancy`) but not the itemised configuration (bedrooms, add-ons, carpet items) that produced the price — that data is thrown away after checkout. If this is wanted later, it requires an additive JSON column and a small, low-risk change to what `create-checkout-session.js` writes (flagged as a future business decision, not required for v1).
5. **No booking status field** beyond `payment_status` (which only ever holds `pending_payment` or `paid`). The status vocabulary requested (`New`, `Confirmed`, `Scheduled`, `Completed`, `Cancelled`, etc.) does not exist and needs a new column (§21, §24).
6. **No customer identity concept.** Nothing links two bookings from the same person beyond matching `phone`/`email`/`postcode` text, which will have formatting variance (see §17).
7. **No admin/staff identity concept.** Nothing to attribute an internal note or a status change to a specific person — needed for §20's "who added the note" requirement.
8. **Phone and postcode are unvalidated free text** — expect a mix of `07123 456789`, `07123456789`, `+447123456789`, lowercase postcodes, missing spaces, etc. Search must normalize at query time (§17); the stored data itself will not be cleaned up as part of this project.

---

## 6. Recommended architecture

**A new, independent app living in this repo at `admin/`, deployed as its own Vercel project to `admin.vveclean.co.uk`.**

> **Approved correction**: because this app lives on its own subdomain, its internal routes are root-relative — `/login`, not `/admin/login` — and its server routes are `/api/*`, not `/admin/api/*` (§13, §25). The `admin/` name below refers only to the repository directory holding the app's source code, never to a URL path.

Concretely:
- New top-level directory, e.g. `admin/`, with its own `package.json`, `vite.config.ts`, `tsconfig.json`, `src/`, and its own `admin/api/` folder for admin-only serverless functions.
- New Vercel project pointed at this repo with **Root Directory = `admin/`** (Vercel supports multiple projects against one GitHub repo natively — no monorepo tooling needed).
- New DNS record: `admin.vveclean.co.uk` → the new Vercel project. (Requires DNS/registrar access — flagged in §35 as a business decision/access dependency.)
- Same Supabase project as the public site (no new project, no data migration) — the admin app gets its own `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (same values, configured independently on its own Vercel project) plus its own `SUPABASE_SERVICE_ROLE_KEY` env var, set **only** on the admin Vercel project, never on the public site's project.
- Optionally, a small shared `shared/types/booking.ts` file (just TypeScript interfaces, no runtime code) can be imported by both apps later if useful — not required for v1.

This was evaluated against all four options the brief asked to compare — see §7.

---

## 7. Why the selected architecture is safest

| Criterion | `/admin` inside current Vite app | Separate app, same repo (chosen) | Separate repo | Subdomain only (no app change) |
|---|---|---|---|---|
| Security isolation | Weak — one bundle, one build, admin code physically ships alongside public code even if route-guarded | **Strong** — separate bundle, separate deploy, separate env vars, admin JS never touches the public site's output | Strong, but adds process overhead for no extra safety over the chosen option | N/A, doesn't solve isolation |
| Risk to customer site | High — any admin change is a change to the file that also builds the public SSR/prerendered site; a bad import can break the marketing bundle | **None** — completely separate build pipeline, separate `vercel.json`, separate deploy | None | N/A |
| Deploy complexity | Low today, but couples two very different release cadences (marketing tweaks vs admin features) forever | **Low-medium** — one more Vercel project, one more DNS record; both are one-time setup costs | Medium-high — two GitHub repos, two CI setups, harder to keep booking types in sync | Low, but doesn't actually separate anything |
| Shared types | Easy (same tree) but tempts import coupling into public bundle | Easy — optional shared folder, purely type-level, zero runtime coupling | Hard — needs a published package or copy-paste | N/A |
| Maintenance | Simple short-term, risky long-term (one app doing two jobs) | Two simple apps, each single-purpose | Two repos to keep in sync | N/A |
| Supabase integration | Same project either way — no difference | Same project; service-role key isolated to the admin project's env only | Same | Same |
| Cost | Free (same project) | Free/marginal (Vercel supports multiple projects on the same plan) | Free but more overhead | Free |
| Mobile/PWA | Fights the SSR/prerender pipeline if a PWA manifest/service worker is added later | Independent — can add PWA features to the admin app without touching the public site | Independent | N/A |
| Future staff access | Same as chosen, no advantage | Scales cleanly — subdomain + Supabase Auth + `admin_users` table | Same | N/A |

The separate-app-same-repo option is the one point on the spectrum that satisfies "strong security, low risk to the live site" without the coordination overhead of a second repository. It is the recommended architecture.

---

## 8. Authentication design

- **Supabase Auth**, email + password provider only. No magic links, no OAuth, no public sign-up (disable sign-ups in Supabase Auth settings, or simply never expose a sign-up UI and rely on admin users being created manually in the Supabase dashboard / via a one-off `supabase.auth.admin.createUser` script run by the developer).
- Admin app's Supabase client (`admin/src/lib/supabase.ts`) uses the anon key only (safe for the browser) — Auth itself (login, session refresh, password reset) works entirely through the anon key + Supabase's public Auth API, exactly as designed.
- **Session persistence**: default Supabase JS behavior (stored in `localStorage`, auto-refreshed). Acceptable for a private, bookmarked, low-user-count internal tool; revisit only if compliance requirements emerge.
- **Password reset**: Supabase's built-in `resetPasswordForEmail` + a single `/reset-password` route that handles both the request form (enter email) and, when arrived at via a Supabase recovery link, the completion form (`updateUser({ password })`) — state-driven off the Supabase auth event, not two separate routes. No custom email infrastructure needed (reuses Supabase's transactional email, not the site's Gmail/nodemailer setup, which stays untouched).
- **Logout**: `supabase.auth.signOut()`, redirect to `/login`, clear any client-side cached admin data (profile, session) from memory.
- **No hard-coded owner account**: launch supports exactly one admin account operationally, but no email address or user UUID is ever hard-coded anywhere in the app or migrations. The first (and any future) admin is created manually in the Supabase dashboard and linked via the `admin_users` table — see `admin/SETUP.md`. Public sign-up is disabled in Supabase Auth settings, and no sign-up UI exists in the app.
- **Route protection**: a top-level `<RequireAuth>` wrapper checks `supabase.auth.getSession()` (and subscribes to `onAuthStateChange`) before rendering any child route. While the session is being resolved, render a loading state — **no booking data component mounts, and no data-fetching call fires, until a session is confirmed present.** This directly satisfies "No customer data rendered before authentication is confirmed."
- **Session expiry**: rely on Supabase's default JWT expiry (1 hour access token, silent refresh via refresh token) — if refresh fails (e.g., revoked/stale), `RequireAuth` redirects to login.
- **Login rate limiting**: Supabase Auth has built-in rate limiting on the login endpoint; additionally, keep the login form free of any client-side hints about *why* a login failed (generic "invalid email or password" message) to avoid user enumeration.

---

## 9. Authorisation and admin-role design

Supabase's `auth.users` table has no built-in "role" concept usable for app-level authorization out of the box. Recommendation: a small **`admin_users`** table (see §24) that is the single source of truth for "is this authenticated person allowed to use the dashboard."

- `admin_users(id uuid primary key references auth.users(id) on delete cascade, display_name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`. **Email is deliberately not stored here** — `auth.users` remains the single source of truth for account email; `admin_users` only proves authorization, keeping the two concerns (identity vs. permission) cleanly separated and avoiding a copy of the email that could drift out of sync.
- Every admin-only server route re-validates: (1) the caller's Supabase JWT is valid, (2) `auth.uid()` exists in `admin_users`. A logged-in Supabase Auth user who is **not** in `admin_users` gets a 403 from every admin API route and is signed out client-side — this covers the case where a Supabase Auth account exists (e.g., created by mistake, or a future customer-auth feature reuses the same `auth.users` table) but was never granted admin access.
- This table is also what makes §20 ("show who added the note") possible, and is the natural place to later add a `role` column (`owner`, `staff`, `readonly`) for future role-based permissions without any breaking change.

---

## 10. Row Level Security design

Guiding principle: **the browser never talks to Postgres directly for anything except Supabase Auth itself.** All booking reads/writes go through the admin app's own server-side API routes, which hold the service-role key. This sidesteps the need for complex, easy-to-get-wrong RLS write policies entirely, and matches the existing pattern already used by the public site's `/api/*.js` functions.

- **`bookings`**: RLS stays enabled. The existing `authenticated_read_bookings` policy (`SELECT ... USING (true)`) is **removed outright, with no replacement direct-read policy** — confirmed safe by inspecting every current Supabase client usage in the repo: the only Supabase client that ever runs in a browser context (`src/lib/supabase.ts`, anon key) is not imported by anything that queries `bookings`, and all six places that do query `bookings` (`api/stripe-webhook.js`, `api/verify-payment.js`, `api/confirmation-details.js`, `api/create-checkout-session.js`, `api/backfill-paid-booking.js`, `scripts/backfill-N15NJ310726.mjs`) use the service-role key, which bypasses RLS entirely and is unaffected by this policy's removal. After removal, both `anon` and `authenticated` have zero read access to `bookings` — every future admin read or write goes through server-only `/api/*` routes (§25) using the service-role key, never a direct browser Supabase query. No INSERT/UPDATE/DELETE policy for `authenticated` is added either — writes only ever happen via service-role, exactly as today.
- **`admin_users`**: RLS enabled, no `anon`/`authenticated` access at all — only `service_role` reads it (from the admin API's server-side role check).
- **`internal_notes`** (new, §24): RLS enabled, no direct `anon`/`authenticated` access — all reads/writes go through the admin API using service-role, which independently re-checks `admin_users` membership before touching the table. This is what makes notes safely "never visible to customers" — there is no policy path that would let a public/customer-facing Supabase client ever read this table, even by accident.
- **`processed_stripe_events`**: untouched.

This is defense-in-depth on top of the primary control (the admin API's own auth check) — even if a bug in the API route logic were to leak the anon key's ability to query `bookings` directly from the browser, RLS still blocks anything the logged-in user isn't authorized for.

---

## 11. Version-one features

1. Secure login (Supabase Auth, admin-only, protected routes, no data before auth resolves).
2. Dashboard home: today's bookings, upcoming bookings, recently created bookings, deposits paid, outstanding balances (best-effort, given §5's price gap), quick search box.
3. Global search across name, phone, email, postcode, address, booking reference, internal UUID — normalized (§17).
4. Booking list with filters (date, booking status, payment status, service, source, postcode) and sorting (newest, oldest, service date; "highest value" flagged as a §35 business decision).
5. Booking detail page: all fields from §4, click-to-call/WhatsApp/email, copy address, copy reference.
6. Internal notes: append-only, timestamped, attributed to the admin who wrote them, never customer-visible.
7. New operational booking-status field (§21), kept separate from `payment_status` (§22). No automatic Stripe refunds or payment changes triggered by a status change.

---

## 12. Features excluded from version one

Customer profiles/lifetime value, a `customers` table, rescheduling workflow, cancellation-history tracking, a calendar view, a daily job route planner, before/after photos, invoice links, multiple staff accounts with distinct roles, per-role permissions, a full audit log, CSV export, installable PWA, offline job info, SMS reminders, automated follow-ups, review requests, a settings page. All of these are designed *around* (additive schema, no path that blocks them later) but none are built now.

---

## 13. Proposed routes and navigation

| Route | Purpose | v1? |
|---|---|---|
| `/login` | Email/password login | Yes |
| `/reset-password` | Password-reset request and completion — one route, state-driven off the Supabase auth event (§8) | Yes |
| `/` | Dashboard home | Yes |
| `/bookings` | Filterable, sortable booking list | Yes |
| `/bookings/:id` | Booking detail (by internal UUID) | Yes |
| `/search` | Global search results (also reachable via the search box on `/` and `/bookings`) | Yes |
| `/customers` | Would require a `customers` table | No — future |
| `/settings` | No concrete v1 need identified (admin users managed directly in Supabase for now) | No |

These are root-relative, **not** prefixed with `/admin` — the app already lives on its own subdomain (`admin.vveclean.co.uk`), so `/admin/login` there would be redundant. Server-side admin API routes follow the same logic: `/api/*`, not `/admin/api/*` (§25).

Navigation: persistent header with the search box (desktop) or a dedicated search tab (mobile, see §14); bottom tab bar on mobile with Home / Bookings / Search / (future: Customers).

---

## 14. Mobile UX design

Designed for one-handed use at 360px–390px width first, tablet/desktop as progressive enhancement.

- **Bottom navigation bar** (fixed, safe-area aware): Home, Bookings, Search — 3 large tap targets, ≥48×48px, icon + label.
- **Large touch targets** throughout: booking cards, filter chips, and action buttons sized for thumb use, minimum 44px tap height.
- **Sticky primary actions** on the booking detail page: a bottom action bar with Call / WhatsApp / Email stays pinned while the rest of the page scrolls, so the most common actions never require scrolling back up.
- **Compact booking cards** in lists (name, postcode, date, status badges, price if known) that expand in place or navigate to the detail page — no wide desktop-style tables on mobile.
- **Copy actions** (address, booking reference) show an inline "Copied" toast rather than navigating away.
- **Status badges** use color + short text (never color alone) for payment/booking status, legible at small sizes.
- Search input is always one tap away (bottom nav) and supports voice-friendly plain-text queries (no special syntax required).

---

## 15. Desktop UX design

- Left-hand persistent nav (Home / Bookings / Search) instead of bottom tabs.
- Booking list becomes a denser table view with inline filters in a toolbar row, but the same underlying components as mobile (progressive enhancement, not a separate codebase) — table rows are just a wider rendering of the same booking-card data.
- Booking detail page becomes a two-column layout: customer/contact/action panel on the left (sticky), booking/payment/notes detail on the right.
- No functionality is desktop-only; everything on desktop must also work on mobile, per the brief.

---

## 16. Search design

A single server-side endpoint, e.g. `POST /api/search { q }`, backing both the dashboard's quick-search box and `/search`. It:

1. Validates the caller is an authenticated admin (§9).
2. Normalizes the raw query (§17).
3. Calls a single Postgres function, `search_bookings(q text)` (`SECURITY DEFINER`, owned by a role with table access, `EXECUTE` granted only to `service_role`), that runs one query combining:
   - `id::text = q` (exact UUID match)
   - `booking_ref ILIKE '%' || q || '%'`
   - `full_name ILIKE '%' || q || '%'`
   - `address ILIKE '%' || q || '%'`
   - normalized-phone comparison (§17) against a normalized version of `q`
   - normalized-postcode comparison (§17) against a normalized version of `q`
   - `email ILIKE '%' || q || '%'`
4. Returns a capped, ranked result set (e.g. LIMIT 50) with just the fields needed for the result list (§4's "Global search" columns) — never the full row, never the confirmation token.

Rationale for a single SQL function rather than scattering `.or()` filters across the codebase: it keeps the matching logic in one place, is easy to `EXPLAIN`/index, and is the natural spot to extend later (e.g., searching `internal_notes` content, or a future `customers` table) without touching every caller. Backed by a `pg_trgm` GIN index (§24) on `full_name`, `address`, `postcode`, `booking_ref` for partial-match performance; exact/prefix matches on `phone`/`email` don't need trigram indexing at this data volume.

---

## 17. Phone and postcode normalisation

Applied at **query time**, not by rewriting stored data (stored data stays untouched — zero risk to the existing webhook/checkout write paths):

- **Phone**: strip everything except digits and a leading `+`. If the result starts with `0`, treat it as UK and compare against both the `0`-prefixed and `+44`-prefixed forms (`0` → `+44` by dropping the leading `0`). Compare the normalized query against `regexp_replace(phone, '[^0-9+]', '', 'g')` computed on the stored value at query time, with the same `0`/`+44` equivalence applied to both sides. Assumption: UK numbers only, per the business — flagged in §35 to confirm.
- **Postcode**: uppercase and strip all whitespace on both the query and the stored value (`upper(regexp_replace(postcode, '\s', '', 'g'))`), then match with `ILIKE '%normalized_q%'` so partial postcodes (e.g. just the outward code `N15`) still work.
- **Name/address**: case-insensitive partial match (`ILIKE`), no other normalization — free text is too varied to safely canonicalize.
- **Booking reference**: case-insensitive partial/prefix match; the reference is already normalized at creation time (`postcode.replace(/\s+/g,'').toUpperCase()` + `DDMMYY`), so stored values are already clean.

This is all done inside the `search_bookings` SQL function (§16) so the normalization rules live in exactly one place.

---

## 18. Booking list and filters

Filters: date (range or single day), booking status (§21), payment status (§22), service, source (`last_source`/`offer_code`), postcode. Sorting: newest/oldest (`created_at`), service date (`preferred_date` — see §5 caveat on reliability), highest value (**blocked by §5's missing price column** — see §35).

Server-side pagination (cursor or offset on `created_at`), never loading the full table into the browser. Filters compose as SQL `WHERE` clauses in a dedicated `list_bookings(...)` server route (not a raw client-side Supabase query, for the same reason as §10/§16 — keep all booking access server-side and auditable in one place).

---

## 19. Booking detail structure

Everything inventoried in §4, organized as:

- **Header**: human booking reference (large, copyable), status badges (booking status + payment status), internal UUID (small, secondary, copyable).
- **Customer panel**: name, phone (click-to-call), email (click-to-email), full address + postcode (copyable), with a WhatsApp button built from the phone number (`https://wa.me/<digits>`, using the same normalization as §17 to strip formatting before building the link).
- **Booking panel**: service, requested date/time (as stored — flagged as free text), total/deposit/balance (deposit is reliable; total/balance depend on §35's decision), payment status, relevant Stripe identifiers (session id, payment intent id — shown as read-only reference text, not linked anywhere that could leak them client-side beyond this authenticated page).
- **Notes panel**: customer notes (read-only, from `notes`) and internal admin notes (§20).
- **Attribution panel**: source, UTM fields, leaflet/offer info — collapsed/secondary, since it's operationally less urgent than contact/payment info.
- **Timestamps**: created/updated, shown small.
- **Action bar**: Call, WhatsApp, Email, Copy address, Copy reference — sticky on mobile (§14).

---

## 20. Internal-notes design

New `internal_notes` table (§24): `id`, `booking_id` (FK → `bookings.id`), `author_admin_id` (FK → `admin_users.id`), `note` (text), `created_at`. **Append-only in v1**: the API exposes create + list, no update/delete endpoint. Displayed newest-first under the booking's Notes panel, each entry showing the author's display name and a relative timestamp. Never queried or exposed by any public-facing route — the table has no RLS path reachable by `anon` or a non-admin `authenticated` user (§10), and no existing public API touches it. Designed so that a future "edit within N minutes" or multi-admin @mention feature could be added additively without a breaking schema change.

---

## 21. Booking-status model

New, free-standing **operational** status — separate from both the existing `payment_status` (§22, Stripe-driven) and the future `balance_status` (§22, post-service balance tracking). Approved enum (as a `CHECK` constraint on a `text` column, not a Postgres `ENUM` type, so future values can be added with a simple constraint migration rather than an enum-alter):

`new → confirmed → scheduled → in_progress → completed`, with side branches `rescheduled`, `cancelled`, `no_show` reachable from most states.

`deposit_paid`, `refunded`, and `payment_issue` are **deliberately excluded** from this vocabulary — they describe payment/balance state, not job state, and belong to `payment_status` or the future `balance_status` instead. Keeping these two axes strictly separate matters in practice: a `completed` job can still have an `outstanding` balance, and a `cancelled` job can already be `refunded` — conflating them into one status field would make either state unrepresentable at the same time.

Default: `'new'` for all existing and future rows (backward-compatible, additive column — created only when the §24 migration for this column is scheduled; not part of Phase 1). **No automatic transitions are wired to Stripe** — the webhook is not changed to set this field; an admin manually advances status from the dashboard. This satisfies "Do not automatically refund Stripe or alter payments when an admin changes a status."

---

## 22. Payment-status model

Kept exactly as it exists today (`pending_payment` / `paid`, free-text column) — **not modified**, since it's written by the live Stripe webhook and checkout session code, which is explicitly off-limits. The admin dashboard treats it as read-only display data (with color-coded badges) and never lets an admin edit it directly — any real payment change happens in Stripe, and (in a future phase, not v1) could be reconciled back via a read path, never a write path, from the admin app.

### Future: balance-status model (approved for a later migration — not built in Phase 1)

`payment_status` only ever describes the £30 deposit on the Stripe Checkout session. It says nothing about the **remaining balance**, which today is collected manually (cash/card on the day) and tracked nowhere. A third, independent field — `balance_status` — is approved for a later controlled migration (§24) to close that gap:

`not_due → outstanding → paid`, with `waived` as a side branch.

This is a third axis, independent of both operational `status` (§21) and Stripe-driven `payment_status`: a booking can be `completed` (status), `paid` (payment_status, deposit only), and still `outstanding` (balance_status) until the on-the-day payment is recorded. `balance_paid_at` and `balance_payment_method` (§24) accompany it to record when and how the balance was settled. None of `balance_status`, `balance_paid_at`, or `balance_payment_method` are created in Phase 1.

---

## 23. Customer-table recommendation

**Recommendation: Option A for v1** — continue treating each booking as a self-contained record; do **not** introduce a `customers` table yet.

Reasoning against the checklist in the brief:
- **Duplicate customers / phone-email changes**: with only free-text `phone`/`email`/`postcode` to match on today, any automatic customer-merging logic built now would be guessing at match confidence with no real usage data to validate it against — safer to defer until there's a working search/list feature to observe actual repeat-customer patterns.
- **Repeat bookings** are still fully answerable in v1 without a `customers` table: search by normalized phone/email/postcode (§17) and show "X other bookings from this contact" on the detail page as a query, not a stored relationship.
- **Migration risk**: zero for Option A — no schema change beyond additive columns.
- **Webhook compatibility**: zero risk — the webhook keeps writing exactly what it writes today.
- **Search performance**: fine at this data volume with `pg_trgm` indexes on `bookings` directly; a `customers` table wouldn't materially speed up search until data volume is much larger.
- **Future CLV**: not blocked — when a `customers` table is introduced later, it can be added as a new table with a **nullable** `bookings.customer_id` column, backfilled by a script (not a webhook change), and the webhook can optionally be updated *at that time* to populate it going forward. That is the natural Option B migration path, deferred to phase 2 (§33) once real search/list usage validates the matching heuristics.

---

## 24. Recommended database changes

All additive, nullable-or-defaulted, and reversible (§30). None require changing `stripe-webhook.js`, `create-checkout-session.js`, `confirmation-details.js`, or `verify-payment.js`, **except** the one flagged item under "deferred."

1. **`admin_users`** (new table — **created in Phase 1**) — `id uuid primary key references auth.users(id) on delete cascade`, `display_name text not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Email is deliberately not duplicated here — `auth.users` remains the source of truth for it (§9). RLS enabled, no `anon`/`authenticated` access. The migration creates the table only — it cannot also insert the first admin row, because that person's `auth.users` UUID doesn't exist until they're created manually in Supabase Auth; see `admin/SETUP.md` for the exact manual insert step.
2. **`internal_notes`** (new table — Phase 3) — `id uuid PK default gen_random_uuid()`, `booking_id uuid references bookings(id)`, `author_admin_id uuid references admin_users(id)`, `note text not null`, `created_at timestamptz default now()`. RLS enabled, no `anon`/`authenticated` access. Index on `booking_id`.
3. **`bookings.status`** (new column — Phase 2) — `text not null default 'new'`, `CHECK (status IN ('new','confirmed','scheduled','in_progress','completed','rescheduled','cancelled','no_show'))` (§21). Additive, defaulted — safe for every existing row.
4. **Remove `bookings`' `authenticated_read_bookings` RLS policy outright — created in Phase 1**, with **no replacement direct-read policy** (§10). Confirmed safe by inspecting every current Supabase client usage in the repo — nothing queries `bookings` from a browser context, and every server-side query already uses the service-role key, which bypasses RLS and is unaffected. All future admin reads/writes go through server-only `/api/*` routes (§25).
5. **`pg_trgm` extension + GIN indexes** on `bookings.full_name`, `bookings.address`, `bookings.postcode`, `bookings.booking_ref` for partial-match search performance (§16) — Phase 2. Standard Supabase-available extension, no data change.
6. **`search_bookings(q text)` SQL function** (§16) — Phase 2, pure function, no table change.
7. **Approved for a later controlled migration — not created in Phase 1** (resolved by this review, see §35):
   - `bookings.total_price numeric` (nullable) — closes the §5 pricing gap. Populated going forward by one additional line in `stripe-webhook.js`'s existing upsert (writing `meta.price`) — the *only* approved schema change that would touch the protected webhook file, scheduled as its own separately-approved migration, not part of Phase 1 or Phase 2.
   - `bookings.quote_config jsonb` (nullable) — stores the itemised `quoteConfig` object (§5) that's currently computed and discarded at checkout, so the detail page can eventually show *what* was quoted, not just the service category. Also requires a small, separately-approved addition to the checkout/webhook write path.
   - `bookings.service_date date` (nullable) — a normalized, queryable counterpart to the free-text `preferred_date` (§5). Populated by a one-off, read-only backfill script (no webhook change required) plus admin confirmation going forward.
   - `bookings.balance_status text` (nullable), `CHECK (balance_status IN ('not_due','outstanding','paid','waived'))` — see §22.
   - `bookings.balance_paid_at timestamptz` (nullable) — see §22.
   - `bookings.balance_payment_method text` (nullable) — see §22.

   Every field in this group is additive and nullable, so none of them put existing rows or the protected write paths at risk until each is explicitly scheduled and approved as its own migration.

---

## 25. Proposed API/server functions

All live under the admin app's own `admin/api/` directory (a separate serverless function set from the public site's `/api/`) and are addressed as `/api/*` on `admin.vveclean.co.uk` — **not** `/admin/api/*`, since the app already has its own subdomain (§13). Each route re-validates the Supabase session and `admin_users` membership server-side before doing anything:

| Route | Method | Purpose | Phase |
|---|---|---|---|
| `/api/me` | GET | Verify session + admin authorization, return safe profile only | 1 — built in this task |
| `/api/search` | POST | Global search (§16) | 2 |
| `/api/bookings` | GET | Filtered/sorted/paginated list (§18) | 2 |
| `/api/bookings/:id` | GET | Booking detail (§19) | 2 |
| `/api/bookings/:id/status` | PATCH | Update `status` only (§21) — never touches `payment_status` | 2 |
| `/api/bookings/:id/notes` | GET, POST | List/append internal notes (§20) | 3 |
| `/api/dashboard-summary` | GET | Today's/upcoming/recent/outstanding counts for the home page | 2 |

None of these are added to the public site's `/api/` folder, and none of the six existing public routes are modified. `/api/me` is the only one of these built in Phase 1 — the rest remain server-route *design*, not code, until their phase.

---

## 26. Environment variables required

New, on the **admin app's own Vercel project only**:

- `VITE_SUPABASE_URL` — same value as the public site's, safe to expose (already public today).
- `VITE_SUPABASE_ANON_KEY` — same value as the public site's, safe to expose (already public today).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, configured independently on this project, never given a `VITE_` prefix, never referenced from any file under `admin/src/`.
- `STRIPE_SECRET_KEY` — only if §24 item 7 is deferred and the detail page does a live read-only Stripe lookup for total price; **read-only usage** (`sessions.retrieve`), never used to create charges/sessions from the admin app.
- Optionally `ADMIN_SITE_URL` — used only for Supabase password-reset redirect links, analogous to the public site's `SITE_URL` but never shared with it.

No Telegram/Gmail/Google Sheets/Stripe-webhook-secret variables are needed by the admin app — those integrations stay exclusively in the public site's `/api/`, untouched.

---

## 27. Deployment recommendation

New Vercel project, Root Directory `admin/`, custom domain `admin.vveclean.co.uk`. Recommended additional hardening (optional, low-cost): enable Vercel's built-in Deployment Protection (password or SSO gate in front of the whole admin project) as a second layer in front of Supabase Auth — "two doors," so even a Supabase Auth misconfiguration doesn't expose the login page itself to the open internet.

---

## 28. noindex and privacy protection

- `<meta name="robots" content="noindex, nofollow">` on every page in the admin app.
- `X-Robots-Tag: noindex, nofollow` response header set via the admin Vercel project's config, as defense-in-depth for any response a crawler might fetch without executing HTML (covers the meta tag being bypassed).
- `robots.txt` on `admin.vveclean.co.uk` disallowing everything.
- No link from any public-site page to the admin subdomain.
- Internal notes and confirmation tokens are never rendered in any response reachable without an authenticated admin session (§10).

---

## 29. Migration plan

1. Land schema changes from §24 (items 1–6) as new, timestamped Supabase migrations in `supabase/migrations/`, following the existing idempotent (`IF NOT EXISTS`) style already used in this repo. Each migration is additive-only — no `ALTER ... DROP`, no `ALTER ... NOT NULL` on an existing column, no renames.
2. Apply to a Supabase branch/staging environment first if available; otherwise apply directly since every change is additive and non-breaking to existing reads/writes (verified by inspection of every file that touches `bookings`).
3. Build and deploy the admin app to a Vercel preview URL first (no custom domain yet), validate login + search + list + detail + notes end-to-end against real (read-only, non-destructive) data.
4. Only then point `admin.vveclean.co.uk` at the project and go live.
5. §24 items 7–8 (deferred) are separate migrations, applied only after the §35 business decisions are made.

---

## 30. Rollback plan

- Every migration is additive — rollback is simply "don't deploy the admin app"; the public site is never touched, so there is nothing to roll back on that side.
- If a schema change needs to be undone: new columns/tables can be dropped independently of application code (`admin_users`, `internal_notes`, `bookings.status`, the RLS policy, the trigram indexes, the search function) — none of them are read by the public site's code, so dropping them has zero effect on the customer-facing flow.
- If the admin app itself needs to be pulled: delete/pause the Vercel project and/or DNS record — no shared deployment artifact with the public site exists, so this is a single, isolated action.

---

## 31. Testing plan

- **Auth**: login success/failure, logout, session expiry/refresh, password reset end-to-end, route guard blocks unauthenticated access to every protected route (including deep-linking directly to `/bookings/:id`).
- **Authorization**: a Supabase Auth account that exists but is *not* in `admin_users` is rejected by every API route (403), not just hidden in the UI.
- **Search**: exact/partial name, both phone formats (`07...`/`+44...`) with/without spaces, postcode with/without spaces and mixed case, partial address, partial and exact booking reference, exact UUID — each against seeded test rows.
- **List/filters**: each filter individually and combined; each sort option; pagination boundaries.
- **Detail page**: every field from §4 renders correctly including graceful empty states for the §5 gaps (e.g., "Total not recorded" rather than `£undefined`); click-to-call/WhatsApp/email links are correctly formatted; copy buttons work.
- **Notes**: append works, ordering is newest-first, author attribution correct, no update/delete UI exists.
- **Status**: every transition in §21's model, confirms `payment_status` is never modified by a status change.
- **RLS**: attempt direct anon-key queries against `bookings`, `admin_users`, `internal_notes` from a non-admin session and confirm they return nothing.
- **Regression on the public site**: run the existing booking flow (quote → checkout → webhook → confirmation) end-to-end after the schema migrations land, to positively confirm zero behavior change.

---

## 32. Security testing checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` does not appear in any `admin/src/**` file, any client bundle (`grep` the built `dist/` output), or any `VITE_`-prefixed variable.
- [ ] Every `admin/api/*` route rejects requests without a valid Supabase session.
- [ ] Every `admin/api/*` route rejects a valid session that isn't in `admin_users`.
- [ ] RLS denies `anon` and non-admin `authenticated` reads on `bookings`, `admin_users`, `internal_notes`.
- [ ] Confirmation tokens are never present in any admin API response or rendered URL.
- [ ] No admin route or asset is reachable without authentication, including static JS chunks that might reveal booking IDs via network tab (not a real risk here since IDs alone don't grant data access, but verify no data is pre-fetched before auth resolves).
- [ ] `noindex`/`X-Robots-Tag`/`robots.txt` all present and correct on the deployed admin domain.
- [ ] CORS on `admin/api/*` restricted to the admin domain only (mirroring the existing `ALLOWED_ORIGINS` pattern from the public site's API routes).
- [ ] Rate limiting/backoff behavior on repeated failed logins verified against Supabase Auth's defaults.
- [ ] Password reset flow cannot be used to enumerate valid admin emails (generic response either way).
- [ ] Full regression pass on the public booking/Stripe/webhook flow post-migration (§31's last item) — confirms zero change to protected systems.

---

## 33. Implementation phases

**Phase 0 — this document.** Planning and architecture only (current state).

**Phase 1 — foundation.** Scaffold the `admin/` app, Vercel project, Supabase Auth wiring, `admin_users` table + RLS, `RequireAuth` guard, login/logout/password-reset pages. No booking data yet.

**Phase 2 — core CRM v1.** `bookings.status` column + RLS tightening + `pg_trgm`/search function migrations; dashboard home; global search; booking list with filters/sort (minus "highest value" pending §35); booking detail page; click-to-call/WhatsApp/email/copy actions.

**Phase 3 — notes.** `internal_notes` table + API + UI, append-only, author-attributed.

**Phase 4 — polish & hardening.** Full security checklist (§32) pass, mobile UX pass on real devices at 360/390px, empty/loading/error states, `admin.vveclean.co.uk` cutover.

**Phase 5 (future, not this project) — deferred decisions from §35**, then `customers` table (§23 Option B), calendar view, photos, staff roles, CSV export, PWA, and the rest of §12.

---

## 34. Risks

- **Data-quality risk**: free-text `phone`/`postcode`/`preferred_date` mean search and date-based features will have edge cases no normalization rule fully covers — mitigated by normalizing at query time and treating unparseable dates as "unscheduled" rather than erroring.
- **Scope-creep risk**: the brief explicitly lists many future features; the phased plan (§33) and the "excluded from v1" list (§12) are the guardrail — resist pulling forward.
- **Two-app maintenance risk**: a second Vite app/Vercel project is a small ongoing overhead versus one app doing two jobs; judged worth it for the security isolation it buys (§7).
- **DNS/access dependency risk**: setting up `admin.vveclean.co.uk` requires DNS/registrar access, which may not be immediately available — the admin app can still be developed and tested on its default `*.vercel.app` preview URL (behind auth) in the meantime.
- **Silent price/date gaps risk**: if §35's decisions aren't made explicitly, "sort by highest value" and reliable "today's bookings" will ship as visibly degraded (not silently wrong) — the UI must clearly label these as best-effort/unavailable rather than showing misleading data.

---

## 35. Business decisions required

**Resolved by the Phase 1 review** (kept here for traceability — no longer open):
- ~~Total price column~~ — **approved** as a future, separately-scheduled migration, not built in Phase 1 or Phase 2 (§22, §24 item 7).
- ~~Service-date column~~ — **approved** as a future, separately-scheduled migration (§24 item 7).
- ~~Booking-status vocabulary~~ — **approved**: `new, confirmed, scheduled, in_progress, completed, rescheduled, cancelled, no_show`, with `deposit_paid`/`refunded`/`payment_issue` explicitly excluded from it (§21), plus a separate future `balance_status` (`not_due`/`outstanding`/`paid`/`waived`) (§22).
- ~~Direct-read RLS policy on `bookings`~~ — **approved to remove outright**, with no replacement policy (§10, §24 item 4).

**Still open**:
1. **Phone format assumption**: confirm all customer phone numbers are UK numbers (so the `0` ↔ `+44` normalization in §17 is correct) — flag if any non-UK numbers are expected. Not needed until search is built (Phase 2) — no action for Phase 1.
2. **DNS/subdomain access**: confirm who can create the `admin.vveclean.co.uk` DNS record and the new Vercel project, and roughly when. Phase 1 ships without connecting or deploying anything (§11/§27) — the app runs locally only until this is resolved.
3. **Initial admin users**: confirm how many people need login access at launch. `admin_users` supports multiple from day one; Phase 1 only documents the manual setup steps (`admin/SETUP.md`) for creating the first owner account — no account is created automatically or hard-coded.
4. **Deployment Protection**: approve or decline the optional Vercel-level password/SSO gate in front of the whole admin subdomain (§27) as a second layer beyond Supabase Auth — relevant once the project is actually deployed, not for Phase 1.

---

## 36. Exact recommended version-one scope

- Separate `admin/` app, own Vercel project, `admin.vveclean.co.uk`.
- Supabase Auth (email/password), no public sign-up, `admin_users` table gating all API access, protected routes, no data before auth resolves.
- New tables: `admin_users`, `internal_notes`. New column: `bookings.status` (operational status, separate from `payment_status` and the future `balance_status`). Broad `authenticated_read_bookings` RLS policy removed outright, no replacement. `pg_trgm` search indexes + one `search_bookings` SQL function.
- Pages: `/login`, `/reset-password`, `/` (home), `/bookings`, `/bookings/:id`, `/search` — root-relative, no `/admin` prefix (§13).
- **Phase 1 (this task) scope note**: only the application foundation, authentication, and authorization/security layer are built now — login, reset-password, protected-route shell, `admin_users`, the `bookings` RLS removal, and `/api/me`. Search, booking list/detail, internal notes, and status editing are Phase 2/3 as described throughout this document, not built yet.
- Global search across name/phone/email/postcode/address/booking-ref/UUID, normalized for UK phone formats and postcode spacing/case.
- Booking list: filter by date/status/payment-status/service/source/postcode; sort by newest/oldest/service-date (value-sort pending §35).
- Booking detail: full field set from §4, click-to-call/WhatsApp/email, copy address/reference, internal notes panel, status control.
- Append-only internal notes, author-attributed, never customer-visible.
- Mobile-first (360px+) with bottom nav, sticky actions, compact cards; desktop as progressive enhancement, not a separate build.
- Nothing from §12 is built in v1.
- No changes anywhere to the public site, Stripe, webhooks, email, Telegram, Google Sheets, the confirmation page, or attribution/Google Ads tracking.

---

## Text wireframes

### Login (`/login`)
```
┌──────────────────────────────┐
│           VVE CLEAN           │
│         Admin sign in         │
│                                │
│  Email                        │
│  ┌──────────────────────────┐ │
│  │                          │ │
│  └──────────────────────────┘ │
│  Password                     │
│  ┌──────────────────────────┐ │
│  │                          │ │
│  └──────────────────────────┘ │
│                                │
│  [        Sign in          ]  │
│                                │
│        Forgot password?       │
└──────────────────────────────┘
```

### Mobile dashboard home (`/`, 360–390px)
```
┌──────────────────────────────┐
│  VVE Admin            ⎋ log out│
├──────────────────────────────┤
│  🔍  Search customer…         │
├──────────────────────────────┤
│  TODAY (2)                    │
│  ┌──────────────────────────┐ │
│  │ J. Carter · N15 5NJ       │ │
│  │ End of tenancy · 10:00    │ │
│  │ [Confirmed]  [Paid]       │ │
│  └──────────────────────────┘ │
│  ┌──────────────────────────┐ │
│  │ A. Osei · E17 6QA         │ │
│  │ Window clean · 14:00      │ │
│  │ [New]  [Deposit paid]     │ │
│  └──────────────────────────┘ │
├──────────────────────────────┤
│  OUTSTANDING BALANCE (4)  →   │
│  UPCOMING THIS WEEK (7)   →   │
│  RECENTLY BOOKED (5)      →   │
├──────────────────────────────┤
│  🏠 Home   📋 Bookings  🔍 Search│
└──────────────────────────────┘
```

### Desktop dashboard home
```
┌───────────┬──────────────────────────────────────────────────┐
│ VVE Admin │  🔍 Search customer, phone, postcode, reference…  │
│           ├──────────────────────────────────────────────────┤
│ 🏠 Home   │  TODAY (2)               UPCOMING (7)             │
│ 📋 Bookings│ ┌────────┐┌────────┐    ┌────────┐┌────────┐ …  │
│ 🔍 Search │  │ card   ││ card   │    │ card   ││ card   │     │
│           │  └────────┘└────────┘    └────────┘└────────┘    │
│           ├──────────────────────────────────────────────────┤
│           │  OUTSTANDING BALANCES (4)   RECENTLY BOOKED (5)   │
│           │  ┌──────────────────────┐  ┌──────────────────┐  │
│           │  │ table rows…          │  │ table rows…      │  │
│           │  └──────────────────────┘  └──────────────────┘  │
└───────────┴──────────────────────────────────────────────────┘
```

### Search results (`/search?q=…`)
```
┌──────────────────────────────┐
│  🔍  07123 456789          ✕  │
├──────────────────────────────┤
│  3 results                    │
│  ┌──────────────────────────┐ │
│  │ J. Carter                 │ │
│  │ 07123 456789 · N15 5NJ    │ │
│  │ End of tenancy · 18/07    │ │
│  │ [Confirmed] [Paid]        │ │
│  │ N15NJ180726                │ │
│  └──────────────────────────┘ │
│  ┌──────────────────────────┐ │
│  │ J. Carter (repeat)         │ │
│  │ 07123 456789 · N15 5NJ    │ │
│  │ Window clean · 02/03      │ │
│  │ [Completed] [Paid]        │ │
│  │ N15NJ020326                │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

### Booking list (`/bookings`, mobile)
```
┌──────────────────────────────┐
│  Bookings          [Filters ▾]│
├──────────────────────────────┤
│  Sort: Newest ▾                │
├──────────────────────────────┤
│  ┌──────────────────────────┐ │
│  │ J. Carter · N15 5NJ        │ │
│  │ Deep clean · 18/07 10:00   │ │
│  │ [Confirmed] [Paid]         │ │
│  └──────────────────────────┘ │
│  ┌──────────────────────────┐ │
│  │ A. Osei · E17 6QA          │ │
│  │ Window · 20/07 14:00       │ │
│  │ [New] [Deposit paid]       │ │
│  └──────────────────────────┘ │
│           Load more            │
└──────────────────────────────┘
```

### Booking detail (`/bookings/:id`, mobile)
```
┌──────────────────────────────┐
│  ← Booking N15NJ180726     ⧉  │
│  [Confirmed]  [Paid]          │
├──────────────────────────────┤
│  Jasmine Carter                │
│  📞 07123 456789                │
│  ✉ jasmine@example.com          │
│  📍 14 Elm Road, N15 5NJ    ⧉  │
├──────────────────────────────┤
│  Service        End of tenancy │
│  Requested      18/07 · 10:00  │
│  Deposit        £30 ✓          │
│  Total          £249           │
│  Balance        £219           │
├──────────────────────────────┤
│  ▾ Customer notes               │
│  "Parking round the back,      │
│   buzzer flat 2"                │
├──────────────────────────────┤
│  ▾ Internal notes (2)           │
│  Called to confirm access — Sam│
│  2h ago                        │
│  [+ Add note]                  │
├──────────────────────────────┤
│  ▾ Source & attribution         │
├──────────────────────────────┤
│ [ Call ] [ WhatsApp ] [ Email ]│  ← sticky
└──────────────────────────────┘
```

### Internal-note interaction
```
Internal notes (2)                 [+ Add note]
┌──────────────────────────────────────────┐
│ Sam Wilson · 11 Jul 2026, 14:02           │
│ Called to confirm access instructions.    │
│ Customer will leave key with neighbour.   │
├──────────────────────────────────────────┤
│ Sam Wilson · 08 Jul 2026, 09:15           │
│ Deposit received, sent confirmation email.│
└──────────────────────────────────────────┘

Tapping [+ Add note] opens:
┌──────────────────────────────────────────┐
│ New internal note                          │
│ ┌────────────────────────────────────────┐│
│ │ (free text)                             ││
│ └────────────────────────────────────────┘│
│                          [Cancel] [Save]   │
└──────────────────────────────────────────┘
Saved notes are never editable or deletable in v1.
```

### Mobile navigation
```
┌──────────────────────────────┐
│                                │
│         (page content)        │
│                                │
├──────────────────────────────┤
│   🏠        📋        🔍       │
│  Home    Bookings   Search    │
└──────────────────────────────┘
Active tab: filled icon + label in navy;
inactive: outline icon + muted label.
```

### Empty states
```
No bookings today
"Nothing scheduled for today. Check
 upcoming bookings or search a customer."
                [ View upcoming ]

No search results
"No matches for '0712xxxxxx'.
 Try a partial postcode or name instead."

No internal notes yet
"No notes on this booking yet."
                [ + Add the first note ]
```

### Loading and error states
```
Loading (skeleton, not spinner-only):
┌──────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░  ░░░░░░░░░░░░░░ │
│ ░░░░░░░░  ░░░░░░░░░░░░░░░░░  │
└──────────────────────────────┘

Error (network/server):
┌──────────────────────────────┐
│  Couldn't load bookings.      │
│  [ Try again ]                │
└──────────────────────────────┘

Auth-resolving (before session confirmed):
┌──────────────────────────────┐
│                                │
│      (blank — no data,        │
│    no flash of protected UI)  │
│                                │
└──────────────────────────────┘
```
