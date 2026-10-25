# Website and CRM follow-up — first implementation batch

25 October 2026. Local implementation on `feature/website-final-completion` in `D:\VVE_WORKTREES\website-final-completion`. This records the first batch authorised by Navid to start the remaining work. It does not mark the full October audit plan complete.

## Ready locally

| Area | Change | Main files |
|---|---|---|
| Booking basket | Preserve the latest selection when storage writes fail but reads still succeed; do not revive an old basket after a failed removal. | `src/lib/quoteBasket.ts` |
| Resume a quote | Restore the calculator without reloading the document, retain a memory-only basket during client navigation, preserve same-page campaign parameters and reset the homepage service choice correctly. | `src/components/BasketButton.tsx`, `src/components/QuoteCalculator.tsx` |
| Quote buttons | Repeated clicks to the current quote anchor scroll/focus again; query-only gallery tab navigation keeps keyboard focus. | `src/components/ScrollToTop.tsx` |
| Homepage services | After Builders is a fourth main service card with its own enquiry link. Existing photos and pricing values are preserved; its graphic is not presented as a job photo. | `src/components/Services.tsx` |
| Work queue | Completed and cancelled jobs stay out of Today, Upcoming and Unscheduled. Recent history and financial counts remain unchanged. No-show jobs remain available for follow-up. | `admin/api/dashboard-summary.js`, `admin/src/pages/DashboardHome.tsx` |
| Booking guidance | Completed/cancelled bookings show their actual state instead of introducing a new confirmation/deposit task. | `admin/src/components/BookingJourneyPanel.tsx` |
| Media positions | Current service-page positions and older stored references have distinct names. | `admin/src/pages/MediaManagerPage.tsx` |
| Media edits | Warn before discarding caption/detail edits through Close, another asset, service or tab; protect document reload while dirty and prevent closing while busy. | `admin/src/pages/MediaManagerPage.tsx` |
| Gallery delivery | Failed photos retain a descriptive layout; the enlarged viewer offers a retry. No invented replacement result. | `src/components/gallery/GalleryPhoto.tsx`, `GalleryResultCard.tsx`, `BeforeAfterTile.tsx`, `PhotoLightbox.tsx` |
| Manual review request | Customer records and completed-booking customer choices open the existing email composer with a review-template option. The owner confirms completed real work, checks the recipient, previews, then explicitly sends. A separate Copy Google review link action sends nothing. | `admin/src/pages/CustomerDetailPage.tsx`, `BookingDetailPage.tsx`, `CustomerEmailPage.tsx`, `admin/src/components/BookingCustomerSection.tsx`, `CopyReviewLink.tsx`, `admin/src/lib/reviewRequestDraft.ts`, `admin/api/_lib/customerEmailTemplate.js`, `shared/googleReview.js` |

Review wording is neutral, editable and uses the supplied full name, including initials/surname. A fixed branded review button uses the existing public URL. The template does not automatically choose recipients, create customer relationships, or send on completion/payment. Existing email sending, server idempotency and history are reused. Opening a different saved draft clears any previous permission to replace a working draft.

## Validation

- Website full suite: **2,673 passed, 311 skipped, 167 files passed**. The skip count comes from existing conditional source-inventory checks and previously skipped tests; this batch added no skips.
- CRM full suite: **1,312 passed, 96 files passed**.
- Website and CRM TypeScript, lint and production builds passed. Final website hook-dependency cleanup was followed by affected route/basket tests, full lint/typecheck and another build. Remaining lint warnings are pre-existing Fast Refresh warnings (website 7; CRM 1). Existing bundle-size warnings remain.
- The full website run includes the pre-existing, uncommitted operator-validation tests. They are not part of this batch's commits.
- Initial runs caught an outdated three-card test and a genuine query-only gallery focus regression. Both were corrected; the full website run above passed afterwards.
- Local Chromium checks: blocked-storage carpet selections survive basket resume and request/back navigation; the existing two-bedroom move-in plus bedroom-carpet/hallway bundle retained its £349 estimate on return. These are tests of existing prices, not changes to pricing.
- Homepage service cards checked at 320, 390 and 1280 pixels. All cards fit the viewport, and the builders link reached `#builders-quote`. Clipped offscreen content makes document scroll width an unsuitable blanket no-overflow assertion; horizontal wheel checks did not move the viewport.
- Media checks used synthetic fixtures with external requests blocked. Caption discard cancellation retained text; deliberate discard closed the editor. Position choices were distinct on the 390-pixel layout.
- No real booking submissions, customer emails, Telegram alerts, payments, media publications or production database writes were performed.

