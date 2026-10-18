# Gallery validation — 18 October 2026

The local gallery flow is verified from upload through database persistence to the published website. This is an isolated test-environment result, not a claim that Cloudflare, Mux or production Supabase has been tested.

## Test environment and safety

The actual repository UI and HTTP handlers ran against PostgreSQL 18/PostgREST locally. Authentication and object storage used clearly marked local adapters; image processing used Sharp. CRM: http://127.0.0.1:8871; website: http://127.0.0.1:8872. All uploads and bookings were synthetic. Production data, DNS, Stripe behaviour and prices were untouched. Cloud media, email, Telegram, Calendar and advertising providers remained disabled.

## Evidence from upload to published pages

- Uploaded JPEG/PNG fixtures through the real CRM; complete handlers saved ready assets and generated local image variants. A 1.58 MB JPEG under actual Chrome network throttling showed 1–99% progress and completed with create 201, PUT 200 and complete 200. Database evidence confirms one ready asset with the exact 1,582,381 bytes.
- Caption presets and custom title/description edits persisted. Updating an already-published caption refreshed the existing public page and survived reload. Description text supplied image alt text.
- Complete before/after selection published through the actual API; public gallery and Carpet page consumed the same managed assets. Visible images decoded with nonzero intrinsic dimensions.
- Homepage hero and equipment publication used the actual consumer positions. Both selections and captions appeared on the local homepage and survived reload.
- A simulated publication 503 before the handler preserved target/selection. The actual retry persisted PHOTO20; independent DB evidence shows exactly one assignment and one publication-history row.
- Library pagination appended the 31st asset once; public pagination expanded 20 to 22 results without duplicates. Later test publications legitimately increased the total.
- Archive/restore, used-asset archive prevention, history restoration, category/position filters and invalid pair/status guards were exercised. An injected restore 503 showed a useful error and a successful retry.
- Slow category, preview, history and publication responses did not replace a newer user selection.
- Public gallery/lightbox layouts were checked at 320/390/768/1440 px. Static MP4 keyboard Enter/Space and mobile touch playback worked; video boxes fitted all four widths without horizontal overflow.

Key evidence:
- Final supplemental mappings: `gallery-final-extra-mappings.json`
- Earlier closeout mappings: `gallery-closeout-browser-summary.json`
- Upload progress: `gallery-final-slow-upload-results.txt`
- Published caption: `gallery-closeout-caption-read-results.txt`
- Homepage consumers: `gallery-closeout-homepage-browser-results.txt`
- Carpet consumers: `gallery-closeout-carpet-consumption-results.txt`
- Publication/persistence database evidence: `final-closeout-db-query.json`
- Mobile video checks: `gallery-final-mobile-video-after-results.txt`
- Final keyboard and route cleanup: `final-review-gallery-hygiene-results.txt`
- Pagination database evidence: `gallery-closeout-pagination-db.json`

Screenshots are in D:/VVE_WORKTREES/website-final-completion/output/playwright/crm-gallery-final.

## Confirmed defects repaired

- Caption metadata preserves service/placement correctly and ignores stale category responses.
- Publication previews, history and completion feedback ignore stale target/selection results.
- Homepage image positions reject video; inactive positions cannot be offered as usable destinations merely because legacy reference rows exist.
- Pair publication rejects different nonempty job/pair keys in shared preview/publish validation. Compatible unkeyed legacy pairs remain allowed. Actual mismatched preview/publish returned 409 with no assignment/history writes.
- Archive/restore success feedback no longer survives a later failed operation.
- Public PhotoLightbox safely closes when refreshed publication data makes its selected index invalid, restoring scrolling/focus.

Affected source includes:
- D:/VVE_WORKTREES/website-final-completion/admin/api/_lib/mediaFields.js
- D:/VVE_WORKTREES/website-final-completion/admin/api/_lib/mediaAssetActions.js
- D:/VVE_WORKTREES/website-final-completion/admin/shared/mediaWebsitePositions.js
- D:/VVE_WORKTREES/website-final-completion/admin/src/pages/MediaManagerPage.tsx
- D:/VVE_WORKTREES/website-final-completion/src/components/gallery/PhotoLightbox.tsx

## Important limits and remaining work

