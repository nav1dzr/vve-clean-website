# After Builders preview refinement — 15 October 2026

## Requested scope

Remove public Google review counts throughout the website, show all three After Builders cleaning levels together at every width, improve the page colour and photo layout, and explain preview enquiry behaviour. The two proposed external audits and further CRM work remain separate.

## Changes

- `src/components/GoogleBadge.tsx`, `src/components/TrustBadges.tsx`, `src/data/googleRating.ts`: show the verified Google score without a visible or accessible review-count claim. Source dates and profile links remain. Internal counts remain available to validate the source; rating values were not changed.
- `src/components/AfterBuildersContent.tsx`: replace the mobile price selector with simultaneous Light, Standard and Deep sparkle columns for each property. All approved ranges and descriptions are retained. Add a before/after photo section.
- `src/components/AfterBuildersPhoto.tsx`, `src/pages/AfterBuildersPage.tsx`: add three clearly labelled, empty photo slots (hero, before, after). Approved real photos can be supplied with factual alternative text and captions in the `PHOTOS` map. A failed image falls back to its labelled placeholder. These slots do not add a new CRM media publishing integration.
- `src/pages/after-builders.css`: blue/teal hero, distinct comparison columns, cream photo section, pale blue checklist cards and a dark enquiry surround. Mobile columns retain table semantics and fit at 320px. Keyboard focus remains visible on the dark surround. Footer and sticky WhatsApp colours checked.
- `src/components/AfterBuildersEnquiry.tsx`: explain the known preview isolation response instead of treating it as an unexplained failure. Form answers remain available, and no success/conversion is shown on rejection.

## Enquiry routing and preview limitation

`api/contact.js` invokes `api/_lib/previewIsolation.js` before saving. A preview without approved isolated test resources rejects submissions. This protection is retained.

The configured production path uses `contact_enquiries` and the existing delivery workflow in `admin/api/_lib/enquiryNotifications.js`: business email, customer acknowledgement and Telegram. The owner reviews these under **CRM → Enquiries**, not Bookings. No new Supabase table or migration is required by this refinement. Delivery retries and existing configuration are unchanged.

This turn did not submit a real enquiry or send notifications. Production delivery is therefore not newly certified by this preview exercise. Mocked request/delivery tests and the existing isolation tests passed.

## Validation

- TypeScript: pass.
- ESLint: no errors; seven pre-existing React refresh warnings.
- Full runtime suite: **2,471 passed, 303 skipped, 0 failed** (2,774 total). Skips are existing conditional cases; this is not a claim that skipped checks executed.
- Production-mode build and prerender: pass, 37 routes plus the 404 page.
- Browser: 320px, 390px, 768px and 1440px layouts checked. All comparison columns present, no document overflow, no clipped table cells at tablet width.
- Browser: progressed Project → Cleaning → Visit → Review and checked retained optional choices without submitting real data.
- Browser: footer WhatsApp remains white on dark green; sticky WhatsApp remains dark text on bright green. Sidebar keyboard focus uses a contrasting pale blue outline against the dark background.
- Independent review found the sidebar focus contrast issue; corrected and rechecked in the browser.
- `git diff --check`: pass.

Test changes: `src/pages/AfterBuildersPage.test.tsx`, `src/components/AfterBuildersEnquiry.test.tsx`, `src/components/ratingDisplay.test.tsx`, `src/components/ServiceDecisionTrust.test.tsx`, `src/data/googleRating.test.ts`.

No changes to prices, deposit, Stripe, customer records, production database, DNS, Google Ads or notification configuration. Release scope is the existing After Builders preview branch only.
