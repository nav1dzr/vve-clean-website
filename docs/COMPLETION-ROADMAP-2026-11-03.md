# VVE website and CRM completion roadmap

Updated 5 November 2026. This reconciles the October website PDF, website HTML audit, advertising handoff and CRM audit with releases through PR #62. Historical "not released" labels in older plans are not current status.

## Delivery rules

Work on feature/website-final-completion. Preserve unrelated work. Each phase has a focused diff, relevant automated and isolated browser checks, a reviewable result and a specific release approval before push/merge/deployment. Production financial data and schema changes require their own explicit exception. No price, deposit or Stripe change is part of this roadmap.

A useful staged improvement is not a claim that its entire phase is complete. Local tests, live source verification, provider acceptance and actual Ads attribution are different evidence.

## Completed baseline

- Accepted Phase 1–3 booking storage, selection, mobile CTA, copy, trust and funnel source improvements retained.
- After Builders page and approved guides, with a fourth homepage service card.
- CRM booking/offer email, manual deposit/no-deposit choice, document/cleaning-record and recovery work.
- PR #51: media current-position/built-in preview and live video playback verified.
- PR #57: basket recovery, media caption discard/reload protection, distinct position labels, image fallback, manual review composer shortcut, active work queues and verified rating snapshot.
- PR #59: expired diagnostic removed.
- PR #60: Telegram property address, safe sign-in return and network recovery.
- PR #62: website request-only, consented click-ID reporting. Production enabled 3 November; no genuine postcutoff request receipt/attribution observed at the last bounded check. Deposit and CRM reporting remain disabled.

## Phase 1 — Payment clarity and reconciliation (highest priority)

### 1A: Payment review — implemented locally

Problem: the draft-only booking balance warning disappears after invoice issue. It does not display authoritative money received/refunded, and separate records can lead to recording the same money twice.

Deliver:
- Show booking received/refunded/retained totals beside the saved invoice deposit, payments and amount due.
- Include deposit-only and fully refunded bookings; refresh and retry controls.
- Cover new/saved drafts and current issued invoices.
- Never sum the capped 50-row booking history into a complete total. Use authoritative journey counters.
- Never infer a match or transfer from equal amounts, customer details or references.
- Missing/invalid data means unavailable, never zero. Protect against stale responses from another booking/account.
- No payment mutation, email, PDF alteration or new backend/database behavior.

Acceptance: mocked deposit/balance/refund/failed-read/stale-response tests; issued-invoice regression; CRM types/lint/build/full suite; mobile/desktop synthetic component review.
Files: admin/src/components/BookingBalancePaymentNotice.tsx; admin/src/lib/bookingPaymentReview.ts; admin/src/pages/InvoiceDetailPage.tsx; related tests.
Status: released through approved PR #63, merge 7264263. Both production deployments verified Ready on that source; CRM live bundle contains the new review panel.

Validation: 107 focused tests passed, then the full CRM suite passed with 1,317 tests and zero failures. TypeScript/lint/build passed; one existing Fast Refresh warning and the existing bundle-size warning remain. Synthetic component browser checks verified desktop, 390px layout, full refund and unavailable/retry states. No production provider or customer action was performed. The complete payment allocation/correction workflow remains Phase 1B.

### 1B: Apply a recorded booking balance

The CRM review and transaction are implemented locally. The owner can apply a single recorded balance payment to settle its linked invoice and create its paid receipt. The workflow checks prior credits and requires confirmation of the original references. See BOOKING-INVOICE-ALLOCATION-DESIGN-2026-11-03.md for eligibility, validation and the release gate.

Partial and split payments, manual bank-entry correction and refund reconciliation remain separate work. Production release requires specific written approval and an exception for the additive migration.

## Phase 2 — Daily CRM workflow

### 2A — Booking list and customer intake

Local implementation for review. Booking filters group current quote types and known older labels, with an exact-match fallback for saved filter links. The Bookings list defaults to customer records and offers a separate view for explicitly marked tests. The appointment column and internal job filter now explain their distinct meanings.

