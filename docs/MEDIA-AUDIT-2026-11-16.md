# CRM photo and video audit — 16 November 2026

Branch `claude/media-audit-clarity-20261116`, stacked on `codex/crm-completion-review-20261114` (PR #70, head `b3037fd`), which already changes the media manager. Production `main` was `059478e` when this was written.

Nothing in this work touched production settings, Stripe, bookings, invoices, prices, DNS or advertising. No migration was created or applied. The only production change was the owner-approved two-file upload test on 17 November (section 5): two synthetic, labelled files in the Carpet library, never published, then archived.

**The owner's request arrived cut off** part-way through step 3 (after "7. Correct"). Everything below covers sections 1–2 and the part of section 3 that was received.

## 1. Short version

- The upload-to-website chain works in production today. I checked it from the outside, read-only: the live site shows one end-of-tenancy before/after pair and one sofa video from the CRM library, and both are delivered correctly.
- The weak point was the CRM screen, not the plumbing. It could not answer "what is live?" on one screen, replacements were picked from a text list of file names, and the final review step named pages but did not show the old picture against the new one. This branch fixes those.
- Real upload test **passed** on the live CRM (owner-approved production exception, 17 November). A synthetic photo and a synthetic 5-second video uploaded, processed, showed correct thumbnail and poster, survived a refresh, took edited captions, and could be previewed for a position. Nothing was published, the public website was unchanged, and both were archived (section 5).
- Several deeper issues are recorded but deliberately not changed, because they need a decision, a migration or a provider setting (section 4).

## 2. What each deployment uses

| Item | Finding | How it was checked |
|---|---|---|
| Live website database for media | Supabase project `temlphabsqukkiqmrvhl` only. No second media project is referenced. | Downloaded the live site's public JavaScript and searched it. **Verified.** |
| What is published now | 9 public rows = 1 end-of-tenancy pair (`BA01`, "Kitchen hob") and 1 sofa video (`VIDEO01`, "Armchair cushion clean"), each repeated across its gallery page, service page and an older unused page key. | Called `public_media_references()` anonymously, exactly as a visitor's browser does. **Verified.** |
| Photo delivery | `vve-media-preview.navidz7111.workers.dev`. Returns AVIF, 480 px ≈ 19–27 KB, 2400 px ≈ 270–620 KB, cached for one year per file. Odd sizes and raw-original paths return 404. | Fetched the published photos. **Verified.** |
| Video delivery | Mux poster and stream both respond. Highest rendition offered for the live video is 960×540. | Fetched poster and playlist. **Verified.** |
| CRM production database | The live CRM at `admin.vveclean.co.uk` names the same project, `temlphabsqukkiqmrvhl`, and no other. | Downloaded the live CRM's public JavaScript. **Verified.** |
| R2 bucket | `vve-media-originals` in `cloudflare/media-preview-worker/wrangler.toml`. The September record (`docs/website-completion-2026-09-08/cloud-connections.md`) found one bucket, one Worker and one Mux environment ("website"), then used for previews. Production photos now come from that same Worker, so production very probably uses that same bucket. A separate test bucket is not known to exist. | **Inferred, not verified.** |
| Mux environment | September record shows a single environment, "website". Whether a separate test environment exists now is unknown. | **Unverified.** |
| Project "OS" (`spbrstpxrimuuorkbsbo`) | Named in `previewIsolation.js:4` and blocked for previews unless explicitly allowed. The September record found it healthy and in use by another system. Not touched, and not to be repurposed. | Code and earlier record. |
| Test database "VVE TEST" (`xzacwohfeabpfadapcjz`) | Recorded in September as paused; Supabase refused to resume it because both free project slots are in use. | Earlier record; **not re-checked.** |
| Private customer material | Completion-report files use a separate private Supabase Storage bucket, `cleaning-reports-private` (`admin/api/_lib/completionReports.js:9`). Website media uses R2. They do not share storage or tables. | Code reading. **Verified in code.** |

To close the unverified rows I need you to open the Vercel environment-variable list for `vve-clean-crm` (names and which environment each applies to — not the values), and the R2 and Mux dashboards.

## 3. How the journey works (traced in code)

1. **Sign-in and permission.** Every media request goes through `admin/api/search.js:30` and the normal CRM admin check (`adminAuth.js:36`). Anyone in `admin_users` has full media rights; there are no separate staff roles. Browser access to the media tables is closed; verified locally that an anonymous user cannot read them or publish.
2. **Upload.** The CRM creates a private record, then the phone sends the file straight to R2 with a 15-minute link (`mediaCollectionActions.js:229`, `mediaConfig.js:84`). Limits: 40 MB per photo, 500 MB per video; JPEG, PNG, WebP, AVIF, HEIC/HEIF, MP4/M4V, MOV, WebM (`mediaFields.js:1-56`). Progress, a 60-second stall timeout, cancel and retry exist (`admin/src/lib/mediaUpload.ts`).
3. **Processing.** Photos: the server checks the stored size and type, then asks the Worker for a 480 px version before marking it ready (`mediaAssetActions.js:290-350`). Videos: handed to Mux, then polled every 12 seconds while the page is open (`MediaManagerPage.tsx:258-292`).
4. **Details.** Caption, description, service and stage. Service and stage are locked while a file is published (API and database trigger; verified locally).
5. **Publishing.** Choose a position, preview affected pages, publish. A pair is swapped in one transaction; a stale review is refused; history is kept (verified locally against all four media migrations on a throwaway PostgreSQL 18 database).
6. **Website.** Pages ask Supabase for published media on every load and whenever the tab regains focus (`src/lib/managedGalleryMedia.ts:60-78`). There is no cache in between, so a change appears on the next page load. If that request fails, pages silently show their built-in photos.

## 4. Findings

### Confirmed and fixed in this branch

| # | Problem | Evidence | Fix |
|---|---|---|---|
| F1 | No single view of what is live. You had to pick a service, a tab and a position type, and status read "ready · Used in 2 places" without naming the places. | Previous `MediaManagerPage.tsx` library card and tabs. | New **Live on website** tab listing every live position for all services, with pictures, captions, file names, pages, "live since" date and a Replace button. A count and shortcut sit above the tabs. Library cards now say **Live on website** or **Not on website** and list the pages. |
| F2 | Replacements were chosen from a dropdown of "caption — file name". | Same file, position panel. | Thumbnail picker beside the dropdown, marking the picture that is "In this position now". |
| F3 | The last step before publishing listed pages but did not show old against new. | Same file, review block. | Side-by-side **On the website now** / **After you publish**, with a plain sentence saying what will happen. |
| F4 | An unsuitable file failed with one general message that did not name the file, and stopped the files queued after it. | `mediaFields.js:74-92`; upload loop in the page. | Files are checked when chosen. Each problem file is named with its reason; suitable files still upload. |
| F5 | A HEIC or MOV file was rejected as "unsupported" when the browser reported no file type (seen on some desktop browsers). | Page sent `file.type`; `mediaFields.js:67-73`. Confirmed by unit test, not on a real phone. | The type is worked out from the file extension and used consistently for the record and the upload. Server rules unchanged. |
| F6 | Library filter used internal words and could not show half-finished uploads. | Previous filter list. | Plain labels; "Needs attention" includes unfinished uploads; new "Live on website" filter. |
| F7 | Shared position cards did not say whether they were live or empty. | `SlotCard`. | Each card shows "Live on website since …" or "Empty". |

### Confirmed, not changed — need your decision

| # | Problem | Evidence | Why not changed |
|---|---|---|---|
| N1 | **A video can stick at "processing" for good.** If the request to Mux times out after the record is claimed, there is no Mux ID. The retry button is not offered for processing items and the server returns early. Recovery only works if Mux did receive the request and it is among Mux's latest 100 items. | `mediaAssetActions.js:273, 357-381, 428-453`; page retry buttons shown only for uploading/failed. | A safe retry must avoid creating (and paying for) duplicate Mux videos. Needs a short design and a real Mux test. |
| N2 | **Videos only finish while the Media page is open** on the right service, visible, and not mid-edit; five at a time. Close the tab and the video stays "processing" until you come back. | `MediaManagerPage.tsx:258-292`. Already noted as a limit in `admin/MEDIA_SYSTEM_SETUP.md`. | Proper fix is a Mux webhook; the CRM is at its 12-function limit and it needs a provider setting. |
| N3 | **"Unpublished" does not mean "private".** Every uploaded video gets a public Mux playback ID at upload, and the Worker will serve any stored photo to anyone who has its ID. IDs are random and are not listed anywhere until published. | `mediaAssetActions.js:376`; `cloudflare/media-preview-worker/src/index.js:46`. | Low risk, but please never upload private customer material here. Tightening needs provider changes. |
| N4 | The `website_visible` flag stays on after a file is replaced or removed. It does not expose anything (the public function requires a live position — verified locally) but the flag cannot be trusted. | Local database check, step 5. | Needs a migration. |
| N5 | Publishing writes each item to an older page key that no page reads (`carpet-page`, `sofa-page`, `end-of-tenancy-page`). It shows as "older page reference" in lists. | Live public rows; `MediaManagerPage.tsx:51-58`. | Tidying needs a migration against production data. |
| N6 | Production photos are served by the Worker named "preview" on a `workers.dev` address, and that address is stored inside each photo's database record. | Live check; `mediaAssetActions.js:335`. | It works. Moving to a branded address later means updating stored records, so decide before the library grows. |
| N7 | Large videos on mobile data: the upload link and timer last 15 minutes and a retry starts again from zero. A 500 MB file needs roughly 4.5 Mbps of steady upload. Leaving the page cancels the upload. | `mediaConfig.js:93`; `mediaUpload.ts:41`; `MediaManagerPage.tsx:234`. | Resumable upload is a larger change. |
| N8 | No delete. Files can be archived, never removed, from the CRM. Originals stay in R2 and videos stay in Mux. | `archive_media_asset` in `20260908110000_media_publication.sql`. | By design; relevant to test clean-up (section 5). |

### Recommendations (smaller)

- Show pictures, not just dates, in "Previous versions" (`MediaManagerPage.tsx:1025`).
- The library loads 30 items per service and filters only what is loaded (`mediaCollectionActions.js:81`). Add search once the library grows.
- `admin/vercel.json:30` still allows `storage.googleapis.com` for a Mux direct-upload route the code does not use. Remove after confirming.
- `admin/MEDIA_SYSTEM_SETUP.md` describes an older screen ("choose a destination", "Refresh processing", 6/20/10 positions) and calls the Worker Preview-only. Rewrite once the environment questions are answered.
- When the website's media request fails, pages fall back to built-in photos with no signal to you. A simple health line in the CRM would help.

### Unverified

- Photo orientation from phone EXIF data, and cropping on each public page at phone width, with a real phone photo.
- HEIC conversion by Cloudflare with a real iPhone file.
- Whether the live video's 960×540 ceiling is the source file or a Mux plan limit.
- R2 CORS rules for the production CRM address.
- The parts of section 5 marked "not covered" (publishing, replacing, retry, iPhone HEIC, large video on mobile data).

## 5. Real upload tests

**Status: run on 17 November 2026 on the live CRM** (`admin.vveclean.co.uk`, production `main` `059478e`) under the owner's narrow production exception, after he signed in himself. An isolated environment was tried first but this PC has no Docker. The test used the live screen, not the new screen from this branch.

**Test files.** The built-in browser cannot drive a file picker, so the two files were drawn inside the page (a canvas photo and a canvas-recorded video) and placed in the CRM's normal file field, as automated browser tests do. Everything after that used the normal buttons and routes. The content matches the prepared fixtures: navy background, red band reading "VVE MEDIA TEST / NOT CUSTOMER WORK".

- `vve-media-test-photo.jpg` — JPEG, 1600×1200, 70 KB. CRM id `b2e4e8ae-abfd-4948-9c6a-aaf597e48b28`.
- `vve-media-test-video.mp4` — browser-recorded MP4 (H.264), 1280×720, 5.00 s, 101 KB.

| Check | Photo | Video |
|---|---|---|
| 1. File selection and validation | **Pass** — accepted, "1 files waiting". | **Pass**. A playback check inside the CRM page was blocked by the CRM's own security policy (`blob:` video not allowed); Mux processing below confirms the file. |
| 2. Upload and saved record | **Pass** — card appeared, Carpet, Unassigned. | **Pass** — card appeared as "processing". |
| 3. Processing completes | **Pass** — "ready" within about 8 seconds. | **Pass** — "ready" within about 30 seconds while the page was open. |
| 4. Correct thumbnail / poster | **Pass** — Worker returned the 768 px thumbnail (768×576, correct 4:3, uncropped) and a 1200 px JPEG; viewed and correct. | **Pass** — Mux poster correct (viewed); stream 5.00 s, renditions 1280×720, 854×480, 480×270. |
| 5. Reopen after refresh | **Pass** — present with thumbnail after reload. | **Pass**. |
| 5b. … and after signing in again | **Not tested** — I do not sign the owner out. | Not tested. |
| 6a. Edit title and description | **Pass** — saved "VVE MEDIA TEST — NOT CUSTOMER WORK (photo)"; still there after reload. | **Pass** — same, "(video)". |
| 6b. Placement | **Pass, preview only** — Carpet "Work photo 20" offered the test photo and not the video; "Preview affected pages" listed Carpet Gallery · Work photo 20. Publish was **not** pressed; the selection was discarded by reloading. | Not tried (a video position would be the same flow). |
| 7. "Correct…" (text cut off) | Awaiting the rest of the request | — |

**After the test**

- Public website media list (`public_media_references()`): 9 rows before, 9 rows after, byte-for-byte identical; no test title in it.
- Both test files archived through the normal button; both show **Restore**.
- What remains, by design: two archived CRM records, two originals in R2, one Mux video with a public but unlisted playback ID (`R01gb01cfcd2YFSmviNSNLAGycSiVOwcVCgaDNuxW02zrA`). Remove by hand in the R2 and Mux dashboards if wanted.
- **Found during the test:** the Carpet library already held two earlier test items from 21 October 2026 ("TEST ONLY - photo/video upload check", `VVE-TEST-20261021-*`), ready and unassigned. So a real upload had been tested before. They were left untouched; consider archiving them.

**Not covered by this test:** publishing, replacing a live pair, history restore, interrupted upload and retry, HEIC from an iPhone, a large video on mobile data, and the new screen in this branch (it is not deployed).

What was also checked, and what it does and does not prove:

- **Live read-only check** (section 2): proves the production chain delivered real photos and a real video.
- **Local database check**: all four media migrations applied to a throwaway PostgreSQL 18 database; publish, stale-review refusal, pair replacement, label guard, archive guard, removal, history and anonymous access all behaved as designed. Does not involve R2, the Worker or Mux.
- **Synthetic screen check**: the new screens were opened at phone width (375 px) with made-up data and no network access; no sideways scrolling. Does not involve the real API.

### Routes that were considered

The owner first chose A, then B on 17 November because Docker was not available on this PC.

**A. Isolated environment.** Then every step, including publishing and replacing, can be tested with nothing public. It needs four things that only the owner can create or approve:

1. **A test database.** The free plan allows two active projects and both are in use, so "VVE TEST" cannot be resumed as things stand. Either move Supabase to a paid plan and resume it, or run a local test database on the office PC (needs Docker Desktop and the Supabase tool installed).
2. **A test R2 bucket** with its own access key, and a second copy of the image Worker bound to it. The existing bucket and Worker appear to be the production ones.
3. **A separate Mux environment** with its own token.
4. **Preview settings** on the CRM Preview for this branch: the test database address and keys, the test bucket, Worker address and Mux token, the three matching `VVE_PREVIEW_…` declarations, a test inbox, and `VVE_PREVIEW_ISOLATION_APPROVED=true`. Full list: `docs/website-completion-2026-09-08/deployment-isolation-readiness.md`. The R2 upload rule must also list the preview address.

**B. Narrow production exception (used).** Upload exactly two labelled files to the Carpet library through the normal CRM screen, run checks 1–6, and **publish nothing**. Limits agreed beforehand:

- "Placement" in production means publishing, so I would stop at "Preview affected pages" and not press Publish.
- The files cannot be deleted from the CRM. After the test they would be archived. Two records, two R2 objects and one Mux video would remain until removed by hand in the dashboards.
- The Mux video would have a public but unlisted playback address (N3).

## 6. What changed in this branch

Screen and browser logic only, plus one read-only field in the list response. No new route, no migration, no environment variable, no change to publishing rules.

- `admin/src/pages/MediaManagerPage.tsx` — Live tab, live count, status badges, thumbnail picker, comparison, file checks, filter labels.
- `admin/src/components/media/` — `MediaPreview.tsx` (moved out of the page, plus status badge), `MediaThumbnailPicker.tsx`, `ReplacementComparison.tsx`, `LiveNowPanel.tsx`.
- `admin/src/lib/mediaFileCheck.ts`, `mediaStatus.ts`; `mediaUpload.ts` takes the checked file type.
- `admin/api/_lib/mediaCollectionActions.js` — each position now reports `publishedAt`.
- `admin/src/types/media.ts` — optional `publishedAt`.
- Tests: `MediaManagerPage.clarity.test.tsx`, `mediaFileCheck.test.ts`, additions to `mediaUpload.test.ts`, `tests/mediaCollection.test.js`, and `tests/mediaUploadFixtures.test.js`.

## 7. Validation (run in `admin/`)

| Command | Before | After |
|---|---|---|
| `npm run lint` | 0 errors, 1 warning (`InvoiceItemsForm.tsx:67`, existing) | Same |
| `npm run typecheck` | Pass | Pass |
| `npm test` | 107 files, 1,475 tests pass | 110 files, 1,492 tests pass |
| `npm run build` | Not run before | Pass, with Vite's large-chunk notice (not compared with the baseline) |

Root website checks were not run: no root file changed.

## 8. Risk and rollback

- Risk: low to medium. One busy screen changed; publishing rules, database functions and storage are untouched. Existing media tests pass unchanged.
- Depends on PR #70. Merge #70 first, then retarget this pull request to `main`.
- Rollback: revert this branch's commit(s). Nothing to undo in the database or providers.
