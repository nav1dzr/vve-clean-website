# Final Production Audit — VVE Clean

Written on branch `chore/final-production-audit-cleanup`, based on `main` @ `8dfecc5` (merge of `feat/visual-polish`). This document reports the findings of a full pre-launch technical audit — public site, CRM/admin, security, accessibility, performance, SEO, and repository hygiene — plus the confirmed bugs fixed as a direct result.

No pricing, Stripe, Supabase, webhook, email, Telegram, Google Sheets, Google Ads, attribution, consent, booking-reference, confirmation-token, or CRM business logic was changed except where explicitly noted as a confirmed-bug fix below. No real payment was made. Nothing was deployed to production or merged as part of this audit.

## Overall readiness

**Ready to launch, with a short list of manual checks before the real booking test in `FINAL_LAUNCH_CHECKLIST.md`.** No blocking bugs were found in either app. Two real (non-blocking) bugs were found and fixed; the rest of the findings are low-priority polish items or items that require a human decision (see "Remaining risks" below).

## Public-site status

- All 7 routes (`/`, `/pricing`, `/commercial`, `/booking`, `/leaflet`, `/privacy-policy`, `/terms-of-service`) plus `public/confirmation.html` and the legacy `public/booking.html` redirect shim were audited.
- Every internal link resolves to a real route in `src/AppRoutes.tsx`; no dead internal links found.
- Every `tel:`/WhatsApp/email link checked (~50 occurrences) matches the correct reference values (020 8050 2233, wa.me/447845451111, contact@vveclean.co.uk) with zero mismatches.
- `confirmation.html`'s every state (unverified/no-proof-of-payment, payment-received/awaiting-date, appointment-confirmed, delayed-details, network-error fallback) was read in full and confirmed honest — it never claims a confirmed appointment unless the CRM-set `status` field genuinely equals `'confirmed'`.
- The Google Ads conversion label (`AW-18214693277/hUwdCK68gswcEJ3TuO1D`) appears exactly once, byte-exact, only in `confirmation.html`. The `gtag.js` loader appears exactly once per HTML file (`index.html`, `confirmation.html`) — no duplication.
- No `TODO`/`FIXME`/placeholder/Lorem-Ipsum content found anywhere in production copy.
- **Bug found and fixed**: `BookingPage.tsx` and `LeafletPage.tsx` each have their own bespoke footer (not the shared `Footer.tsx`) that still said "VVE Clean Ltd" (wrong legal name, missing Company No. 17234391); `BookingPage.tsx`'s copyright year was also hardcoded to `2026`. Both now match the standardized text used everywhere else on the site (`Footer.tsx`, `confirmation.html`): *"VVE Limited trading as VVE Clean. Registered in England and Wales. Company No. 17234391."*, with a dynamic year.
- **Bug found and fixed**: `BookingPage.tsx`'s 5 core required fields (full name, address, postcode, phone, email) had visible `<label>` text with no `htmlFor`/`id` association to their inputs — a real accessibility gap for screen-reader users. Now programmatically associated, with `aria-invalid`/`aria-describedby`/`role="alert"` wired to their error messages, matching the pattern already used correctly on the date/time fields and terms checkbox.
- **Minor, not fixed (documented only)**: `src/components/Hero.tsx`'s benefit checklist says *"£30 deposit **books your slot**"* — reads more certain than the rest of the site's careful "booking request, not guaranteed" language, though it avoids the literal banned words. Recommend a copy review, not an automatic fix (wording judgment call, not a bug).
- **Minor, not fixed**: `BookingPage.tsx`/`LeafletPage.tsx` have no "Cookie settings" control in their bespoke footers (unlike pages using the shared `Footer.tsx`). A visitor landing directly on `/booking` or `/leaflet` has no in-page way to revisit consent without navigating elsewhere first.
- **Not verifiable from this environment**: the Google review link, Google Business Profile link, and Facebook/Instagram social links in `Reviews.tsx`/`Footer.tsx` could not be opened in a browser to confirm they resolve to the correct live accounts.

