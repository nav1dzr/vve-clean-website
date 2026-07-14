# Security Audit Report — VVE Clean

**Scope:** Full repository at `D:\VVE_CLEAN_WEBSITE` — public site (`src/`, `api/`, `public/`), admin CRM (`admin/`), Supabase schema (`supabase/migrations/`), and complete git history.
**Commit audited:** `2c97d92` (branch `main`)
**Date:** 2026-07-14
**Method:** Static/source-level penetration-style review — secret pattern scanning (working tree, full git history, production build output), manual code review of every serverless endpoint and Supabase migration, `npm audit` (production and full dependency graph, both apps), production build inspection. No code was changed and no live systems, real payments, or real customer records were touched.

This report makes no code changes. Every finding below includes why it matters, how exploitable it is, its severity, and the exact fix — implementation is a separate, deliberate step.

---

## Executive summary

The application's **payment, webhook, and admin-authentication design is sound** — server-side price authority, Stripe signature verification, webhook idempotency, a high-entropy confirmation token, Bearer-token (non-cookie) admin auth, and default-deny Supabase RLS with service-role-only access are all correctly implemented. No secrets were found anywhere in the working tree, production build output, or the entire git history. No SQL injection, path traversal, CSRF, or client-side XSS was found.

Two **Medium** findings deserve prompt attention: (1) the Stripe webhook's customer and business confirmation emails interpolate booking-form text into HTML **without** the escaping helper already used elsewhere in the same file, allowing stored HTML injection into the business owner's inbox by anyone willing to complete a real £30 payment; (2) two orphaned Supabase tables (`quote_requests`, `contact_messages`) still carry a stale `authenticated`-role read policy that was correctly removed from every other table, which — depending on a Supabase *project-level* setting outside this repo — could let a self-registered internet user read their historical contents directly. Neither is Critical or High: both require either a real payment or an external platform setting to be in a specific state, and both have small, mechanical fixes.

Everything else is Low or Informational: no rate limiting anywhere in the app, a few defensive-coding gaps (dead-code CORS wildcard fallback, a host-header-trusting URL fallback), no HTTP security headers on the public site (the admin app already has them), and one transitive dependency (`ws`, via an unused Supabase Realtime feature) with a High CVSS score but no reachable code path in this codebase.

**Overall score: 85 / 100** (see §10).

---

## Findings index (severity-sorted)

| # | Finding | Category | Severity |
|---|---|---|---|
| F1 | Unescaped booking data interpolated into confirmation emails (stored HTML injection) | Booking security / XSS | **Medium** |
| F2 | Stale `authenticated`-role SELECT policy on orphaned `quote_requests` / `contact_messages` tables | Supabase | **Medium** |
| F3 | No HTTP security headers on the public site | API security | **Medium** |
| F4 | No rate limiting anywhere in the application | API security | Low |
| F5 | `ws` transitive dependency — High CVSS, unreachable in this codebase | Dependencies | Low |
| F6 | Host-header-derived fallback for Stripe `success_url`/`cancel_url` | Booking security | Low |
| F7 | Dead-code wildcard CORS fallback in `api/contact.js` | API security | Low |
| F8 | Admin CORS `'null'`-origin literal fallback | API security | Low |
| F9 | No format validation on `email`/`postcode` in the booking API (length-cap only) | API security | Low |
| F10 | `api/servicePrices.js` has no handler but sits under `/api/` (dead/error route) | Repository hygiene | Informational |
| F11 | `admin/.gitignore` is empty (root `.gitignore` covers it, verified) | Repository hygiene | Informational |
| F12 | `booking_ref` is a guessable format (by design, mitigated by token requirement) | Client exposure | Informational |
| F13 | No public `robots.txt` on the public site | Repository hygiene | Informational |
| F14 | devDependency-only vulnerabilities (vite/vitest/eslint toolchain) | Dependencies | Informational |
| F15 | No login-attempt throttling beyond Supabase Auth's own defaults | API security | Informational |

---

## 1. Secrets

**Checked:** Stripe live/test keys, Supabase keys, Telegram bot tokens, SMTP/Gmail app passwords, Google API keys, OAuth secrets, PEM private keys, `.env` files, hardcoded passwords — across the current working tree, the two production build outputs (`dist/`, `admin/dist/`), and the **entire git history** (`git log --all -S<pattern>` pickaxe search for every secret prefix, plus a full filename scan for every commit that ever added a file named like `.env`/`secret`/`credential`/`.pem`/`.key`/`backup`).

**Result: clean. No leaked secret was found anywhere.**

