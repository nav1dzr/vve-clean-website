# After-builders page review — 13 October 2026

Development branch: `codex/after-builders-page-20261013`, based on released main `6659a51`.
Canonical route remains `/after-builders-cleaning-london`. Production release requires Navid's approval.

## Customer-facing changes

- Replaces the short service page with a responsive pricing and service guide in the existing VVE shell.
- Six quick section links, six catalogue-backed residential starting prices, and assessment-only pricing for 5+ bedrooms or complex projects.
- Explains cleaning stages, project/condition/access costs, six room checklists, assessed extras, fixed quotation process, DIY considerations, client types, actual local coverage and fourteen FAQs.
- Shows real existing Google rating data through GoogleBadge; no hardcoded reviews or new guarantee.
- Adds labelled placeholders for genuine project photographs/video. Does not claim that an after-builders CRM media category has been configured.
- Keeps service-specific WhatsApp and phone links. The optional secondary mobile action is Call on this page; every other page keeps its existing default.
- Written enquiry links pass `service=after_builders` to the existing contact page. Only that recognised key is mapped to a service; the customer can change it. No new contact endpoint or duplicate analytics listener.
- Visible prices and structured-data minimum prices derive from the same runtime catalogue. FAQ display and schema use the same array.

## Pricing and policy boundaries

No tariff, minimum, calculator, deposit, payment configuration, customer record, DNS or backend notification changes.
Existing starting prices remain £249 small area, £279 studio, £329 one bedroom, £399 two bedrooms, £499 three bedrooms and £625 four bedrooms. The separately defined commercial after-builders start remains £349 on its existing commercial page.

These starts are not all-inclusive fixed packages. A final fixed written quotation follows assessment, with additional work agreed before charging. £30 deposit follows agreement and is deducted from total. The existing 24-hour appointment-change policy is preserved.

The brief's 72-hour EOT guarantee conflicts with the live catalogue's 168-hour / seven-day policy. No EOT guarantee was changed or applied to after-builders cleaning. No universal removal of paint, residue, stains or permanent damage is promised.

## Research and decision

Primary structural reference: <https://afterbuilderscleaning.com/blog/after-builders-cleaning-cost-london/>.
Eight additional company websites were reviewed: Fantastic Services, Cleaners of London, Bloom Eco Cleaning, The Happy House Cleaning, Cleaning Express, ABC Cleaning London, Mayer Enterprises and Crystal Facilities Management.

Published hourly, membership, square-metre, whole-property and sparkle-only figures are not directly comparable. Retain current VVE starting prices; profitability needs actual job-cost records. Market ranges remain in the owner research report rather than being presented as VVE prices on the customer page.

Research artifacts (outside the repository): `after-builders-2026-10-13/AFTER-BUILDERS-REVIEW.html`, `competitor-pricing-research.md`, `reference-research.md`, `reference-coverage.md`, `pricing-impact.md` in this chat's visualization folder.

## Validation

- TypeScript passed.
- ESLint: zero errors, seven existing fast-refresh warnings in unrelated files.
- Full root suite: 153 test files passed; 2,395 tests passed, 297 existing tests skipped. New tests cover catalogue/schema consistency, anchors, scope boundaries, distinct mobile actions, enquiry preselection/editing and ignored unknown query input.
- Production build and prerender passed; 37 routes plus 404 rendered; sitemap contains 20 indexable URLs.
- Browser review at 375, 768 and 1440 CSS pixels: no horizontal page overflow. Checked hero, price table, checklist disclosure, keyboard FAQ activation and contact service preselection.
- Existing contextual navigation, price-source, deposit reassurance, SSR hero and FAQ/schema tests pass.
- Fixed two review findings: pale keyboard focus on dark surfaces and a single-column reassurance list in the pricing sidebar.

Local built review: <http://127.0.0.1:8861/after-builders-cleaning-london>. The review server rejects writes. No live enquiry, email, Telegram notification or payment was sent during this work. Backend delivery was not retested live; existing mocked regression tests pass.

## Before production

Navid reviews the page and approves release. Real photographs/video can be supplied afterwards; publishing them through CRM requires an explicitly scoped after-builders media category/slot update. No production database update is needed for the page itself.
