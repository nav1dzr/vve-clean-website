# Media implementation validation — 8 September 2026

## Delivered

- Upload once to the private library, classify by service and before/after/during/general stage, edit visible captions and accessibility descriptions, and preview every page using a numbered position.
- Complete before/after replacement is a single database transaction; the reviewed previous selection is checked before writing. History permits previous-version review and rollback. Archiving cannot remove an in-use asset and retains the original for restore.
- Twenty work-photo positions, five comparisons and four video positions per service; library loads thirty items per page and independently includes assets used by current positions.
- Transfer percentage, cancellation, no-progress timeout, bounded file sizes, recoverable saved records and retry. A completed original is processed without uploading again. Conditional R2 writes prevent an old signed URL overwriting an existing original.
- Supported 768px CRM thumbnails; image/video configuration checks separated; original content type/size and image delivery verified before ready. Video polling and recovery from an uncertain Mux handoff. Managed videos create a player only after Play is selected.

## Validation performed

- Admin typecheck and targeted ESLint passed.
- 28 focused admin tests passed across publication/authentication, metadata, pagination/upload plans, image provider configuration, interrupted transfers and retained UI errors.
- Five public tests passed across managed pair assembly, no half-pairs, responsive image sizes and click-to-play video.
- Both SQL migrations executed in an isolated local PGlite PostgreSQL runtime. Real SQL calls verified complete pair publication, shared Gallery/service references, stale-update rejection, historical rollback, in-use archive rejection, archive/restore, anonymous write denial and safe public reads.
- Reproducible runner: `admin/tests/mediaDatabase.integration.mjs`. No external database or cloud assets were accessed by this runner. Install `@electric-sql/pglite` into a temporary tools folder, set `PGLITE_MODULE` to its `dist/index.js` file URL, then run `node admin/tests/mediaDatabase.integration.mjs`. The database is created in memory; the runner creates its own test roles and admin fixture. No application credentials are read.

## Owned files

- `admin/api/_lib/mediaAssetActions.js`, `mediaCollectionActions.js`, `mediaConfig.js`, `mediaFields.js`
- `admin/src/pages/MediaManagerPage.tsx` and its test; `admin/src/types/media.ts`
- `admin/src/lib/mediaUpload.ts` and its test
- `admin/tests/mediaDatabase.integration.mjs` (isolated SQL runtime runner)
- `admin/tests/mediaAssignmentPublication.test.js`, `mediaCollection.test.js`, `mediaConfig.test.js`, `mediaFields.test.js`
- `src/lib/managedGalleryMedia.ts` and its test
- `src/components/media/ManagedVideo.tsx` and its test; `ManagedServiceMedia.tsx`
- `src/components/gallery/VideoTile.tsx`
- `supabase/migrations/20260908110000_media_publication.sql`
- `admin/MEDIA_SYSTEM_SETUP.md`

## Integration and truthful limits

Apply the new SQL only to the approved isolated preview first. CRM auth and the existing `media_*` namespace remain authoritative; public reads remain `public_media_references`. Resource routing remains `/api/search?resource=media`.

R2 browser PUT CORS must include **Content-Type** and **If-None-Match**. No cloud configuration was changed. Actual JPG/HEIC/MOV uploads, browser media rendering and configured provider readiness require preview verification. The service pages must consume the existing shared reference page keys; the root design work owns those placements and the public Gallery pagination.

Retry restarts an interrupted file, not byte-range resume. Video polling works while the manager is open; no provider webhook is added. Uncertain video handoffs reconcile the most recent 100 Mux assets by passthrough ID and require provider investigation if an older record cannot be found. Original media is never deleted by archive. No production mutation, upload, customer email, commit or staging was performed by this subtask.