Manual booking drafts retain the chosen contact channel (including phone and Checkatrade) separately from marketing attribution and keep the owner's explicit payment choice. Older manual records with no channel keep a generic label. The New Customer form can check an exact email or phone before saving and open possible matches in a separate tab. The owner chooses the customer record.

Browser preview uses synthetic fixtures. Component and route regressions cover source recovery, filter validation, and contact checks that perform no writes. This increment uses existing database fields and has no migration.

### 2B — Enquiry handoff and booking contacts

Implemented locally. Start a draft from a saved enquiry, then choose an existing customer or open a prefilled new-customer form. Tenant, payer and agent are optional links picked by staff. The booking and enquiry link back to each other. The original enquiry and message are preserved, and the cleaning address is entered separately from the selected contact's address.

Each enquiry uses one booking identity. Stale revisions are rejected before the create attempt, and concurrent requests reopen the winning booking. No new database migration is required. Role links are captured at conversion and shown in booking details. Existing email and invoice recipient review stays separate. Editing or backfilling contact-role links on saved bookings is outside this increment.

Owner review is deferred until the planned phases are ready. Continue local testing and keep each release gate explicit.

## Phase 3 — Media management completion

### 3A — Editing and publication controls implemented locally

Cross-route links, browser Back and reload now protect unsaved media edits and running actions. A single-item caption draft is saved in account-scoped session storage for up to 24 hours, offered for explicit review on return, and cleared on sign-out. Blocked storage leaves editing available and shows a recovery warning. Bulk edits, position selections and file selections have navigation protection but are not restored after leaving.

Staff can edit captions, descriptions and categories for up to ten ready items together. Suggested wording preserves existing writing unless replacement is explicitly selected. Each row reports its result; retries skip confirmed saves and reconcile a lost acknowledgement before retrying. Published service/stage changes retain the existing server-side restriction.

A position can be removed after reviewing the exact affected pages, with concurrency checks and atomic publication history. The original media and other uses remain. Empty positions can restore a prior published selection. Built-in gallery photos remain; a service page may fall back to another published result or its built-in image.

Validation on 5 November: CRM TypeScript, lint and build passed; 1,403 CRM tests passed with zero failures. Six isolated real PostgreSQL checks passed: role restrictions, target-only removal, concurrent/retried removal, stale-selection rejection, transactional rollback and history restoration. Synthetic browser checks covered Back/link cancellation and recovery, bulk saves, removal/restoration and the normal application shell. Existing Fast Refresh and bundle-size warnings remain.

Files: admin/src/App.tsx; admin/src/pages/MediaManagerPage.tsx; admin/src/components/MediaNavigationGuard.tsx; admin/src/components/BulkMediaEditor.tsx; admin/src/lib/mediaDraftRecovery.ts; admin/src/lib/invoiceDraftRecovery.ts; admin/api/_lib/mediaAssetActions.js; admin/api/_lib/mediaCollectionActions.js; related types and tests; scripts/validate-media-unpublish-db.mjs.

Release gate: additive migration supabase/migrations/20261105120000_media_position_unpublish.sql and server flag MEDIA_POSITION_UNPUBLISH_ENABLED=true require the explicit production database exception and specific release approval. The flag remains disabled by default. No production database, hosting configuration, public media or provider setting was changed.

### 3B — Provider and live verification still pending

Verify an approved real photo and video upload/replacement through cloud processing and public mobile playback after the approved release. Check before/after pairs, failed upload/retry, exact affected pages and preservation of previous publication on failure. Local fixtures do not establish current cloud-provider acceptance.

## Phase 4 — Remaining website conversion improvements

Deliver real After Builders work photos or agreed hiding of empty panels; reproducible contrast/keyboard/sticky-bar fixes; clearer extras units and room/sofa/stairs scope; distinct carpet/sofa condition handling after pricing-rule decision.
Then improve homepage first-screen story, contextual genuine results/reviews, compact EOT package comparison and an anonymised completion-record example. Add a no-invented-price photo-quote route for dining chairs/other upholstery.
Owner inputs: genuine media, actual extra-unit limits, approved facts for team/aftercare and mixed-service quote rules.
Acceptance: service-to-quote-to-request on 320–430px/mobile/desktop, approved totals unchanged, consistent emails/terms and relevant proof.
Likely files: home/service/pricing/AfterBuilders components, QuoteCalculator and shared quote rules, gallery.

