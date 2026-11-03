# VVE website and CRM completion roadmap

Updated 3 November 2026. This reconciles the October website PDF, website HTML audit, advertising handoff and CRM audit with releases through PR #62. Historical "not released" labels in older plans are not current status.

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
Status: implemented and validated locally; not pushed, merged or deployed.

Validation: 107 focused tests passed, then the full CRM suite passed with 1,317 tests and zero failures. TypeScript/lint/build passed; one existing Fast Refresh warning and the existing bundle-size warning remain. Synthetic component browser checks verified desktop, 390px layout, full refund and unavailable/retry states. No production provider or customer action was performed. The complete payment allocation/correction workflow remains Phase 1B.

### 1B: Explicit allocation and correction — design before implementation

Owner journey: open payment review > choose an existing payment and its linked invoice > see money already allocated/refunded and proposed resulting totals > explicitly confirm. This links evidence of received money; it never charges the customer or records another receipt of funds.

Required design:
- Immutable booking source-payment identity, explicit invoice linkage and bounded GBP pence amounts.
- Database transaction locks + server-enforced uniqueness/idempotency to prevent concurrent or repeated allocation.
- Treat an invoice's existing depositApplied and other payments as potentially representing existing funds. Block ambiguous historic matches for deliberate review; do not auto-match.
- Multiple linked invoices, partial payments, revisions, voids, refunds and overpayments need explicit outcomes.
- Preserve original bank-entry/payment rows. Corrections append attributed reasons and compensating records rather than deleting history.
- Invoice receipt/PDF policy: keep issued historical documents, generate a new version only through the approved lifecycle, reconcile uncertain storage/email outcomes.
- Stripe refunds and checkout behavior stay outside this work.
- No automatic replay, historic migration or bulk allocation.

Acceptance: disposable database transaction/concurrency tests, partial/refund/revision scenarios, no duplicate money or receipt, API authorization and owner preview. Review exact migration and write scope before any production exception.
Decision checkpoint: approve the proposed correction/allocation behavior and specific release after review.

## Phase 2 — Daily CRM workflow

Deliver enquiry-to-booking draft conversion (retaining the source enquiry); normalized service filters; operational/agreement status explanations; consistent phone/Checkatrade source; deliberate tenant/payer/agent links; earlier duplicate-contact advisory; defined test-record filtering.
Keep per-booking deposit/no-deposit choice.
Acceptance: phone-only, Checkatrade, website and company scenarios; back/refresh/retry; stale edits; no automatic customer merge or message.
Likely files: EnquiriesPage, BookingListPage, customer/booking APIs, customer relationship UI. Relationships may need a separately reviewed migration.

## Phase 3 — Media management completion

Deliver cross-route/back unsaved-edit protection and recovery; true unpublish with affected-pages preview and history; bulk captions/categories; understandable treatment of built-in versus managed media.
Verify an approved real photo and video upload/replacement through cloud processing and public mobile playback; preserve previous publication on failures.
Acceptance: cancel/discard/navigation/reload, failed upload/retry, before/after pair, replacement/unpublish/restore and exact affected pages. Real publication requires specific approval.
Likely files: MediaManagerPage and media APIs, shared media mapping, gallery components.

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

## Owner review and release sequence

Finish 1A locally and present the diff + validation. Review 1B design next, then implement in isolation. Release small phases using normal required checks and explicit approval. No additional sign-ins or production actions are needed merely to prepare the current phase.
