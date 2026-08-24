# Website completion backlog

Status values: `COMPLETE`, `IN PROGRESS`, `BLOCKED`, `NOT STARTED`, `MANUAL REVIEW REQUIRED`.

## Project controls

- COMPLETE — Safety inspection: release tip, worktree, conflicts, untracked paths and validation commands.
- COMPLETE — Confirm the admin application requires no feature changes for public website work.
- COMPLETE — Create `feature/website-final-completion` from frozen release tip `f6bc7b0`.
- COMPLETE — Maintain `AGENTS.md`, this backlog and `CODEX_CHECKPOINT.md`; validate, review, commit and push each phase.

## Phase 1 — Critical customer journey

- COMPLETE — Audit homepage, service pages, calculator, booking, deposit explanation, Stripe handoff, confirmation, and mobile/desktop CTAs.
- COMPLETE — Verify every Get Price and Book Now destination and intended service selection behaviour.
- COMPLETE — Verify direct `/booking` service selection/change, summary service/price, responsive controls/steps, route back, legacy parameters and parameter cleanup.
- COMPLETE — Verify sticky controls do not obstruct fields/buttons.
- COMPLETE — Standardise approved £30 reservation/deposit wording across homepage, pricing, booking, checkout, confirmation, FAQs and terms without inventing refund behaviour.
- COMPLETE — Verify same/next-day normal-price wording and remove any automatic priority, 20% or 40% scheduling surcharge; preserve manually agreed exceptional out-of-hours quotes.
- COMPLETE — Preserve existing Stripe behaviour.

## Phase 2 — Routes, SEO and technical consistency

- COMPLETE — Audit all public routes and internal links, including the five required service routes.
- COMPLETE — Verify title, description, canonical, Open Graph, one H1, Service/FAQ/Breadcrumb schema and structured-data price consistency.
- COMPLETE — Verify static/mobile/desktop CTAs and that important CTAs work without client-only JavaScript.
- COMPLETE — Verify sitemap, robots, redirects, obsolete routes, admin exclusion and prerender coverage. Created `public/sitemap.xml` and `public/robots.txt`.
- COMPLETE — Do not create thin location pages or invent reviews, areas or business information.
  - UPDATE (2026-08-07): superseded by explicit owner sign-off for a specific,
    honest implementation — see the addendum at the end of
    docs/LOCATION_PAGES_ASSESSMENT.md. The underlying rule (never invent a
    review, area, or business claim) still applies and was followed: the 15
    area pages shipped only assert real postcodes/neighbours, and only mark
    a page indexable once it carries real proof.

## Phase 3 — End-of-tenancy gallery

- COMPLETE — Add the three genuine before/after pairs with truthful labels, responsive accessible presentation, focus and useful alt text.
- COMPLETE — Add a one-image slideshow using `1.jpg`–`10.jpg`: post-mount shuffle, ~5-second autoplay, no duplicates, arrows, dots, swipe, keyboard, hover/focus/manual pause and reduced-motion support.
- COMPLETE — Load the first slideshow image normally and later images lazily; add no false labels, customers or locations.
- COMPLETE — Track only `public/end_of_tenancy/` from the known untracked paths.

## Phase 4 — Mobile, accessibility and visual polish

- NOT STARTED — Review major pages at 360, 390, 768 and 1440px for overflow, clipping, readability, overlap, header/banner obstruction, tap targets, contrast, dropdowns, focus, labels/errors, layout shift and spacing.
- COMPLETE — Replace remaining decorative emoji service/benefit icons with existing Lucide icons where safe. All 5 service pages + CommercialPage updated.
- NOT STARTED — Standardise buttons, CTAs and WhatsApp styling without unnecessary redesign.
- NOT STARTED — Improve FAQ +/- affordance.
- COMPLETE — Make navigation dropdowns close on outside click and Escape; verify keyboard navigation. Added `useEffect` outside-click and Escape handlers to `Navbar.tsx`.
- NOT STARTED — Verify sticky mobile CTA clearance and readable `#quote` scroll positioning.
- NOT STARTED — Improve text-heavy service cards only where needed and preserve the approved brand.

## Phase 5 — Images and performance

