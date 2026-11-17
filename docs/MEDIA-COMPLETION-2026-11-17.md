# CRM media completion — 17 November 2026

## Status and ownership

Implementation and local verification are complete on `codex/media-completion-20261117`, in the separate `media-completion-20261117` worktree. This starts from PR #73 at `ae13811967b8b6d481d6736a900eba6a13d7e0e1`, which includes PR #70 and production baseline `059478e14cec7ceb556864ee89a062e9d8be6ef1`. Claude's worktrees, branches and scheduled-invoice work were not edited. This follow-up has not been pushed, merged or deployed. Specific release approval is still required.

## What changed

- **See the existing website pictures:** Media → Live on website now includes a page-by-page browser of original website media and CRM-published selections. It covers Homepage, Carpet, Sofa, End of tenancy, Gallery, Commercial carpet, local pages, About and configured After Builders photos. Logos/decorative icons are intentionally excluded.
- **Know what will change:** each card identifies the page, section, full image, source and public-page link. Editable positions open the existing replacement flow. Built-in items that cannot be replaced through a gallery position explicitly say that a website edit is required. Empty After Builders sections remain hidden.
- **Safe video recovery:** uncertain Mux handoffs are recovered by lookup rather than creating another billable video. Concurrent callbacks, retries, archival and late responses use guarded state transitions. A manual **Check processing** button is available.
- **Background video completion:** a signed, environment-bound callback is implemented through the existing serverless route. It is disabled until the provider and server settings are configured; this is not yet a live capability.
- **Clear privacy boundary:** the library explains that an unpublished public-media link is still accessible to anyone who has it. Private customer evidence belongs in Completion reports.
- **Review without live changes:** a synthetic local preview uses the actual interface with replace, restore, unpublish and refresh-persistence examples. It cannot upload or contact production APIs.

Main files: `admin/src/components/media/WebsitePhotoInventory.tsx`, `admin/src/lib/websiteMediaInventory.ts`, `admin/plugins/websiteMediaManifest.ts`, `admin/src/components/media/LiveNowPanel.tsx`, `admin/src/pages/MediaManagerPage.tsx`, `admin/api/_lib/mediaAssetActions.js`, `admin/api/_lib/mediaVideoState.js`, `admin/api/_lib/mediaMuxWebhook.js`, `admin/api/search.js`, and their regression tests. Website component changes only add section anchors for accurate links. The CRM security policy adds only its own public website as a video source.

## Evidence and its limits

| Check | Evidence |
|---|---|
| Real photo/video upload | The owner-approved two-file production test recorded in `MEDIA-AUDIT-2026-11-16.md`, section 5, passed acceptance, storage, processing, captions and refresh. Both files were archived without publication. This is the earlier operator's recorded test, not a new upload by this follow-up. |
| Real Mux playback | Independently opened the archived synthetic test video in the live CRM using normal Play controls. The player advanced, reached approximately 5 seconds and showed Replay. Read-only; no media records or positions changed. |
| SQL publication lifecycle | `VVE-LOCAL-MEDIA-LIFECYCLE-20261117`: ten checks passed in a fresh localhost-only PostgreSQL 18 cluster. Four media migrations executed; complete pairs, replacement, history restoration, archive guards, anonymous-access restrictions, concurrent unpublish, transaction rollback and ready-video restrictions passed. No provider calls. |
| Browser interaction | Actual new UI with synthetic API data: replace a pair, review old/new images and affected pages, publish, refresh, restore an older pair, unpublish and check processing. Processing videos and photos were excluded from a ready-video position. These prove interface behaviour, not hosted provider publication. |
| Responsive layout | At 390×844 and 1366×1000, page filters and photos rendered with no horizontal overflow. After Builders correctly showed no configured photos. Evidence: ignored `admin/output/media-mobile.jpg` and `media-desktop.jpg`. |
| Automated regression | Website: 2,654 passed, 313 skipped, 167 files. CRM full-suite and final focused results are recorded in the release commit notes below. Both apps' TypeScript, lint and production builds passed. Existing Fast Refresh/chunk-size warnings remain; no new dependencies. |

