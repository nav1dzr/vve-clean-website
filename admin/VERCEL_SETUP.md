# Admin app — Vercel project setup

These steps create a **second, independent** Vercel project for the admin
app, pointed at the same GitHub repository as the public site. This document
is instructions only — nothing here has been run. Do not connect or deploy
until this is explicitly approved (see `ADMIN_CRM_PLAN.md` §35).

## 1. Create the project

Vercel dashboard → **Add New → Project** → import the same GitHub repo used
for the public site (`vveclean-website` or whatever it's named there).
Vercel will ask for a Root Directory before finishing setup — this is the
step that makes it a genuinely separate project rather than a second
deployment of the existing one.

- **Root Directory**: `admin`
- **Framework Preset**: Vite (should auto-detect from `admin/package.json`)
- **Build Command**: `npm run build` (runs `vite build` — no SSR/prerender
  step, unlike the public site)
- **Output Directory**: `dist`
- **Install Command**: leave as default (`npm install`), run from `admin/`
  because of the Root Directory setting above

Give the project a distinct name from the public site's Vercel project (e.g.
`vve-admin`) so they're unambiguous in the Vercel dashboard.

## 2. Environment variables

Set these in **Project Settings → Environment Variables**. Names only are
listed here and in `admin/.env.example` — get the actual values from the
Supabase dashboard (**Project Settings → API**) and from whoever holds them
today (they're already in the public site's Vercel project for the same
Supabase project).

| Variable | Preview | Production | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | ✓ | Same value as the public site's. Safe to expose — it's a public API URL. |
| `VITE_SUPABASE_ANON_KEY` | ✓ | ✓ | Same value as the public site's. Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | **Server-only.** Set it on this project independently — do not reference or copy it into any `VITE_`-prefixed variable, and never paste it into a file in this repo. |
| `ADMIN_SITE_URL` | Preview URL, e.g. `https://<preview-domain>.vercel.app` | `https://admin.vveclean.co.uk` | Used only for building password-reset redirect links. |
| `ADMIN_ALLOWED_ORIGINS` | Preview URL (no trailing slash) | `https://admin.vveclean.co.uk` | Restricts CORS on `admin/api/*` — see `admin/api/_lib/cors.js`. |

Set each variable's environment scope explicitly (Vercel lets you tick
Production / Preview / Development separately) rather than applying one
value to all three — the Preview and Production redirect URLs are
different, and both need to also be added to Supabase's redirect allow-list
(`admin/SETUP.md` step 2).

## 3. Custom domain

**Project Settings → Domains** → add `admin.vveclean.co.uk`. Vercel will
show a DNS record to create (typically a `CNAME` to `cname.vercel-dns.com`,
but follow whatever Vercel's UI displays for this project).

At your DNS provider for `vveclean.co.uk` (wherever the domain is
registered/managed): add that record for the `admin` subdomain. This step
requires DNS/registrar access, which may not be available yet — see
`ADMIN_CRM_PLAN.md` §35, business decision 2. The project works fine on its
Vercel-assigned `*.vercel.app` URL in the meantime.

## 4. Local development note

`npm run dev` (from `admin/`) starts only the Vite dev server on port 5174 —
it does not run the `admin/api/*` serverless functions, so `/api/me` will
404 locally under plain `vite dev`. To exercise the API routes locally, run
[`vercel dev`](https://vercel.com/docs/cli/dev) from the `admin/` directory
instead (requires the Vercel CLI and being linked to the project). This
mirrors how the public site's own `/api/*.js` functions are already
developed in this repo.

## 5. Optional: Deployment Protection

**Project Settings → Deployment Protection** → consider enabling
Vercel's password or SSO-based protection in front of the entire project, as
a second layer in front of Supabase Auth (`ADMIN_CRM_PLAN.md` §27). This is
a business decision (§35, item 4), not something to enable by default.

## What this document does not cover

Actually creating the project, setting the environment variable values, or
adding the DNS record — those are real actions against live infrastructure
and are explicitly out of scope for this task (`ADMIN_CRM_PLAN.md` says do
not deploy, and the Phase 1 task instructions say the same).