- `git grep` across tracked files for `sk_live_`, `sk_test_`, `pk_live_`, `whsec_`, `AIza…` (Google API key), `ya29.…` (OAuth token), PEM headers, and Slack-style tokens: zero matches.
- Telegram bot-token pattern (`\d{8,10}:[A-Za-z0-9_-]{35}`): zero matches.
- Full-history pickaxe search on `sk_live_`, `sk_test_`, `whsec_`, `SUPABASE_SERVICE_ROLE_KEY=`, `AIza`, `GMAIL_APP_PASSWORD=`, `TELEGRAM_BOT_TOKEN=`, `-----BEGIN`: the only hits were (a) documentation prose describing *where* to put real keys (e.g. `README`/`VERCEL_SETUP.md` text: *"the keys currently in `.env` start with `sk_live_`…"* — no value follows), and (b) test-mock fixture literals in `tests/api/*.test.js` (`process.env.STRIPE_SECRET_KEY = 'sk_test_123'`, `'whsec_test'`) — fake values used only to satisfy Stripe SDK mocks in Vitest. Every hit was individually opened and confirmed to contain no real credential.
- Root `.env` exists on disk but is **untracked** (`git ls-files -- .env` returns nothing); `admin/.env.example` (tracked) lists variable names only, with empty values, and its inline comments explicitly warn never to paste real values into the repo.
- No `.env`, `.pem`, `.key`, or backup/dump file was ever added in any commit in this repository's history.

**Why it matters:** a leaked Stripe secret key, Supabase service-role key, or SMTP password would give an attacker full account takeover of payments, the database (bypassing RLS entirely), or the ability to send email as the business. **Exploitability:** N/A — nothing found. **Fix:** none required; continue current practice (`.env` gitignored, `.env.example` name-only, secrets set directly in Vercel project settings).

---

## 2. Client exposure

**Checked:** service-role key exposure, secret env vars bundled into client JS, hidden endpoints, internal URLs, confirmation-token exposure, booking-reference exposure.

- **Service-role key:** grepped both production bundles (`dist/assets/*.js`, `admin/dist/assets/*.js`) for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `GMAIL_APP_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `GOOGLE_SHEETS_SECRET`, and any JWT-shaped string (`eyJ…`). **Zero matches in either bundle.** Only `VITE_`-prefixed variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are ever exposed to the client, which is the intended, safe design — the anon key has zero table access by RLS default-deny (§5).
- **confirmation_token:** grepped both bundles — zero matches. Server-side, `api/confirmation-details.js`'s `SAFE_SELECT` (line 21) explicitly excludes it from its query, and `admin/api/_lib/bookingFields.js`'s `DETAIL_SELECT` (the admin API's full-detail column allowlist) also excludes it, with an explicit comment confirming this is intentional.
- **Hidden endpoints:**
  - `api/servicePrices.js` sits directly under `api/` but exports no default handler — only a `computePrice()` function imported by `create-checkout-session.js`. See F10.
  - `api/backfill-paid-booking.js` is a deliberate, undocumented-in-UI operational tool for manually reconciling a booking Stripe marked paid but the webhook failed to persist. It is **safe by default**: it returns `404` immediately if `BACKFILL_SECRET` is unset (line 54-57), and when set, requires the secret via a `timingSafeEqual` constant-time comparison (lines 69-73) before doing anything. Not a vulnerability — flagged here only because "hidden endpoints" was explicitly in scope.
- **Internal URLs:** the Google Sheets Apps Script endpoint URL, Telegram API token, and SMTP credentials are all read from server-only env vars and never appear in either client bundle (confirmed by the same grep above).
- **Booking references:** `booking_ref` (format `POSTCODE+DDMMYY`, e.g. `E81AA010826`) is intentionally guessable and low-entropy — but by design it is **never sufficient alone** to read booking data. `api/confirmation-details.js` and `api/verify-payment.js` both require either the 256-bit `confirmation_token` or an exact Stripe Checkout Session ID before returning anything; with neither, both return a generic `{ paid: false }` without revealing whether the reference exists (explicitly documented in code comments in both files). Rated **Informational** — the mitigation is correct and consistently applied, just noting the design for completeness (F12).

**Why it matters:** service-role/SMTP/Telegram credentials in a client bundle would let anyone with a browser's dev tools fully compromise the backend. **Exploitability:** N/A — nothing found. **Fix:** none required.

---

## 3. Booking security

**Checked:** price tampering, payment bypass, webhook signature verification, replay attacks, booking validation, duplicate payments, forged requests.

**Strengths (no issue found):**
- **Price tampering:** `api/create-checkout-session.js` always recomputes price server-side via `computePrice(quoteConfig)` (`api/servicePrices.js`); a client-supplied `price` is only used for a mismatch **warning log** (lines 173-177) and never trusted. The only accepted "no fixed price" path (`manual_quote`) is locked to one exact, narrow `quoteConfig` shape (`isApprovedManualQuote`, lines 159-164) — a client cannot manufacture an arbitrary unpriced booking by omitting fields.
- **Payment bypass:** a booking is only ever marked `payment_status: 'paid'` inside `api/stripe-webhook.js`, triggered exclusively by a genuine, signature-verified `checkout.session.completed` event from Stripe. There is no client-callable endpoint that sets payment status directly.
- **Webhook verification:** `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` (line ~487) rejects any request without a valid Stripe signature (`400` on failure) — the raw body is read unparsed (`bodyParser: false`) specifically so signature verification sees the exact bytes Stripe signed.
- **Replay attacks:** the Stripe SDK's `constructEvent` enforces its own timestamp-tolerance window as part of signature verification (rejects old signed payloads outside ~5 minutes), and a custom `processed_stripe_events` idempotency table (claim → processing → completed/failed state machine, `claimStripeEvent`/`markEventCompleted`/`markEventFailed`) guarantees a re-delivered event with the same `event.id` is never processed twice — including correct handling of a crashed-Lambda mid-processing state via a staleness window.
- **Booking validation:** `fullName`, `phone`-or-`email`, `date`, `time`, and `termsAccepted === true` are all enforced **server-side** in `create-checkout-session.js` (not just disabled buttons client-side) — a direct API call missing any of these is rejected with `400`.
- **Duplicate payments:** the webhook `upsert`s on `stripe_session_id` (not `insert`), so a retried webhook delivery updates the same row rather than creating a duplicate booking; notification-sent flags (`telegram_sent`, `email_business_sent`, etc.) are only ever written `true` (never overwritten back to `false`), preventing a retry from re-sending a notification that already succeeded.
- **Forged requests:** see F6 below for the one gap found in this area.

### F1 — Unescaped booking data in confirmation emails (stored HTML injection) — **Medium**

**Where:** `api/stripe-webhook.js`, `customerEmailHtml()` (lines ~365-425) and `businessEmailHtml()` (lines ~427-461).

**What:** These two functions build the HTML emails sent on every paid booking. They interpolate `meta.fullName`, `meta.address`, `meta.postcode`, `meta.date`, `meta.time`, `meta.message` (the customer's free-text Notes field), `meta.service`, and `bookingRef` directly into HTML template strings — **without** the `escHtml()` helper that is defined in this exact same file (line ~163) and correctly used two functions away, in `telegramText()` and `serviceDetailHtml()`. `api/contact.js`'s equivalent email builders apply `escHtml()` to every field correctly — this file is the outlier.

All of these values originate from the public, unauthenticated `POST /api/create-checkout-session` request body. They are length-capped to 500 characters but never HTML-escaped before being stored in Stripe Checkout Session metadata, and the webhook renders that metadata straight into HTML at send-time. `bookingRef` is partly attacker-influenced too: it's derived from `postcode` via `.replace(/\s+/g, '').toUpperCase()`, which strips whitespace but not `<`, `>`, or `"`.