- COMPLETE — Measure build output: JS 488.90 kB / gzip 129.87 kB.
- COMPLETE — Audit homepage/carpet heroes, service cards, gallery, logos and trust badges: all images have explicit dimensions, lazy loading below fold, eager+fetchpriority on LCP (Hero.tsx), WebP for gallery, alt text on all meaningful images, decorative backgrounds have alt="" aria-hidden="true".
- COMPLETE — Added `<link rel="preload" as="image" fetchpriority="high">` for the LCP hero image in index.html.
- MANUAL REVIEW REQUIRED — `public/images/carpet-hero-desktop.jpg` absent; HeroBackground falls back to mobile image gracefully; do not fabricate.
- COMPLETE — Do not alter genuine before/after visual content or degrade quality for low-value optimisation.

## Phase 6 — Trust, content and conversion

- COMPLETE — Audited trust visibility: £5m public liability and DBS present in TrustBadges, Hero, FAQ, QuoteCalculator, CommercialPage, CommercialCarpetPage, CarpetCleaningPage hero.
- COMPLETE — East/North London coverage clearly stated with postcodes across Footer, FAQ, Areas component, AreaMarquee and all 5 service pages.
- COMPLETE — EOT 48-hour re-clean guarantee in hero badge, benefit card, FAQ and pricing note on EndOfTenancyPage.
- COMPLETE — After-builders photo review wording confirmed in benefit card and pricing note on AfterBuildersPage.
- COMPLETE — Added congestion zone and parking transparency sentence to PricingPage condition note.
- COMPLETE — CTA hierarchy confirmed: primary "Get my price" on homepage, "Book your clean" / "WhatsApp" on service pages, no competing primaries.
- COMPLETE — Preserve natural, concise, professional, warm British English and avoid unsupported reviews, testimonials, photos, guarantees, accreditations, locations, agency pricing or cheap positioning.
- MANUAL REVIEW REQUIRED — Live review widget unless an existing safe verified integration is present. 3 existing coded reviews remain untouched.
- NOT STARTED — Map not added: mobile cleaning service with no public address; embedding would expose private information.

## Phase 7 — Analytics code readiness

- COMPLETE — Audited architecture: Google Ads tag AW-18214693277 loaded via gtag.js; Consent Mode v2 with 4-signal default-deny in index.html and src/lib/consent.ts; no GTM container; no GA4 property. Deposit_paid primary conversion fires from confirmation.html.
- COMPLETE — Created src/lib/analytics.ts: PII-free safeGtag helper + trackPhoneClick, trackWhatsAppClick, trackBookingInitiated, trackContactFormSubmitted. Full event map documented in module comments.
- COMPLETE — Implemented: phone_click (Navbar desktop, Contact), whatsapp_click (Contact), booking_initiated (QuoteCalculator handleBookNow), contact_form_submitted (Contact form POST success).
- COMPLETE — deposit_paid / leaflet_booking_completed already implemented in confirmation.html with event_callback and retry logic.
- MANUAL REVIEW REQUIRED — Google Ads Primary/Secondary action configuration; add booking_initiated as a micro-conversion in AW-18214693277. GA4 property not yet configured — add G-XXXXXXXX to index.html when ready.

## Phase 8 — Final website audit

- COMPLETE — Audited for stale prices: all EOT/move-in/after-builders prices correct in src, prerender.mjs, index.html noscript. No stale £159/£139 values. Scheduling surcharge removed (no 20%/40%). Deposit wording consistent.
- COMPLETE — Audited TODOs: zero TODO/FIXME/HACK in src. One console.error in BookingPage (API error handler, no PII — acceptable).
- COMPLETE — Root: typecheck PASS, lint PASS (0 errors, 2 pre-existing Fast Refresh warnings), 390/390 tests PASS, build PASS, 12 routes prerendered.
- COMPLETE — Admin: typecheck PASS, lint PASS (0 errors, 1 pre-existing warning), 626 passing / 1 todo PASS, build PASS, 12 serverless functions (at cap, none added).
- COMPLETE — Final diff audit: tracked tree clean; untracked .playwright-mcp/, admin/scripts/, docs/, scripts/check-crm-readiness.mjs remain untracked as required.
- COMPLETE — Feature branch pushed. Production hand-off: deploy feature/website-final-completion to Preview via Vercel dashboard; validate all 12 routes, EOT gallery, Navbar keyboard, pricing transparency note and analytics events before merging to main.