- Actual Cloudflare R2 signed uploads, Image Worker transformations, Mux ingest/webhooks/posters/playback and Supabase-hosted Auth/RLS were not verified. Local adapters do not prove their production credentials, CORS, permissions or reliability.
- HEIC support, alpha-preserving production transforms, video codec/large-file behaviour, provider processing failures, signed-link expiry and some upload timeout/interruption phases remain unverified.
- The current product cannot clear a published position without replacement or reorder public slots. Several old standalone positions have no active website consumer; the UI now makes those unusable instead of promising publication.
- Some static gallery fallback material is outside CRM management. Only the existing supported service categories are managed. The public gallery silently falls back after a failed publication RPC; this is a usability/observability limitation.
- A known URL for an unassigned object is unlisted, not access-private. No public-facing privacy guarantee should imply otherwise.
- Unsaved caption edits can still be discarded by closing the editor. Broken image handling uses the browser fallback.
- Browser coverage is Chromium and mobile emulation, not physical-device Safari testing.
- Review-score-only changes belong to the separately approved After Builders branch and were intentionally not duplicated here; release integration must reconcile that branch.
- Two publication harness assertions used exact text that was not rendered as a standalone element. These timed out after the intended actions; screenshots and independent DB evidence provide the final result. No product defect was inferred from those assertion failures.

## Validation and deployment

Final CRM validation: **1,233 tests across 89 files passed**, TypeScript passed, lint passed with 0 errors and 1 existing fast-refresh warning. The isolated CRM build passed with the existing large-chunk advisory. Logs: final-closeout-crm-tests.log, final-closeout-crm-typecheck.log, final-closeout-crm-lint.log and final-closeout-crm-build.log.

The public source was unchanged in this closeout; its previous 2,459 passed/299 pending result was not rerun. Production was not deployed. Final route throttles and injected failures were removed; both shared fault files are empty.

## Separate booking boundary check

A dedicated TEST ONLY booking was offered, then its local fixture deadline moved into the past. The actual expiry worker's database reads/RPC were constrained to that booking only; delivery-loop and maintenance hooks were explicitly disabled. It expired once and did nothing on a second run, with every other journey unchanged.

Recording a synthetic late £30 bank deposit through the CRM put that booking into **Payment needs staff review**, with £30 paid/£70 balance, one payment row, no Stripe checkout and no sent messages. Refresh retained the review state and removed the duplicate deposit-recording action.

The staff confirmation path was then exercised through the UI using the synthetic reconciliation reason and unchanged appointment details. After refresh, the booking was confirmed and the review/deposit-record buttons were absent. Database evidence shows exactly one payment_review_resolved event and the same single £30 payment. A repeated old-revision request returned 409. A second request with the current revision, a nonempty reconciliation reason and availabilityConfirmed:true returned 400 because the booking was already confirmed. The generic response also mentions a missing reason, but this payload did contain one. Neither changed the journey. Real bank settlement, refunds and Stripe/provider reconciliation remain untested. Evidence: booking-expiry-review-worker-results.json, booking-expiry-review-bank-results.txt, payment-review-confirmed-db.json, booking-payment-review-confirm-after.txt and booking-payment-review-repeat-results.json.



## Final CRM keyboard check

Tab/Shift+Tab reached the service selector, cleaning stage, file input, library filter, caption editor, optional details, save, archive/restore, section/type filters, photo selection, preview, publish and close-position controls. Arrow/Home/End changed native selections; Enter/Space activated actions. Keyboard caption save, archive, restore, preview and publication of the existing synthetic photo to unused Sofa PHOTO14 all returned 200. Database evidence confirms one assignment and one history row, with the asset ready and the saved title intact.

The broad “Mobile/keyboard use” row remains explicitly partial: native operating-system file-picker traversal, conditional retry/processing/cancel controls in every upload phase, and every historical restoration variant were not exercised by keyboard. The tested main browser workflows passed, and prior mobile 320/390 px checks remain valid. No new product defect was found and no source was changed. Evidence: gallery-keyboard-controls-results.txt, gallery-keyboard-actions-results.txt, gallery-keyboard-db.json and gallery-keyboard-final-mapping.json.


Raw evidence files named above are preserved in the local artifact folder:
`C:/Users/navid/.codex/visualizations/2026/09/08/01a080b9-7a2b-7dd1-87e3-15320ad66890/crm-gallery-audit-2026-10-15`.