**Why it matters:** an attacker who submits a booking with `fullName` (or `address`/`message`) containing `<img src=x onerror=...>` or a spoofed `<a href="...">` block, then completes the £30 Stripe deposit payment, gets that HTML rendered inside the email your business receives at `BUSINESS_EMAIL` (and inside the customer's own confirmation email — lower value, that's their own inbox). This can be used to spoof a fake "URGENT — call this number" block, disguise a link, or otherwise manipulate what your staff sees when triaging a new booking. Actual `<script>` execution depends on the recipient mail client (most modern webmail strips scripts), but raw HTML/CSS injection into an operational table your business relies on is a real risk independent of that.

**Exploitability:** Medium-low in practice — requires a real, traceable £30 Stripe payment (raising the bar above a free-form web submission), but the technique itself is trivial and repeatable.

**Exact fix:** wrap every interpolated value in both functions with the `escHtml()` helper already defined at the top of `api/stripe-webhook.js`, exactly matching the pattern already used in `telegramText()` in the same file and throughout `api/contact.js`. Concretely: `meta.fullName` → `escHtml(meta.fullName)`, the `dateRow`/`addressRow` template strings, `meta.message` in the `rows` array of `businessEmailHtml`, and `bookingRef` wherever it appears in either function.

### F6 — Host-header-derived fallback for Stripe `success_url`/`cancel_url` — Low

**Where:** `api/create-checkout-session.js`, lines ~221-228.

**What:** `siteUrl` is normally read from `process.env.SITE_URL`. If that env var is unset or fails `new URL()` validation (or contains `localhost`), the code falls back to `req.headers['x-forwarded-host'] || req.headers.host`, with no explicit allowlist check on the resulting value, before using it to build the Stripe `success_url`/`cancel_url`.

**Why it matters:** if `SITE_URL` were ever unset or misconfigured in production, a request with a spoofed `Host`/`X-Forwarded-Host` header could steer the post-payment redirect to an attacker-controlled domain — an open-redirect risk directly in the payment flow, useful for phishing a customer immediately after they've just paid.