Local evidence (excluded from commits):

- `output/audit-followup-20261025/website-verified-*.log`
- `output/audit-followup-20261025/website-final-hook-*.log`
- `output/audit-followup-20261025/crm-final-*.log`
- `output/playwright/booking-reliability-summary-20261025.txt`
- `output/playwright/services-{320,390,1280}-20261025.png`
- `output/playwright/media-usability-editor-390.png`
- `output/playwright/media-usability-positions-390.png`
- Synthetic rendered email: `C:\Users\navid\.codex\visualizations\2026\09\08\01a080b9-7a2b-7dd1-87e3-15320ad66890\audit-followup-20261025\Review-email-preview.html`. The app rejected opening this local HTML URL, so this is a saved rendering artifact plus template-test evidence, not a completed visual email-client check.

## Limits and remaining work

1. **Release this batch separately.** It is local, not live. The branch has an earlier private Ads-validation commit (`6b59a35`) that remains closed/unpublished. Do not push or deploy the combined branch. Isolate the customer-facing commits from that ancestor onto a verified live baseline for release review, then obtain the specific release approval required by `AGENTS.md`.
2. **Finish the separate Ads/GA4 verification.** This batch does not activate reporting, submit validation events, edit bindings, change Google settings, or demonstrate live delivery. Keep its existing bounded approval and evidence process separate.
3. **Complete broader booking usability checks.** Mixed carpet/upholstery still shares one condition choice; changing that requires an explicit pricing/product decision. Existing EOT added-room regression tests passed, but the entire live device/service matrix was not repeated here. Fully blocked storage cannot survive a browser reload; client-side navigation now preserves its in-memory selection.
4. **Manual review shortcut is not full review-campaign tracking.** It warns from the latest 20 composer records only. Durable per-job/cross-device history, deliberate resend controls and a separately enabled dedicated review action remain planned. The existing review URL was reused unchanged; external destination resolution and an approved real inbox test remain release checks.
5. **Finish media navigation protection.** Dirty-edit protection covers the media controls and document reload, not the CRM sidebar/back navigation. Cross-route draft recovery, true unpublish with affected-location preview and bulk metadata editing remain planned. This batch does not retest R2/Mux production uploads.
6. **Design financial corrections and reconciliation before implementing them.** Manual bank-deposit correction and booking-payment/invoice allocation must preserve original records, prevent duplicate allocation, retain an audit trail and handle retries/refunds. Existing invoice warnings do not reconcile money. No financial state changes are included here.
7. **CRM workflow improvements remain.** Enquiry-to-booking drafts, explicit customer relationships, clearer service/status filters, unified delivery history, safe sign-in return routes and staff permissions need separate batches. Check current code before treating older plan items as still missing.
8. **Website presentation remains a later batch.** Improve the first-screen story, contextual genuine photos and service-specific proof after this reliability release. Real After Builders photos still need the owner's media. No new prices, reviews, guarantees or stock results were invented.
9. **Calendar stays deferred.** No Google Calendar configuration changed.

## Recommended next sequence

1. Review and release these customer-facing reliability changes using a clean release candidate.
2. Finish the separate measurement verification with its approved controls.
3. Complete CRM navigation/state clarity and enquiry conversion, then design the financial reconciliation workflow as its own reviewed phase.
4. Apply the next website visual/content phase using real media and the agreed service/pricing rules.

## Saved implementation commits

- `41cee0f` — quote basket recovery, navigation and homepage service card.
- `770b9df` — media edit protection, position names and gallery photo fallback.
- `5e2a638` — manual review email shortcut and draft protections.
- `0608e84` — active work queues and completed/cancelled guidance.

These are focused local commits. Unrelated existing operator-validation changes, scripts and generated output were left untouched and unstaged.

Older details and acceptance criteria remain in `docs/CRM-IMPROVEMENT-PLAN-2026-10-18.md`. Its original “not released” labels are historical; use the release evidence for those older commits and this document for the current batch. No claim is made that every earlier task is now finished.