## CRM status

- Auth/route protection: sound. No protected data-fetching component ever mounts before server-side session verification completes (`RequireAuth.tsx`). All routes correctly classified (login/reset-password public; dashboard/bookings/search/detail protected).
- Every one of the 8 admin API handlers calls `verifyAdminRequest()` before touching data; the service-role key is used only in `admin/api/_lib/supabaseAdmin.js` and never appears in client code (confirmed by both source grep and a grep of the actual built `admin/dist` JS bundle).
- Every admin API response sets `Cache-Control: no-store`; CORS is allowlist-only with no wildcard fallback.
- `confirmation_token` is excluded from every admin API response by explicit column-allowlist design (`bookingFields.js`), independently enforced by 4 existing automated tests, and confirmed absent from the built client bundle.
- **Bug found and fixed**: `admin/src/components/Modal.tsx` (used for internal notes, status changes, balance edits) had Escape-to-close and initial-focus, but no Tab-wrap focus trap — keyboard focus could escape the modal into the page behind it. Fixed to match the already-correct pattern in `CookieSettingsModal.tsx`; covered by 6 new tests in `admin/src/components/Modal.test.tsx`.
- **Minor, not fixed (documented only)**: `admin/src/lib/supabase.ts` has no runtime validation of `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — a missing value fails as an uncaught client-side exception (blank white screen) rather than a graceful error. Low operational risk, but worth confirming both vars are set in Vercel's Production project settings before launch.
- **Minor, not fixed**: `admin/api/_lib/cors.js`'s `Access-Control-Allow-Methods` is hardcoded to `GET, OPTIONS` despite `PATCH`/`POST` routes existing. Cosmetic — all existing tests pass and the routes function correctly in practice — not touched, since it isn't currently causing a functional or security problem.

## Security status

- No critical findings in either app.
- Service-role key confirmed server-only in both source and built bundles.
- `npm audit` (production dependencies only): **1 high-severity finding** — `ws` 8.0.0–8.20.1 (uninitialized memory disclosure / DoS via tiny fragments), pulled in transitively via `@supabase/supabase-js` → `@supabase/realtime-js`. The codebase does not use Supabase Realtime anywhere (`supabase.channel()` — zero matches repo-wide), so the vulnerable code path is not actually exercised by this app, but the package is still present in the dependency tree. **Not fixed in this pass** — the task explicitly prohibits broad version upgrades, and `npm audit fix` would need to bump `@supabase/supabase-js` itself. Recommend a deliberate, tested upgrade in a dedicated follow-up.

## Accessibility status

- Cookie consent modal: full focus trap, Escape, backdrop-click, 44px targets — already compliant (from the `fix/cookie-consent-mode-v2` branch).
- Admin `Modal.tsx`: focus trap gap found and fixed (see CRM status above).
- `BookingPage.tsx` label association gap found and fixed (see public-site status above).
- `useReveal.ts` and a global CSS rule already respect `prefers-reduced-motion` (from `feat/visual-polish`); admin app has no equivalent scroll-reveal animations to guard.
- **Gap found, not fixed**: `BookingPage.tsx`'s field-level validation errors have no `aria-live` region — a screen-reader user submitting the form with errors isn't automatically notified they appeared. The new `role="alert"` added to each error `<p>` (as part of the label-association fix above) does provide an implicit assertive live-region announcement per the ARIA spec, which substantially closes this gap as a side effect of the confirmed-bug fix — but a dedicated `aria-live="polite"` summary region was not added separately, since that would be a new feature rather than a fix to what was already there.
- Heading order (h1→h2→h3) audited across every homepage section in the prior `feat/visual-polish` pass — already correct.

## Performance status

- Font loading: exactly one Google Fonts stylesheet per HTML file, `display=swap`, correct preconnects.
- Every `<img>` in `src/components` has explicit `width`/`height` — no layout-shift risk found.
- Hero's LCP image has `fetchpriority="high"` and loads eagerly (from `feat/visual-polish`).
- **Confirmed candidate, not deleted**: 3 unreferenced original photos (~9.6MB combined: `driveway_pressure_washing_before/after.png`, `van-equipment.png`) still sit in `public/gallery/` even though only their `.webp` siblings are referenced in code — see `REPOSITORY_CLEANUP_PLAN.md` item 2 for why these were deliberately left in place rather than deleted.
- `npm audit`: see Security status above.

## SEO status

- `index.html` has a title, meta description, Open Graph tags, and a `HouseCleaningService` JSON-LD block — reasonably complete.
- **Gaps found, not fixed (documented only, per "no speculative SEO changes")**:
  - No `<link rel="canonical">` anywhere on the main site.
  - No `robots.txt` for the main site (only `admin/public/robots.txt`, which correctly blocks the whole admin app).
  - No `sitemap.xml`.
  - No Twitter/X card meta tags.
  - The Open Graph image is a 512×512 app icon, not a proper 1200×630 social-share image.
  - The JSON-LD `hasOfferCatalog` lists 4 services but is missing Carpet/Upholstery and Pressure Washing/Garden Services, which are advertised elsewhere on the site.
  - These are genuine opportunities, not defects — nothing is broken, so none were changed automatically. Recommend a dedicated SEO pass as a follow-up task with product sign-off on canonical wording, priorities, and OG imagery.

## Integrations status

Re-confirmed against the built production output (not just source):
- Google Ads conversion label: exact match, single occurrence.
- Google tag loader: exactly one per HTML file, no duplication.
- Consent Mode v2 defaults: all four signals (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) confirmed `denied` by default in the built `dist/index.html`.
- `confirmation_token`: confirmed absent from both built client bundles (root and admin).
- Service-role key: confirmed absent from both built client bundles.
- Exactly the expected serverless functions are present: 7 under `api/` (root), 8 under `admin/api/` (excluding `_lib/` helpers, which are correctly underscore-prefixed and not deployed as functions).

## Confirmed bugs fixed

1. Wrong legal entity name + stale hardcoded year in `BookingPage.tsx`'s and `LeafletPage.tsx`'s bespoke footers.
2. Missing `htmlFor`/`id` label association (+ `aria-invalid`/`aria-describedby`/`role="alert"`) on `BookingPage.tsx`'s 5 core required fields.
3. Missing Tab-wrap focus trap in admin's shared `Modal.tsx`.
4. Missing `noindex` on the legacy `public/booking.html` redirect shim (consistency fix — it's a content-free redirect page, same category as `confirmation.html`, which already has one).

## Remaining risks

- The `ws` transitive dependency vulnerability (see Security status) — low real-world risk since Realtime isn't used, but not resolved.
- SEO gaps (canonical, robots.txt, sitemap, OG image, Twitter cards, incomplete JSON-LD catalog) — all documented, none fixed, by design.
- Hero.tsx's "books your slot" wording — a soft copy-consistency question, not fixed.
- 3 unreferenced original photos left in `public/gallery/` (~9.6MB) — a deliberate keep, not a risk, but worth a product decision on whether to relocate them out of the deployed `public/` folder.
- `scripts/backfill-N15NJ310726.mjs` — cannot confirm from this environment whether it has already been run; left in place pending manual Supabase confirmation.
- Social/review link destinations (Google review link, Facebook, Instagram) not verifiable without a browser.

## Manual tests still required

See `FINAL_LAUNCH_CHECKLIST.md` for the full list — most importantly, one controlled real booking test end-to-end (Stripe → Supabase → customer email → business email → Telegram → Google Sheets → CRM visibility → Google Ads conversion → consent behaviour), which cannot be performed from this automated environment.

## Go / No-Go recommendation

**Go**, conditional on completing the manual checklist in `FINAL_LAUNCH_CHECKLIST.md` — in particular the one real booking test and confirming the admin Vercel project's environment variables are set correctly. No blocking technical issue was found in either app across this audit.