**Exploitability:** Low today — `SITE_URL` is correctly configured in the live Vercel project (confirmed in this session's prior production audit), and Vercel's own edge network typically manages `x-forwarded-host` rather than passing through an arbitrary client-supplied value unmodified. This is a defense-in-depth gap, not a currently-live exploit path.

**Exact fix:** validate the derived host against an explicit allowlist (e.g. `['www.vveclean.co.uk', 'vveclean.co.uk']`) before using it in `siteUrl`, falling back to the hardcoded production domain rather than trusting any forwarded header when `SITE_URL` is absent.

---

## 4. API security

**Checked:** authentication, authorization, CORS, rate limiting, input validation, XSS, injection, CSRF, path traversal — across every file in `api/*.js` and `admin/api/**/*.js`.

**Strengths (no issue found):**
- **Authentication/authorization (admin):** every admin route calls the shared `verifyAdminRequest()` (`admin/api/_lib/adminAuth.js`) before touching the database, with no exceptions found across all 8 admin routes. It validates the Supabase session JWT server-side via `supabase.auth.getUser(token)` (real signature/expiry verification against Supabase's own auth server, not a trust-the-header pattern), then cross-checks the resulting user against the `admin_users` allowlist table — `401` for an invalid/expired token, `403` for a valid Supabase account that isn't an authorized admin.
- **CSRF:** admin auth is transported as a `Bearer` token in the `Authorization` header (`admin/src/lib/authFetch.ts`), never an ambient cookie. A malicious third-party page cannot forge a state-changing admin request (status/balance/notes updates) because it has no way to read or attach the victim's token — this makes CSRF tokens unnecessary given the chosen auth transport, and no gap was found.
- **SQL/RPC injection:** every Supabase call across both apps uses the JS query builder or a parameterized RPC (`search_bookings`, called with bound arguments, never string-built SQL); the underlying Postgres function additionally pins `search_path` and revokes `EXECUTE` from `anon`/`authenticated`/`PUBLIC`. No raw/dynamic SQL, no dynamic `.from(tableName)` from user input, anywhere.
- **Path traversal:** no endpoint reads or writes a file based on user input anywhere in scope.
- **Object-ID authorization:** all four `admin/api/bookings/[id]/...` routes validate the `id` is a well-formed UUID (rejecting the human-readable, guessable `booking_ref` as a lookup key) before querying, and run the admin-auth check first in every case.
- **HTTP method enforcement:** every endpoint in both apps enforces an explicit method allowlist and returns `405` for anything else; no endpoint silently accepts an unintended method.
- **`confirmation-details.js` / `verify-payment.js`:** correctly require a high-entropy token or exact Stripe session ID, return a generic denial otherwise (no reference-existence oracle), return a minimal explicit field allowlist, and derive Google Ads conversion `livemode` server-side rather than trusting a client flag.

### F3 — No HTTP security headers on the public site — **Medium**

**Where:** `vercel.json` (repo root, public site).

**What:** the public site's `vercel.json` contains only a SPA rewrite rule — no `headers` block at all. There is no `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, or `Referrer-Policy` anywhere for the public site (`vveclean.co.uk`). By contrast, `admin/vercel.json` already implements all four correctly (CSP scoped to `'self'` + Supabase, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`) — the pattern is known and proven elsewhere in this repo, just not applied to the public app.

**Why it matters:** the public site includes the booking form (personal details, date/time, terms acceptance) and the button that initiates a real Stripe payment. Without `X-Frame-Options`/`frame-ancestors`, the page can be embedded in an invisible or disguised iframe on a third-party site (clickjacking), tricking a visitor into submitting personal data or clicking through toward payment without realizing it. Without `X-Content-Type-Options: nosniff`, some older browsers can be tricked into MIME-sniffing an uploaded/served asset as executable script. Without a `Referrer-Policy`, the full URL (potentially including query-string attribution data like `gclid`) is sent as a `Referer` header to every outbound link (e.g. the WhatsApp links).

**Exploitability:** Low-Medium — clickjacking a lead-gen/payment funnel is a known, practical technique; the other two headers are lower-severity defense-in-depth.

**Exact fix:** add a `headers` block to the root `vercel.json`, mirroring `admin/vercel.json`'s pattern but scoped to what the public site actually needs (it embeds no third-party frames, calls Supabase and Stripe, and needs `'unsafe-inline'` for any inline styles Tailwind/Vite may emit — verify against the actual build output before locking down `style-src`). At minimum: `X-Frame-Options: DENY` (or `frame-ancestors 'none'` via CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### F4 — No rate limiting anywhere in the application — Low

**What:** no IP-based throttling, token bucket, or CAPTCHA exists on any endpoint in either app — confirmed by grep for rate-limiting libraries/patterns across the whole repo (only match was the unrelated `503`/`Retry-After` webhook-idempotency-collision path, which isn't abuse throttling).

**Why it matters and exploitability, by endpoint:**
- `api/contact.js` — no rate limit beyond a honeypot field; an attacker can flood the business inbox/Telegram/Sheets with junk submissions indefinitely. **Low-Medium** impact (nuisance/cost, not data exposure).
- `api/create-checkout-session.js` — an attacker can create unlimited real Stripe Checkout Sessions and pending `bookings` rows without paying; each is a real Stripe API call (API quota/cost) and a DB row (storage bloat). **Low** impact (no data exposure; a completed payment is still required for any further effect).
- Admin login/password-reset — delegated entirely to Supabase Auth's (`supabase.auth.signInWithPassword`/`resetPasswordForEmail`) own platform-level throttling; this app adds nothing on top. **Low** — reasonable to rely on the platform for this, but worth confirming Supabase's defaults are adequate for this use case.
- `api/confirmation-details.js` / `api/verify-payment.js` — no throttling, but irrelevant in practice: the required token has 256 bits of entropy, making brute force computationally infeasible regardless of request rate.
- `admin/api/search.js` / `admin/api/bookings/index.js` — no throttling, but only usable by an already-authenticated admin (or a stolen token), so low incremental risk.

**Exact fix:** add IP-based rate limiting (e.g. Vercel Edge Middleware, or an Upstash Redis token-bucket) at minimum to `api/contact.js` and `api/create-checkout-session.js`.

### F7 — Dead-code wildcard CORS fallback in `api/contact.js` — Low

**Where:** `api/contact.js`, line ~17: `'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*')`.

**What:** `ALLOWED_ORIGINS` always contains two hardcoded localhost strings, so `ALLOWED_ORIGINS[0]` can never actually be falsy today — the `'*'` fallback is unreachable. But it's a landmine: a future edit that removes the hardcoded dev origins (e.g. "clean this up for production") would silently reactivate a wildcard `Access-Control-Allow-Origin` on this endpoint.

**Why it matters:** a wildcard CORS response would let any website read this endpoint's response cross-origin (low value here since the response is just `{ok:true}`/error text, but still bad practice on a form that emails/Telegrams/Sheets business data).

**Exploitability:** none today (dead code). **Exact fix:** remove the `|| '*'` fallback entirely; if `ALLOWED_ORIGINS[0]` is ever falsy, omit the `Access-Control-Allow-Origin` header instead (default-deny), matching `create-checkout-session.js`'s equivalent logic which has no such fallback.

### F8 — Admin CORS `'null'`-origin literal fallback — Low

**Where:** `admin/api/_lib/cors.js`, line ~25: `'Access-Control-Allow-Origin': useOrigin || 'null'`.

**What:** when the request `Origin` doesn't match the allowlist, the header is set to the literal string `'null'`. A request whose `Origin` header is genuinely the string `"null"` (achievable from a sandboxed iframe or a `data:` URL) would then match.

**Why it matters:** this is a known CORS anti-pattern. **Exploitability:** low in this app specifically — no route ever sends `Access-Control-Allow-Credentials`, and admin auth is a Bearer token an attacker's null-origin page has no access to read in the first place, so even a "successful" match can't be leveraged without already possessing a valid admin token. **Exact fix:** omit the `Access-Control-Allow-Origin` header entirely for non-matching origins instead of sending the literal `'null'`.

### F9 — No format validation on `email`/`postcode` in the booking API — Low

**Where:** `api/create-checkout-session.js` — `email`, `address`, `postcode`, `phone`, `message` are only length-capped (`.slice(0, 500)`), with no format check. `api/contact.js`, by contrast, validates email format with `EMAIL_RE` server-side.

**Why it matters:** an invalid/malformed email means the customer confirmation email silently fails to send (nodemailer will error, logged but not surfaced); a `postcode` with unexpected characters flows into `booking_ref` and (per F1) into unescaped HTML. Low severity on its own — the real risk is F1, this just widens that surface slightly.

**Exact fix:** apply the same `EMAIL_RE` pattern already used in `api/contact.js` to the `email` field in `create-checkout-session.js`, and restrict `postcode` to a UK-postcode-shaped character set before using it in `booking_ref`/emails.

### F15 — No login-attempt throttling beyond Supabase Auth defaults — Informational

Covered under F4 above; listed separately here only because it's specifically about the admin login surface. No app-level lockout/backoff exists; this is fully delegated to Supabase Auth's platform-level protections. Recommend confirming (in the Supabase dashboard, outside this repo) that those defaults are enabled and adequate.

---

## 5. Supabase

**Checked:** RLS, policies, service-role usage, anon usage — every migration file in `supabase/migrations/` (13 files) read in full, chronologically.

**Strengths (no issue found):**
- **RLS is enabled on all 6 tables** that exist anywhere in the schema: `quote_requests`, `contact_messages`, `bookings`, `processed_stripe_events`, `admin_users`, `internal_notes`.
- **`bookings`** (the production-critical table): its only-ever SELECT policy (`authenticated_read_bookings`, `USING (true)`) was correctly **removed** in a later migration (`20260716000000_remove_broad_bookings_select_policy.sql`). As of the current schema, `bookings` has RLS enabled with **zero** policies for `anon` or `authenticated` — both roles get zero rows for every operation via the public anon key/PostgREST. All real admin reads/writes go through server-side API routes using the service-role key (which bypasses RLS by design, gated by `verifyAdminRequest()` — see §4).
- **`admin_users`** and **`internal_notes`**: no policy was ever created for either table (intentional, per explicit code comments in their migrations) — default-deny for `anon`/`authenticated`, service-role-only access via the admin API.
- **`processed_stripe_events`**: one explicit `FOR ALL TO anon USING (false)` blanket-deny policy, plus default-deny for `authenticated` (no policy exists for it). Only `service_role` has access, via explicit `GRANT`.
- **`search_bookings()` RPC**: explicitly excludes `confirmation_token`, Stripe IDs, notes, and attribution fields from its return columns, and `EXECUTE` is revoked from `PUBLIC`/`anon`/`authenticated`, granted only to `service_role`.
- **Admin credentials**: `admin_users` has no password column at all — it's purely an authorization allowlist (`id` FK to `auth.users`, `display_name`). Actual authentication is 100% delegated to Supabase Auth. No seed data, hardcoded email, or hardcoded password exists in any migration.
- **Grants**: every `GRANT` found in the migrations targets `service_role` only; no grant to `anon`, `authenticated`, or `PUBLIC` was found anywhere.

### F2 — Stale `authenticated`-role SELECT policy on orphaned `quote_requests` / `contact_messages` — **Medium**

**Where:** `supabase/migrations/20260603155204_create_vveclean_tables.sql` / `20260604153641_create_quote_and_contact_tables.sql` (original `CREATE POLICY "Authenticated users can view/read quotes/contact messages" ... FOR SELECT TO authenticated USING (true)`), never dropped by any later migration.

**What:** unlike `bookings` (where the equivalent broad `authenticated USING (true)` SELECT policy was deliberately removed once the admin model moved to service-role-only access, per `20260716000000_remove_broad_bookings_select_policy.sql`), the same pattern on `quote_requests` and `contact_messages` was never cleaned up. Both tables also still have a public `INSERT` policy for `anon, authenticated` (`public_insert_quote_requests`/`public_insert_contact_messages`).

Grepping the entire current application codebase (`src/`, `api/`, `admin/`) for any reference to `quote_requests` or `contact_messages` returns **zero matches** — these tables are orphaned from an earlier version of the site (before the current booking/contact flow existed; `api/contact.js` today emails/Telegrams/Sheets directly and never touches Supabase). No current user data flows into them.

**Why it matters:** if Supabase Auth's project-level "allow public sign-ups" setting is enabled for this project (the default for new Supabase projects, and a **dashboard setting outside this repository**, so it cannot be confirmed from source alone), any anonymous internet visitor could self-register a free Supabase Auth account using the public `VITE_SUPABASE_ANON_KEY` and then query these two tables directly via PostgREST — reading every historical row (name, email, phone, message content) — entirely bypassing the `admin_users` allowlist and every line of application code, because RLS, not the app, is what would be granting that access.

**Exploitability:** contingent on an external platform setting this repo cannot confirm or deny; the tables themselves contain no data written by the current application, but may still hold historical rows from when this feature was live.

**Exact fix:** drop the two `authenticated USING (true)` SELECT policies (`DROP POLICY IF EXISTS "Authenticated users can view quotes" ON quote_requests;` and the `contact_messages` equivalent — check exact policy names, some were recreated with different names across the two early migrations) in a new migration, matching the default-deny-by-service-role-only pattern already used for `bookings`/`admin_users`/`internal_notes`. Separately, verify in the Supabase project dashboard (Authentication → Providers → Email) whether public sign-ups are enabled, and disable them if the admin app is meant to be the only way to obtain a Supabase Auth session — this is a **project setting**, not something these migration files control.

---

## 6. Repository

**Checked:** sensitive files, old backups, logs, customer information, unnecessary commits, ignored files, accidental uploads.

**Result: clean.**
- `node_modules/`, `dist/`, `dist-ssr/`, `.env`, `*.local` are all correctly gitignored and confirmed untracked (`git ls-files` returns nothing for any of these patterns).
- No `.bak`/`.old`/`.orig`/`.log`/`.sql`-dump/`.csv`/backup-named file is tracked anywhere in the repo (the only `.sql` files tracked are the legitimate, expected Supabase migrations).
- The 15 largest tracked files are all legitimate gallery/marketing images plus `package-lock.json` — no data dump, export, or unexpected binary.
- No `.vercel/` deployment-artifact directory is tracked.
- No real customer PII (emails, names tied to bookings, phone numbers) was found in any tracked file — a repo-wide email-pattern grep returned only `@vveclean.co.uk` business addresses, `schema.org`/`w3.org` boilerplate, and two false-positive matches inside binary PNG gallery images (not actual text).

### F10 — `api/servicePrices.js` has no handler but sits under `/api/` — Informational

This file only exports `computePrice()` for internal import by `create-checkout-session.js`; it has no default export. Because it's located directly under `api/`, Vercel's filesystem-based routing will still register `/api/servicePrices` as a route — invoking it directly would error at runtime (no handler to call) rather than expose any data, so this is not a vulnerability, just dead/confusing routing surface. **Fix:** move it to `api/_lib/servicePrices.js` (matching the existing `api/_lib/formatBookingItems.js` convention), and update the one import in `create-checkout-session.js` accordingly.

### F11 — `admin/.gitignore` is empty — Informational

Verified via `git check-ignore -v` that the **root** `.gitignore`'s patterns (`node_modules`, `dist`, `.env`, `*.local`) correctly apply recursively and do cover `admin/node_modules`, `admin/dist`, `admin/.env`, and `admin/.env.local` — so this is not currently a gap. Noted only because an empty `admin/.gitignore` provides no protection if `admin/` is ever extracted into its own repository. **Fix (optional):** add an explicit `admin/.gitignore` mirroring the root one, for robustness rather than correctness.

### F13 — No public `robots.txt` on the public site — Informational

`public/robots.txt` does not exist (confirmed `admin/public/robots.txt` does exist and correctly disallows all crawling for the CRM). This is an SEO/crawl-control gap, not a security vulnerability — the legacy `/booking.html` redirect shim and `/confirmation.html` already carry their own `<meta name="robots" content="noindex">` tags, so the pages most worth keeping out of search results are already self-protected regardless of `robots.txt`. Already flagged in an earlier production audit for this repo; repeated here only for completeness since "repository" was explicitly in scope.

---

## 7. Dependencies

**Checked:** `npm audit` (both full-tree and `--omit=dev`) for root and `admin/`, abandoned packages, duplicate packages.

### F5 — `ws` transitive dependency (High CVSS, unreachable in this codebase) — Low

**Where:** root `package.json` → `@supabase/supabase-js@2.57.4` → `@supabase/realtime-js@2.15.5` → `ws@8.18.3` (version range `8.0.0–8.20.1`).

**What:** `npm audit --omit=dev` on the root app reports exactly **one** production-impacting vulnerability: `ws` is affected by two advisories — [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) (uninitialized memory disclosure, CVSS 4.4/moderate) and [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) (memory-exhaustion DoS via tiny fragments, CVSS 7.5/**high**). `admin/`'s production audit (`npm audit --omit=dev`) reports **zero** vulnerabilities — its copy of `ws` is only pulled in by `jsdom`, a devDependency, correctly excluded.

**Why it matters / exploitability:** `ws` is a WebSocket client, used by `@supabase/realtime-js` to connect to Supabase's Realtime service. A repo-wide grep for `.channel(`/`realtime`/`Realtime` returns **zero matches** anywhere in application code — this codebase never calls Supabase Realtime, so the vulnerable `ws` code path is never actually reached at runtime; it is dead weight pulled in transitively by an unused feature of the Supabase SDK, not an exploitable surface in this application as written.

**Exact fix:** run `npm audit fix` (a compatible fix is available per `fixAvailable: true`), or add a `package.json` `overrides` entry pinning `ws` to `>=8.21.0`. Since Realtime is unused, an equally valid fix is to confirm it will remain unused and simply track this as accepted risk; either way, a one-line `overrides` entry is the fastest concrete fix.

### F14 — devDependency-only vulnerabilities — Informational

Both apps' full (non-`--omit=dev`) `npm audit` reports additional findings — root: 17 total (1 critical, 8 high, 6 moderate, 2 low); admin: 5 total (1 critical, 1 high, 3 moderate) — entirely in `vite`, `vitest`, `@vitest/mocker`, `vite-node`, `esbuild`, `eslint`/`@eslint/plugin-kit`, `@babel/core`/`@babel/helpers`, `rollup`, `glob`, `minimatch`, `picomatch`, `cross-spawn`, `flatted`, `js-yaml`, `yaml`, `ajv`, `brace-expansion` — the build/lint/test toolchain, never shipped to production (confirmed: both apps' `--omit=dev` audits above show these disappear entirely except the one `ws` entry). The `vitest` critical-severity advisory in particular sounds alarming out of context but only affects the local test runner. **Exact fix (optional, low priority):** run `npm audit fix` for root and admin devDependencies during a routine maintenance pass; note `fixAvailable` for `vitest` requires a semver-major bump (`vitest@4.x`), so budget time for a compatibility check rather than treating it as a drop-in patch.

**Abandoned/duplicate packages:** none found. Both `package.json` files are small and modern (React 18, Vite 5, Stripe SDK 22, `@supabase/supabase-js` 2, `nodemailer` 9) with no overlapping/duplicate-purpose libraries (e.g. no second HTTP client, no second date library, no second UI kit).

---

## 8. Build output

**Checked:** both production bundles (`dist/` for the public site, `admin/dist/` for the CRM) rebuilt fresh from the audited commit and grepped for every server-only secret pattern, `confirmation_token`, and any JWT-shaped literal.

**Result: clean in both bundles.**
- No match for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `GMAIL_APP_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `GOOGLE_SHEETS_SECRET`, `sk_live_`, `sk_test_`, or `whsec_` in either `dist/`.
- No match for `confirmation_token` (the string) in either `dist/`.
- No JWT-shaped string (`eyJ…`) of any kind was found in either bundle — even the public anon key is not literally embedded as a string constant the way this grep would catch it, since it's supplied via `import.meta.env` at build time and Vite inlines it as a plain string value; a targeted check confirmed only the expected `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values are present, which is the intended, safe design (anon key has zero RLS-granted access — see §5).

Builds both completed successfully with no errors (`npm run build` in root, `npm run build` in `admin/`), confirming the audited commit is in a deployable state.

---

## 9. Git history

**Checked:** every commit in the repository's full history, searched for leaked secrets.

**Method:** `git log --all -S"<pattern>"` (pickaxe search — finds every commit where the occurrence-count of an exact string changed, i.e. every commit that ever added or removed that string) for `sk_live_`, `sk_test_`, `whsec_`, `SUPABASE_SERVICE_ROLE_KEY=`, `AIza`, `GMAIL_APP_PASSWORD=`, `TELEGRAM_BOT_TOKEN=`, and `-----BEGIN`; plus a full-history filename scan (`git log --all --diff-filter=A --name-only`) for every file ever added anywhere in history matching `.env`/`secret`/`credential`/`.pem`/`.key`/`.p12`/`backup`/`.bak`/`dump`/`password`.

**Result: clean.**
- `sk_live_`/`sk_test_`/`whsec_` hits trace to exactly two sources, both opened and confirmed non-sensitive: (1) setup-documentation prose (commit `90ee2d8`, "Add Stripe deposit payment flow") describing which key *prefix* to expect in a local, gitignored `.env` file — no actual value is present; (2) Vitest mock fixtures (`process.env.STRIPE_SECRET_KEY = 'sk_test_123'`, `'whsec_test'`) added across several `fix:`/`test:` commits — fake placeholder strings that only exist to satisfy the Stripe SDK's constructor/signature-verification mocks in tests, never real keys.
- `SUPABASE_SERVICE_ROLE_KEY=` appears exactly once in history, in commit `1dc7474` ("scaffold private admin application") — inside `admin/.env.example`, where the line is `SUPABASE_SERVICE_ROLE_KEY=` with **no value**, directly under a comment reading *"NEVER paste it into a file in this repo."*
- `AIza`, `GMAIL_APP_PASSWORD=`, `TELEGRAM_BOT_TOKEN=`, and any PEM private-key header: **zero hits** in the entire history.
- The filename scan's only matches were `admin/.env.example` (name-only placeholder file, as above) and `admin/src/pages/ResetPasswordPage.tsx`/`.test.tsx` — legitimate application source files for the admin password-reset *feature*, matched only because "password" appears in the filename, not because they contain a credential.
- No commit at any point in history ever added a real `.env` file, a `.pem`/`.key` file, or anything resembling a database backup/dump.

**Why it matters:** even if a secret is removed in a later commit, it remains permanently recoverable from git history unless the history itself is rewritten — this is why it's checked separately from the working tree. **Fix:** none required; history is clean.

---

## 10. Overall risk assessment

**What's strong:**
- Payment integrity (server-side price authority, signature-verified webhooks, idempotency, no client-trusted payment state) is implemented to a standard well above what's typical for a site this size.
- Admin authentication/authorization (Supabase-JWT verification + allowlist table, Bearer-token transport eliminating CSRF risk) is correctly and consistently applied across every admin route with no exceptions found.
- Supabase RLS defaults to deny on every table that matters in production (`bookings`, `admin_users`, `internal_notes`, `processed_stripe_events`), with service-role access gated entirely behind the application's own auth check — a genuine defense-in-depth layer, not just a checkbox.
- Secrets hygiene is clean across the working tree, both production builds, and the complete git history — a full pickaxe search of every commit ever made found nothing real.
- No SQL injection, path traversal, CSRF, or client-side XSS was found anywhere in either application.

**What needs attention, in priority order:**
1. **F1** (Medium) — escape the four/five interpolated fields in `stripe-webhook.js`'s two email builders. Mechanical, ~15-minute fix, closes the most concrete finding in this report.
2. **F2** (Medium) — drop the stale `authenticated` SELECT policies on the two orphaned Supabase tables, and confirm public sign-up is disabled in the Supabase project dashboard.
3. **F3** (Medium) — add a `headers` block to the public site's `vercel.json`, mirroring the admin app's existing, working pattern.
4. **F4–F9** (Low) — rate limiting, the two CORS fallback strings, the host-header fallback, and email/postcode format validation are all small, independent, low-urgency hardening items.
5. **F10–F15** (Informational) — housekeeping items with no live exploitability; address opportunistically.

None of these findings involve a currently-exploitable path to secrets, service-role/admin bypass, unauthorized payment manipulation, or arbitrary customer-data disclosure. The two Medium findings each require an additional real-world condition to bite (a completed payment; an external Supabase project setting), and both have small, well-understood fixes.

### Overall score: **85 / 100**

Scoring rationale: starts from 100; −5 each for the two Medium findings with real (if bounded) exploitability (F1, F2); −3 for F3 (missing security headers on a payment-adjacent public site, especially given the admin app already demonstrates the correct pattern); −1 each for the six Low findings (F4–F9, capped combined deduction); remainder held for the clean secrets/git-history/build-output results, the well-designed payment/webhook/RLS/admin-auth architecture, and the absence of any Critical or High finding with real, unconditional exploitability. Remediating F1–F3 alone would bring this to roughly 93/100.