## Phase 5 — Operational additions

Manual review requests: durable per-job/cross-device history, deliberate resend and unknown-delivery handling. Existing manual composer shortcut is already live.
Then unified delivery history, broader contact search, granular staff invitations/permissions and the deferred Google Calendar connection.
Acceptance: deliberate recipient/send preview, duplicate/retry handling, least-privilege access tests and honest provider status. No automatic review campaign.

## Parallel measurement evidence

Wait for a genuine eligible consented request, then check canonical event, identical-payload validation, ingestion acknowledgement, terminal receipt and no resend. Check Ads attribution after processing. Do not create fake click IDs or synthetic live conversions.
GA4 and deposit measurement require a fresh scope/configuration review; not implicitly activated by request-only delivery.
Separately review Google's existing remote automatic user-data detection before claiming the browser privacy audit complete. No new Google settings change is authorised by this roadmap.

## Later experiments

A/B testing, richer case studies and possible restrained motion follow reliable flows and useful photos. A 3D redesign is not a prerequisite.

## Verified release and remaining CRM review — 14 November 2026

The combined website preview was specifically approved and published through PR #69. Merge commit `2765c15c6134170f60f253c8d8ac4bbd62bb3531` passed the required checks; both Vercel production checks succeeded. The website's production alias resolves to that commit and is Ready. Live mobile checks passed for the homepage, After Builders, End of Tenancy, carpet and sofa pages. The live move-in quote with a three-seater sofa still displayed £344. The CRM sign-in page returned HTTP 200. No customer request or payment was submitted in these checks.

This release includes hiding empty After Builders photo sections and the approved combined website refinements. It does not complete every longer-term Phase 4 idea above. Genuine job photos, business decisions on unapproved scope/pricing changes and later experiments remain separate.

The outstanding Phase 1B, 2A, 2B and 3A CRM code is integrated with current main in the isolated local branch `codex/crm-completion-review-20261114`. Integration preserves the recently released invoice bank/Stripe instructions and PDF fixes. The original older worktree and its unfinished files are preserved. This CRM review branch has not been pushed or released.

Validation of the integrated CRM:

- All 1,427 tests passed across 102 test files; TypeScript and build passed. Lint has zero errors and one existing Fast Refresh warning; the existing bundle-size warning remains.
- 22 booking-to-invoice allocation checks and six media unpublish/restore checks passed against disposable local PostgreSQL 18 databases. Coverage includes access restrictions, duplicate/concurrent requests, stale data, transaction rollback and preservation of payment/publication history.
- The actual payment review component passed mobile and desktop browser checks with synthetic fixtures and external requests blocked. Both payment-reference and deposit-review acknowledgements were required before applying the sample £120 balance against a £150 invoice with its £30 deposit already credited. The simulated result was £0 outstanding. This establishes UI behaviour, not a live bank/Stripe transaction or delivery of a real receipt.

Next release gates, still outstanding:

1. Read-only compatibility review of the live schema and existing configuration for the two proposed migrations. The local database tests are not evidence that either migration is installed in production.
2. Specific approval for the CRM release and production database exception for `20261103120000_booking_invoice_payment_allocations.sql` and `20261105120000_media_position_unpublish.sql`, with their separately controlled feature flags. No production data, schema or settings were changed during this review.
3. After release, verify the authorised real photo/video upload, processing, replacement and mobile playback flow. Synthetic media tests do not establish current provider behaviour.
4. Separate follow-up for partial/split payments, correction/refund reconciliation, the Phase 5 operational additions and the measurement evidence/configuration review above.

## Owner review and release sequence

Phase 1A is live. Phases 1B, 2A, 2B and 3A are implemented locally; preserve the separate database and release gates. Owner review is deferred until the planned work is ready. Remaining work includes Phase 1B partial/split/refund and correction workflows, Phase 3B provider verification, Phase 4 website refinements and Phase 5 operational additions.
