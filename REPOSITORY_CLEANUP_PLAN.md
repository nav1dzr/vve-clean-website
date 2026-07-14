# Repository Cleanup Plan

Written during `chore/final-production-audit-cleanup`. Every candidate below was verified against the current repository state (not assumed from memory). Nothing was deleted until this plan was complete, per the task's own rule.

Legend for **Whether removal is safe now**: `YES` (executed in this branch), `NO — manual approval required` (left in place, documented only).

---

## 1. `capture-screenshots.mjs` (repo root)

- **Why it appears unused**: A standalone Playwright screenshot-capture script (`import { chromium } from 'playwright'`), targeting `http://localhost:5173`, writing to `./artifacts/conversion-design/`.
- **Evidence**: Untracked in git (`git status` shows it as `??`, never committed). `playwright` is not a dependency in root or `admin/` `package.json` — the script cannot execute as-is. Not referenced by any `package.json` script, any import, or any build/test/deploy step. A prior housekeeping report (`REPOSITORY_HOUSEKEEPING_REPORT.md`, now itself removed as part of this cleanup — see item 3) independently reached the same conclusion.
- **Risk**: None. Deleting it cannot affect the build, tests, or any deployed artifact, since nothing references it.
- **Recommended action**: Delete.
- **Safe to remove now**: **YES** — meets every Part 6 criterion (no references, not used by any script, not required by Vercel/Supabase/Stripe, tests unaffected, build output unaffected).

## 2. `public/gallery/driveway_pressure_washing_before.png`, `driveway_pressure_washing_after.png`, `van-equipment.png` (3.7MB + 3.1MB + 2.8MB = ~9.6MB)

- **Why it appears unused**: `.webp` versions of all three now exist and are what `src/data/services.ts`/`OurKit.tsx` actually reference (added in `feat/visual-polish`). The original `.jpg`/`.png` files are still present but have zero code references.
- **Evidence**: `grep` for these three filenames across `src/` returns no matches outside the `.webp`-referencing data file's own explanatory comment. They still sit in `public/`, so Vercel still deploys and serves them at their old URLs even though nothing links to them.
- **Risk**: **These are the original, full-quality source photographs**, not generated/derived files. Deleting them is not equivalent to deleting dead code — if a different crop, higher resolution, or different compression setting is ever needed (a future marketing reprint, a different aspect ratio for a new page layout, etc.), the source would be gone for good. This is a real, if soft, cost that a purely code-reference-based "is it imported" check doesn't capture.
- **Recommended action**: Do not delete. If reducing deployment size matters, move them out of `public/` (which Vercel deploys) into a non-deployed location (e.g. a private asset archive, or simply keep a copy on the business's own storage) rather than destroying the only copy.
- **Safe to remove now**: **NO — manual approval required.** Left in place.

## 3. `REPOSITORY_HOUSEKEEPING_REPORT.md` (repo root)

- **Why it appears unused/stale**: Written during an earlier phase of the admin CRM project. Its main content (ten `"* - Copy.*"` duplicate files) has already been resolved — those files no longer exist on disk, confirmed by `git status` and a repo-wide glob. Its branch-state section is also now outdated (describes branches as unmerged that are now confirmed merged into `main`).
- **Evidence**: Read in full. Zero remaining actionable items except the `capture-screenshots.mjs` decision, which this cleanup pass resolves directly (item 1). This document is fully superseded by `FINAL_PRODUCTION_AUDIT.md` and this plan.
- **Risk**: None — it's a report, not code; nothing imports or reads it programmatically.
- **Recommended action**: Delete (superseded).
- **Safe to remove now**: **YES**.

## 4. `scripts/backfill-N15NJ310726.mjs`

- **Why it appears unused**: A one-time admin script, hardcoded to a single booking reference, whose own header comment says *"DELETE this file after successful use"* and lists deletion as its own final step.
- **Evidence**: Not wired into any `package.json` script; only runnable manually via `node --env-file=.env scripts/backfill-N15NJ310726.mjs`. No log or record accessible from this environment confirms whether it has actually been run successfully against production yet.
- **Risk**: Cannot confirm completion status without either asking the business or querying production Supabase directly — and this audit was explicitly told not to touch real customer records. Deleting a not-yet-run backfill script would be a real, hard-to-recover mistake if booking `N15NJ310726` was never actually backfilled.
- **Recommended action**: Manually confirm — in Supabase SQL Editor: `SELECT booking_ref, payment_status, stripe_session_id FROM bookings WHERE booking_ref = 'N15NJ310726';`. If the row exists with the expected payment status, delete this file. If not, keep it until it's been run.
- **Safe to remove now**: **NO — manual approval required.** Left in place.

## 5. `scripts/gen-favicons.mjs` + `public/favicon.png` (source, ~290KB)

- **Why it might look like a cleanup candidate**: `favicon.png` isn't linked from any HTML `<head>` (the generated `favicon.ico`/`favicon-16x16.png`/etc. are what's actually referenced), so a naive "is it referenced by a page" check would flag it as unused.
- **Evidence**: `gen-favicons.mjs` imports `sharp` and `png-to-ico` (both real devDependencies) and uses `favicon.png` as its source image to regenerate every favicon variant.
- **Risk**: This is an active, legitimate maintenance tool and its required input file — deleting either would break the ability to regenerate favicons if the logo ever changes.
- **Recommended action**: Keep both.
- **Safe to remove now**: **N/A — not a cleanup candidate.** Correctly in active (if infrequent) use.

