# Repository housekeeping report

Written during Phase 4 of the admin CRM project. Informational only — **nothing listed here was modified or deleted.**

## Untracked files

Every file below was diffed byte-for-byte against the tracked file its name suggests it's a copy of.

| File | Tracked original exists? | Byte-identical duplicate? | Safe to delete later? | Add to `.gitignore`? |
|---|---|---|---|---|
| `STRIPE_SETUP - Copy.md` | Yes — `STRIPE_SETUP.md` | Yes, identical | Yes | Not needed — see note below |
| `package-lock - Copy.json` | Yes — `package-lock.json` | Yes, identical | Yes | Not needed |
| `postcss.config - Copy.js` | Yes — `postcss.config.js` | Yes, identical | Yes | Not needed |
| `prerender - Copy.mjs` | Yes — `prerender.mjs` | Yes, identical | Yes | Not needed |
| `tailwind.config - Copy.js` | Yes — `tailwind.config.js` | Yes, identical | Yes | Not needed |
| `tsconfig - Copy.json` | Yes — `tsconfig.json` | Yes, identical | Yes | Not needed |
| `tsconfig.app - Copy.json` | Yes — `tsconfig.app.json` | Yes, identical | Yes | Not needed |
| `tsconfig.node - Copy.json` | Yes — `tsconfig.node.json` | Yes, identical | Yes | Not needed |
| `vercel - Copy.json` | Yes — `vercel.json` | Yes, identical | Yes | Not needed |
| `vite.config - Copy.ts` | Yes — `vite.config.ts` | Yes, identical | Yes | Not needed |
| `capture-screenshots.mjs` | No — no corresponding tracked file | N/A, not a copy of anything | Only if you're sure you don't want it | Possibly — see note below |

**On all ten `"* - Copy.*"` files**: every single one is a byte-identical duplicate of a file already tracked in git, with a Windows-style "- Copy" suffix in the filename — consistent with an accidental drag-copy or a file-manager duplication, not intentional work-in-progress. Since they're identical to the tracked originals, no work would be lost by deleting them, and a `.gitignore` entry isn't really the right tool here (gitignore prevents future tracking, but these are already untracked and harmless sitting on disk) — this is a one-time manual cleanup (`rm` them) whenever convenient, not a recurring pattern worth a gitignore rule.

**On `capture-screenshots.mjs`**: a standalone Playwright screenshot-capture script (`import { chromium } from 'playwright'`), targeting `http://localhost:5173` and writing to `./artifacts/conversion-design/`. Its output path and purpose strongly suggest it was written to support the `feat/conversion-design-improvements` work (already merged into `main` — see below), not the CRM project. **`playwright` is not a dependency in either `package.json`** (root or `admin/`), so this script cannot currently run as-is — it would need an ad-hoc `npm install playwright` first, or was run that way previously without persisting the dependency. If this script is still wanted, it's worth either adding `playwright` as a devDependency properly or moving it to a `scripts/` folder; if not, it's safe to delete. If kept long-term, `artifacts/` (its output directory) would be worth adding to `.gitignore` so any future screenshot output doesn't get accidentally committed — but the script itself isn't a gitignore candidate.

## Branch state

- **Current branch**: `feat/admin-crm-dashboard`.
- **Branches containing the conversion-design work**: `feat/conversion-design-improvements` (exists locally and on `origin`). Its merge commit (`d42b472 merge: feat/conversion-design-improvements into main`) is already present in `main`'s history, along with the individual commits it introduced (`d8b1ba2`, `9a10a61`, and related Google Ads/conversion-tracking commits going back further).
- **Do those changes exist in `main`?** Yes — confirmed merged.
- **Does CRM work exist only on `feat/admin-crm-dashboard`?** Partially. `main` was explicitly fast-forwarded to include **Phase 1** of the CRM (application foundation, authentication, authorisation) at the project owner's request earlier in this project — `main`'s current tip is `ede579e` ("security: remove broad authenticated bookings policy"), which is exactly the end of Phase 1. `main` therefore already contains 41 files under `admin/` and 2 of the CRM's Supabase migrations (`admin_users`, the RLS policy removal).

  **Phases 2, 3, and 4 exist only on `feat/admin-crm-dashboard`** — `main` has not been updated since the Phase 1 merge. Concretely: `feat/admin-crm-dashboard` is currently 10 commits ahead of `main` (Phase 2's 5 + Phase 3's 5; Phase 4's commits will add more), `main` is a clean ancestor of the feature branch with no divergent commits of its own (a future merge would still fast-forward cleanly, same as the Phase 1 merge did), and the branch has 84 files under `admin/` versus `main`'s 41, plus 3 additional Supabase migrations (`add_crm_booking_fields`, `add_booking_search_support`, `create_internal_notes`) that only exist on the branch.

- **Other branches present** (not analysed in depth — out of scope for this report, listed for completeness): `fix/confirmation-and-ads-conversion`, `harden/booking-payment-security`, `quote-v2`, all also present on `origin` except `quote-v2`.

## Summary

Nothing here blocks or affects the CRM work. The only action this report recommends (whenever convenient, not urgently) is deleting the ten identical `"* - Copy.*"` files, and deciding whether `capture-screenshots.mjs` is still wanted.