No fresh customer emails, customer records, financial settings, cloud credentials, website media publication or production migrations were changed during this follow-up. A new signed-in browser tab worked, but logout/login was not tested. A real iPhone HEIC, long mobile-data upload and live callback delivery remain unverified; do not label these passed.

## Release and configuration gates

1. Review and obtain specific approval for the release chain: #70 → #73 → this focused follow-up. Do not merge unrelated scheduled-invoice work or enable financial flags. Check current heads and all required checks before each normal GitHub merge.
2. This follow-up creates **no database migration**. The inherited **Remove position** feature depends on `20261105120000_media_position_unpublish.sql` and `MEDIA_POSITION_UNPUBLISH_ENABLED=true`. Apply/enable only with the owner's explicit production exception and after verifying its current status. The unrelated payment-allocation migration is not required for this media feature.
3. For background completion, configure the CRM's existing Mux environment to call `https://admin.vveclean.co.uk/api/search?resource=media-mux-webhook` for created/ready/errored asset events. Securely set `MUX_WEBHOOK_SIGNING_SECRET` and `MUX_WEBHOOK_ENVIRONMENT_ID` in CRM Production. Never put values in the repository or logs. Hosted testing needs a separate provider environment and matching preview isolation settings. Details: `MEDIA-VIDEO-RECOVERY-2026-11-17.md`.
4. Monitor both deployments after approved merges. Verify live Media inventory, public website fallbacks and existing archive playback. A new cloud upload/publication/callback test needs a separately approved synthetic record scope; no customer photo should be used by default.

## How Navid uses it

1. Open **Media → Live on website**, then choose the page to find its current photograph.
2. Choose **Manage this position** where offered. Otherwise the card explains whether to choose a first service result or request a website-file change.
3. Upload to the appropriate service; add a suggested or custom caption and description. Wait for **Ready to use**; for a video use **Check processing** if needed.
4. Select a photo, complete before/after pair, or ready video in a matching position. Choose **Preview affected pages** and inspect the old/new selection before publishing.
5. Use **Previous versions** to preview a restoration. Removal hides a position but keeps original files and history; availability depends on the approved removal feature configuration.

Local preview: `http://127.0.0.1:8963/`. Reproduction commands and isolation details are in `admin/dev/media-review/README.md`. Disposable SQL runner: `scripts/validate-media-lifecycle-local.mjs --run`.

## Deferred improvements, not completed claims

- Resumable large-video uploads; current upload retries start again from zero.
- Real-device HEIC/orientation and large-mobile-video verification.
- Replacing every built-in website photo directly from CRM would require additional connected positions; inventory now makes the distinction explicit.
- Legacy `website_visible` flag/reference cleanup, branded media delivery hostname, library-wide search and a public-feed health indicator remain optional follow-ups from the earlier audit.
- Archived test originals remain stored. No irreversible R2/Mux deletion was performed.
- A historical ambiguous provider handoff with no matching asset must be checked by an operator; absence from a bounded lookup is never treated as permission to create another paid asset.

## Final validation record

Final CRM run after the last concurrency guard: **115 files, 1,551 tests passed** (`admin/output/crm-tests-release.log`). Website: **167 files, 2,654 passed, 313 skipped** (`admin/output/website-tests.log`). SQL: **10 passed, 0 failed** (`admin/output/media-lifecycle-1794877089732/result.json`). Both apps' type checks, lint and builds passed; CRM lint retains one existing Fast Refresh warning, website lint retains seven existing Fast Refresh warnings, and the builds retain their chunk-size notices. Final `git diff --check` passed. Generated screenshots, logs and disposable cluster files are excluded by `/admin/output/` in `.gitignore`.