## 6. `.bolt/` directory (repo root)

- **Why it appears unused**: Bolt.new project scaffolding config (`config.json`, `prompt`) from however this project was originally scaffolded. Not referenced by the build, Vite config, or any script.
- **Evidence**: No references found anywhere in `src/`, `api/`, `admin/`, or any config file.
- **Risk**: Low — purely historical, but removing tooling-vendor metadata isn't clearly "proven unused" in the same sense as a script with zero purpose; it may still be read by the Bolt.new platform if this project is ever reopened there.
- **Recommended action**: Leave as-is; not worth the (small) risk for a directory this inert.
- **Safe to remove now**: **NO — manual approval required** (low priority, not urgent either way).

## 7. `artifacts/conversion-design/` (empty directory)

- **Why it appears unused**: Empty. Was the output directory for `capture-screenshots.mjs` (item 1).
- **Evidence**: Contains no files (confirmed).
- **Risk**: None — empty directories aren't tracked by git anyway (no `.gitkeep`), so there's nothing to actually remove from version control.
- **Recommended action**: No action needed — removing `capture-screenshots.mjs` leaves this directory orphaned but harmless; git doesn't track empty directories so this requires no commit action.
- **Safe to remove now**: **N/A.**

## 8. Root `package-lock.json` / `admin/package-lock.json`

- Not a cleanup candidate — actively required, correctly tracked, no duplicates exist (the old `package-lock - Copy.json` is already gone per item 3's findings).

## 9. Test files, config files, migrations, legal docs, API helpers, attribution/consent code, CRM migrations

- Explicitly out of scope per the task's own "Do not remove" list. None were found to be unused, duplicate, or dead in any case — this is confirmatory, not a new finding.

---

## Summary

| Item | Action | Executed in this branch? |
|---|---|---|
| `capture-screenshots.mjs` | Delete | Yes |
| `REPOSITORY_HOUSEKEEPING_REPORT.md` | Delete (superseded) | Yes |
| 3 unreferenced original photos (~9.6MB) | Keep — move out of `public/` if size matters | No — documented only |
| `scripts/backfill-N15NJ310726.mjs` | Keep pending manual DB confirmation | No — documented only |
| `.bolt/` | Keep | No — documented only |
| Everything else | No action | N/A |
