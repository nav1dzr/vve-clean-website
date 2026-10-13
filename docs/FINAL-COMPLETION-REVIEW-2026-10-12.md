# Website completion review — 12 October 2026

## Status and scope

This review branch consolidates the accepted Phase 1–3 changes and the remaining
booking reliability fixes. It is prepared for preview review, not a claim that
the new code or optional GA4 measurement has been activated in production.

The live main revision inspected at the beginning of this pass was `3476d0a`.
The working branch is `codex/final-completion-20261012`, based on the completed
Phase 3 revision `8ac4de9` with current main merged normally. It targets
`feature/website-final-completion`. Other dirty checkouts and the frozen release
branch were preserved. No production data, Stripe behaviour, prices, £30 deposit,
DNS, Google Ads settings or customer records were changed.

## What this pass finishes

| Area | Result | Source |
| --- | --- | --- |
| Request acknowledgement | Uses the submitted snapshot; refresh can recover a short-lived acknowledgement without resending. The saved marker contains no customer details or postcode/date reference. An explicit action starts a fresh request. | `src/pages/BookingPage.tsx`, `src/lib/bookingRequestAcknowledgement.ts` |
| Validation and recovery | Frontend and API share trimmed email, name and real London-date checks. Invalid draft structures are ignored. Only a structured price-change response triggers price review. | `shared/bookingRequestValidation.js`, `shared/bookingRequestValidation.d.ts`, `api/create-booking-request.js`, `src/pages/BookingPage.tsx` |
| Notification response time | After the booking/outbox is durably saved, Vercel keeps delivery running after the response. Without the host lifecycle hook, the same delivery promise is awaited. Existing leases, checkpoints and retry handling remain. | `api/_lib/requestNotificationBackground.js`, `api/create-booking-request.js`, `package.json`, `package-lock.json` |
| Payment status | Up to six visible-page GET checks and a manual Check payment status action. Only authoritative saved state changes the display. Existing card-checkout deadline is explained before sending customers into an unavailable checkout. | `src/pages/BookingManagementPage.tsx` |
| Manual quotes | Rug, condition and large-property messages are distinct; WhatsApp and email drafts carry the property, package and selected areas. Nothing is sent automatically. | `src/components/EotQuoteWizard.tsx` |
| Google rating | Shared bounded fetch/retry, timeout, private-page guard and a dated snapshot. A cached score is not described as permanently live. | `src/hooks/useGoogleRating.ts` |
| Canonical GA4 request | Optional outbox now supports one queued `booking_request_submitted` per eligible saved request. Browser acknowledgement remains diagnostic. No request revenue or customer details in the event. | `api/_lib/ga4Measurement.js`, `supabase/migrations/20261012120000_booking_ga4_request_measurement.sql` |
| Search indexing | The transactional `/booking` form is noindex/follow and excluded from the sitemap. Consent-gated funnel analytics remain available. | `src/lib/routeMetadata.ts` |

The accepted visual work is retained: service-aware header/sticky actions,
shorter service heroes, genuine job photos, explicit minimum visit charges,
consistent request/deposit wording, contextual trust and accurate bundle copy.
See the Phase 1 and Phase 3 implementation records for their complete file lists.

## Verification

- Full website suite: **2,383 passed, 293 conditional checks skipped**, 153 files.
- Full CRM suite: **987 passed, one existing TODO**, 79 files.
- Final indexing correction: **82 pertinent tests passed**, including its new
  direct/client navigation metadata test. No test was skipped to hide a failure.
- Website and CRM TypeScript, lint and production builds passed. Existing lint
  warnings remain (seven website, one CRM Fast Refresh warnings); CRM retains
  its existing bundle-size warning.
- Disposable local PostgreSQL: **24 checks passed** against both additive GA4
  migrations. Includes rollback/retry, uniqueness, consent and test suppression,
  permissions, no historical backfill and unchanged payment measurement.
- Generated sitemap/internal-link validation: **20 indexable routes**, no orphan
  or unreachable indexable pages. `/booking` remains accessible in the form flow.
- Static function packaging: website 11 routes / 573 files; CRM 12 routes / 612
  files. No missing required imports or scanned sensitive configuration files.
  An evidence-only trace accounts for the existing local CRM dependency junction
  and documented optional native dependencies; the unmodified standalone checker
  reports those local-layout limitations.
- Browser review on the built site: homepage at 390px; EOT calculator and request
  handoff at 390px; selected bedroom/living-room carpets retained on return;
  correct rug/condition email and WhatsApp drafts; EOT/carpet/sofa at 320px without
  horizontal document overflow; upholstery desktop layout at 1280px inspected.

Synthetic test identifiers include `VVE-TEST-ACK` and
`VVE-TEST-STATUS-20261012`; provider/database responses are local fixtures.
Notification tests verify customer/business email and Telegram calls and delivery
checkpoints. No fresh live notification or payment was sent during this pass;
these results do not prove inbox delivery or Google reporting ingestion.

Evidence is stored outside the repository under the task's visualization folder,
`final-completion-2026-10-12` (test/build logs and packaging reports).

## Release gates

1. Review the consolidated preview and approve the specific live website/CRM
   release. Use normal GitHub checks and merge protections; do not force a merge.
2. Optional canonical GA4 activation also needs approval for both production
   migrations and server/browser configuration. Test in isolation first. Keep GA4
   mode off while deploying the updated worker and both migrations, then validate
   and enable. The older worker does not understand the new request event.
3. Verify a newly eligible event in the intended GA4 property after activation.
   HTTP submission success alone is not evidence of reporting ingestion. Unknown
   custom-event delivery outcomes stop as `uncertain`; external exactly-once
   delivery is not promised.
4. Keep canonical Ads `deposit_paid` as the intended paid-customer conversion.
   Do not import GA4 `purchase` as another Primary for the same payment. Any Ads
   dashboard changes remain separate and require approval.

Details: `docs/BOOKING-GA4-REQUEST-COMPLETION-2026-10-12.md` and
`docs/PHASE-1-BOOKING-FUNNEL-IMPLEMENTATION-2026-10-04.md`.

If all browser storage is blocked, the current visit can still complete; no
browser-only solution can restore an acknowledgement after a full reload with
all persistence unavailable. Optional analytics failure never rejects a booking.
Actual `add_payment_info` remains unavailable from the hosted payment provider;
it must not be fabricated from a click. New service packages, flexible-date
product changes, 3D animation and A/B tests remain future options, not unfinished
repairs or prerequisites for this release.
