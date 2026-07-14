# Phase 4 — Vercel Preview environment checklist

For the owner to complete in the Vercel dashboard for the `vve-clean-admin` project. No secret values are written in this document — only where each one comes from and what to paste it into.

## 1. Confirm project configuration

**Project Settings → General:**

- [ ] **Root Directory** is `admin`
- [ ] **Framework Preset** is Vite (should auto-detect)
- [ ] **Build Command** is `npm run build`
- [ ] **Output Directory** is `dist`
- [ ] **Install Command** is `npm install`

**Project Settings → Git:**

- [ ] **Production Branch** is *not* `main` — this project should not auto-deploy production from `main` at all while the CRM is still in review. If a Production Branch must be set, point it at `feat/admin-crm-dashboard` for now, or leave Preview-only.
- [ ] Confirm any existing deployments listed were built from `feat/admin-crm-dashboard`, not `main` — if a stray deployment from `main` exists (e.g. from before Root Directory was corrected), it built the wrong thing (the public site's `package.json`, not `admin/package.json`) and can be ignored/removed once a correct one exists.

## 2. Environment variables

Add each of these under **Project Settings → Environment Variables**, scoped to **Preview** (Production can be set up later, at Phase 5/launch time — do not enable Production for this project yet per the Phase 4 instructions: do not connect `admin.vveclean.co.uk` yet).

| Variable | Where the value comes from | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Same value as the public site's Vercel project. Safe to expose — it's a public API URL. |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key | Same value as the public site's Vercel project. Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` `secret` key | **Server-only.** Do not scope this to any variable name starting with `VITE_`. Set it independently here — do not copy it from the public site's project by reusing the same Vercel env var name across projects; enter the value directly in this project. |
| `ADMIN_SITE_URL` | The Preview deployment's own URL once it exists (e.g. `https://vve-clean-admin-<hash>-<team>.vercel.app`), or a fixed alias if one is configured | Used only to build Supabase password-reset redirect links. Vercel assigns a new hashed URL per deployment by default — if password reset needs to work reliably across redeploys during testing, consider configuring a fixed Preview alias/branch domain in **Project Settings → Domains** and using that instead. |
| `ADMIN_ALLOWED_ORIGINS` | Same value as `ADMIN_SITE_URL` (no trailing slash) | Restricts CORS on `admin/api/*` — see `admin/api/_lib/cors.js`. Do **not** use a wildcard (`*`) in Production; for Preview, use the actual Preview URL/alias so CORS accurately reflects what's deployed. |

## 3. Supabase Auth redirect allow-list

Once the Preview URL (or fixed alias) is known:

- [ ] Supabase Dashboard → Authentication → URL Configuration → add `<preview-url>/reset-password` to the **Redirect URLs** allow-list (in addition to the `localhost:5174` entry from `admin/SETUP.md`).
- [ ] Do not add any public-site URL here — this allow-list is shared across the whole Supabase project.

## 4. Before triggering the deployment

- [ ] Confirm all five CRM migrations are applied (see `admin/PHASE4_MIGRATIONS.md`) — the Preview app will build and serve regardless, but login will only be fully testable once `admin_users` exists and an owner account is linked (`admin/SETUP.md`).
- [ ] Confirm the branch shown in the Vercel deployment UI is `feat/admin-crm-dashboard`, not `main`.

## 5. After the deployment is Ready

- [ ] Open the Preview URL and confirm the login page loads (not a 404 or build-error page).
- [ ] Confirm the page title reads "VVE Admin" and there is no visible reference to the public VVE Clean site.
- [ ] View source / inspect network tab: confirm no `SUPABASE_SERVICE_ROLE_KEY`-shaped value appears anywhere in the loaded JS.
- [ ] Proceed to the smoke-test checklist (a separate document/section) once login is confirmed reachable.

## 6. Online smoke test (once the Preview deployment is Ready)

Perform these in order. Use only test/real data you're comfortable with appearing in a private, `noindex`, non-production URL — do not use or screenshot real customer data anywhere this checklist's results get shared.

1. [ ] Login page loads.
2. [ ] A wrong password fails with a generic message (does not say "wrong password" specifically, does not confirm whether the email exists).
3. [ ] The correct owner login succeeds and lands on the dashboard.
4. [ ] Refreshing the page keeps you logged in (no bounce back to `/login`).
5. [ ] The dashboard loads real data (today/upcoming/recent counts) without an error state.
6. [ ] Search a known booking reference — it appears in results.
7. [ ] Search a known phone number (try with and without spaces) — it appears in results.
8. [ ] Open a booking's detail page — every section renders without a raw error or blank section.
9. [ ] Confirm the confirmation token is not visible anywhere on the page (view source / inspect — search for "token").
10. [ ] Add an internal note — it appears immediately at the top of the notes list.
11. [ ] Change the booking's operational status — the badge updates and a success message appears.
12. [ ] Change the balance status — the badge updates and a success message appears.
13. [ ] Log out — you're returned to `/login` and no protected content is visible afterward (try pressing the browser back button too).
14. [ ] Visit a protected URL directly while logged out (e.g. paste `/bookings` into the address bar) — you're redirected to `/login`, not shown a flash of the page.
15. [ ] **Separately, on the actual public site** (not this Preview): confirm the customer-facing site still works normally — a quote/booking page loads, nothing about it changed. This project's changes should have had zero effect on it, but this is the real-world confirmation of that.

## Known limitation of this checklist

This document was written without access to the live Vercel project (no Vercel CLI/API credentials are available in this environment) — every item above is a manual, click-by-click action for the project owner. Nothing in this checklist was performed automatically.
