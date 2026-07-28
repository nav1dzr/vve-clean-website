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

- NOT STARTED — Audit and safely improve visibility/clarity for £5m insurance, DBS, East/North London coverage, service areas, pricing assumptions, heavy condition, stain removal, parking/congestion, EOT 48-hour re-clean, after-builders photo review and CTA hierarchy.
- COMPLETE — Preserve natural, concise, professional, warm British English and avoid unsupported reviews, testimonials, photos, guarantees, accreditations, locations, agency pricing or cheap positioning.
- MANUAL REVIEW REQUIRED — Live review widget unless an existing safe verified integration is present.
- NOT STARTED — Assess whether an accessible, useful, no-paid-service map can be added without exposing a private address.

## Phase 7 — Analytics code readiness

- NOT STARTED — Audit existing analytics/GTM architecture without accessing Google Ads.
- NOT STARTED — Verify reliable, non-duplicated, PII-free events for telephone, WhatsApp, quote submission, booking start, successful £30 deposit and booking confirmation.
- NOT STARTED — Implement only safe missing events using the existing architecture and tests.
- NOT STARTED — Document event name, trigger, page/component, payload, Preview test and later GTM/Google Ads configuration.
- MANUAL REVIEW REQUIRED — Google Ads Primary/Secondary action configuration.

## Phase 8 — Final website audit

- NOT STARTED — Search for stale prices/discounts/surcharges, broken links/routes, customer-impacting TODOs, PII logs, missing images, duplicate events, invalid schema prices and inconsistent deposit wording.
- NOT STARTED — Run root typecheck, lint, at least 390 tests and build; verify 12 public routes prerender.
- NOT STARTED — Run admin typecheck, lint, at least 626 passing/1 todo, build and verify no more than 12 functions.
- NOT STARTED — Final diff/status audit; push feature branch and provide Preview and Production hand-off steps without deploying or merging.
