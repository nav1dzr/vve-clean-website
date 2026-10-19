# After Builders pricing and enquiry preview — 14 October 2026

## Scope and approvals

The owner approved the pricing plan, continuing `codex/after-builders-page-20261013`, and the exact twelve indicative budget ranges on 14 October. This phase prepares a preview only. Production data, DNS, Stripe configuration and the £30 deposit are unchanged.

## Delivered

- `shared/afterBuildersGuide.js`: one display-only source for the approved light / standard / deep budgets. These are not checkout amounts. The 5+ bedroom deep range retains its £2,500+ upper indication.
- `src/components/AfterBuildersContent.tsx`, `src/pages/AfterBuildersPage.tsx`, `src/pages/after-builders.css`: responsive price comparison, simpler room checklist, clear assessment limits, optional outdoor extras, compact honest gallery link and calmer page hierarchy. The mobile table shows one selectable cleaning level without horizontal scrolling.
- Extras use existing catalogue starting prices: pressure washing £120, garden services £75 and exterior window cleaning £75. They are expressly not fixed add-on fees or a combined-discount promise. Garden waste removal, glazing quantity/access and parking remain separately agreed.
- `src/components/AfterBuildersEnquiry.tsx`, `src/lib/afterBuildersEnquiry.ts`, `src/pages/after-builders-enquiry.css`: Project → Cleaning → Visit → Review. Fixed cleaning choices and optional extras generate a readable enquiry. Name/email are required; phone and uncertain project details are optional. No calculation pretends to be an assessed fixed quotation.
- The form uses the existing `/api/contact` save/notification path and records a successful contact enquiry, not a booking or deposit conversion. Only non-personal choices persist locally; contact details, postcode, dates and notes do not. Storage blocking is handled, repeated clicks are guarded and failed submissions retain answers.
- `admin/api/_lib/enquiries.js`: the same request key remains idempotent when only measurement attribution/consent changes between attempts. Changed enquiry content still conflicts. Existing records/fingerprints are not rewritten.
- `src/components/QuoteCalculator.tsx`, `src/pages/PricingPage.tsx`, `src/lib/routeMetadata.ts`: After Builders routes to an assessed quote instead of presenting the old £249 ladder as a whole-property price.
- `shared/requestPricing.js`, `api/create-booking-request.js`, `api/create-checkout-session.js`: stale direct After Builders quote configurations cannot create a numeric-price booking or reach the archived checkout path. The default retired checkout response remains unchanged; no Stripe session/payment behaviour is enabled or changed.
- `src/components/ServiceLandingLayout.tsx`: same-page quote links use native anchors, including repeated clicks. Other service routes retain their existing destinations.

## Validation

- Full suite: **2,466 passed, 0 failed, 301 skipped/pending**, 2,767 total. The pre-existing skipped tests are not claimed as tested.
- TypeScript: passed.
- Lint: 0 errors; 7 existing React-refresh export warnings in unrelated files.
- Production build: passed, 37 routes plus 404 pre-rendered.
- `git diff --check`: passed.
- Browser checks at 320, 390, 768 and 1440 px: no page-width overflow; price level selection; £2,500+ display; mobile heading wrapping; quote anchors; extras; footer and sticky WhatsApp colours; guided form review/edit controls; saved choices restored after hydration.
- Synthetic local check `AB-PREVIEW-20261014`: selected flat/2 bedrooms/1 bathroom, pressure washing 25 m² and garden work; reviewed the generated enquiry; simulated unavailable endpoint retained answers and showed an honest error. No live customer, payment, email or Telegram message was created.
- Automated tests cover the success response and one enquiry event, failed/duplicate submissions, storage failure, personal-data exclusion from drafts, safe quantities, API replay and mocked notification delivery. They do not prove a new live delivery.
- The full suite initially overlapped a rebuild and one sitemap test hit a temporarily missing build file. It was rerun after the build completed and passed. A final CSS-only phone-header wrap fix was rebuilt and verified in the browser.

## Owner review and release

Check the price guide, optional extras and the four enquiry steps in the hosted preview. Real After Builders job photographs still need to be supplied/published; none have been invented or relabelled from another service. A production release is a separate step after review. This phase contains no database migrations and no production enquiry submission.
