# "The Work Behind" redesign — handoff

23 November 2026. Branch `design/work-behind-preview-20261123`, based on live `main` `9dd9c17`. **Local only: not pushed, merged or deployed. No production, pricing, booking, payment or database change.**

## What is built

One connected journey in the owner-selected concept: **homepage → End of Tenancy → quote → booking request**.

| Route | Now renders | Notes |
|---|---|---|
| `/` | `src/pages/WorkBehindHomePage.tsx` | Concept layout, shorter copy, job photos, one price per service, one gold action |
| `/end-of-tenancy-cleaning-london` | `src/pages/WorkBehindEndOfTenancyPage.tsx` | Same quote wizard, FAQ text and schema as before |
| `/booking` | existing `BookingPage.tsx`, re-themed | Markup, validation and submission unchanged |

The old `HomePage.tsx` and `EndOfTenancyPage.tsx` are kept. **Rollback:** point the two imports in `src/ServerAppRoutes.tsx` and `src/clientRoutePages.ts` back to them.

## How it is put together

- **`src/styles/work-behind.css`**: everything scoped under `.wb`. Tokens are sampled from the hero photo: wall `#8AA1E6`, carpet `#0B4687`, ink `#141C2A`, gold `#F2AE1C`. Type is Barlow Condensed capitals for display and Barlow for text, loaded in `index.html`.
- **`.wb-legacy`** re-themes existing components (quote wizard, booking form, `FAQ`, `GuaranteeTerms`) by overriding their Tailwind colour, radius and font classes. Status colours (amber, green, red) are left alone. Primary buttons carry `wb-cta` and turn gold.
- **`src/components/workbehind/WbChrome.tsx`**:
  - `WbHeader`: ink bar, real `BrandLogo` (inverse), menu on phones.
  - `WbFooter`: includes **Cookie settings**.
  - `WbDock`: mobile action that follows `BookingContext`; with `watch="#quote"` it steps aside while the quote's own step bar is on screen.
  - `WbLink`: internal and `#hash` links go through the router so the existing scroll-to-top logic focuses the target.
- **`src/components/workbehind/wbMedia.ts`**: concept photos in `public/images/work-behind/*.webp`. Hero and service photos still read the CRM media positions (`homepage-hero-image`, `homepage-end-of-tenancy-image`, `homepage-sofa-image`, `service-end-of-tenancy-hero`), so a photo published in CRM Media replaces the concept photo. If one is already published in production it will show instead.
- **`src/data/endOfTenancyContent.ts`**: End of Tenancy FAQ and schema, now shared by the old and new page.
- **Sources for claims:** every price comes from the live catalogue (`src/data/pricing`, `shared/afterBuildersGuide.js`). Policy sentences come from `businessPolicy.ts`. Reviews come from `reviews.ts`, and the rating from `googleRating.ts`.

## Recipe for the remaining pages (repeatable work for Opus)

For each page: carpet, sofa, after builders, commercial, pricing, gallery, about, contact, FAQ, area pages, How-we-clean pages, blog, legal.

1. Create `WorkBehind<Name>Page.tsx`. Wrap it in `BookingProvider` and `WbPage`, and use `WbHeader` (with `ctaHref` set to the page's quote anchor), `WbFooter` and `WbDock`.
2. Build the hero from `.wb-hero`: `h1` on the wall colour, job photo, then a price line and one gold `WbLink` on the carpet colour. Take the photo from the page's existing CRM media position, with a fallback.
3. Reuse section classes rather than adding new CSS: `.wb-sec` (plus `--mist`, `--carpet`, `--ink` or `--wall`), `.wb-h2`, `.wb-sub`, `.wb-grid` and `.wb-job`, `.wb-pairs`, `.wb-list`, `.wb-table`, `.wb-steps`, `.wb-terms`, `.wb-faq`, `.wb-quotes`, `.wb-last`.
4. Wrap any existing interactive component (quote calculator, enquiry forms, gallery) in `<div className="wb-legacy">` rather than rewriting it. Keep all pricing and booking logic in place.
5. Keep each page's schema and FAQ text in a shared data module, as `endOfTenancyContent.ts` does, so visible text and structured data match.
6. Swap the route import in both route files.
7. Update tests that assert old labels, and add the page to `INTENTIONAL_SUPPRESSIONS` in `MobileStickyFooter.coverage.test.tsx` with its `WbDock` call.
8. Validate: root `lint`, `typecheck`, `test` and `build`, then a 390px phone check with no sideways scroll.

## Homepage fidelity pass (23 November 2026)

Homepage checked section by section against the owner's concept ZIP at 390px and 1280px (headless Chromium captures, concept left, preview right). Restored: concept section order (stacked before/during/after on phones, then the extraction-tank section); tall 4:5 captioned service photos with the stair job first; office before/after with caption and both actions in the commercial section; concept wording for the hero, strip, tank, services, pairs, crew and steps; two-column desktop layouts for terms, reviews, commercial and areas; concept type sizes; underlined card links.

Deliberate differences from the ZIP: the real VVE logo instead of the concept's type mark; review quotes shown in full from `reviews.ts` rather than shortened; no "certificate available on request" or "furniture slides" claims (not on the current site); deposit wording from `CONDITIONAL_DEPOSIT_NOTE`; the six-question FAQ stays above the final call for its structured data; tablet widths (700–1000px) use two card columns.

Captions under CRM-managed card photos use the CRM label when a CRM photo replaces the concept photo.

## Known gaps on the built journey

- **Booking page:** a few inline colours are still the old blue — the selected price, "Change service" and step badges (`#0369a1` set inline in `BookingPage.tsx`). Move them to classes so the theme can reach them.
- **Quote wizard:** its heading still reads "Get your instant quote", and its review step still says "The remaining balance is due on the day of the clean" (audit F-08). Wording about payment needs Navid's approval before it changes.
- **Homepage:** the old homepage contact form and the large quote calculator are not on the new homepage. Move-in now links to `/booking`, which offers the calculator. Contact remains at `/contact`.
- **Images:** they are not responsive (`srcset`) yet. The largest concept image is 140 KB.
- **Not yet checked:** a physical iPhone or Android; a hosted Vercel preview; Lighthouse.

## Checks run (local, 23 November 2026)

| Check | Result |
|---|---|
| Root `npm run lint` | 0 errors, the existing 7 Fast Refresh warnings |
| Root `npm run typecheck` | passed |
| Root `npm test` | 171 files, 2,795 passed, 327 skipped |
| Root `npm run build` | passed; all routes prerendered |
| Phone emulation 390×844 (headless Chromium) | No sideways scroll on all three pages. Homepage hero "Get my price" focuses services; the End of Tenancy card opens the page; the hero button focuses `#quote`. A 2-bed flat costs £339 in the quote, the booking request and the WhatsApp draft. The dock shows before the quote, hides while it is on screen and returns after it. |

Four existing tests were updated because they named old labels: the hero button text, the "Gallery" link (now "Our work"), and the dock coverage list. Two real gaps found by tests were fixed: the footer's **Cookie settings** button, and the approved booking-request sentence on the End of Tenancy page.

## Parked for the Opus handoff (unchanged by this branch)

- [nav1dzr/vve-clean-website#80](https://github.com/nav1dzr/vve-clean-website/pull/80): booking date and pricing fixes, all checks passing. The hosted preview test needs a Vercel sign-in.
- Stripe invoice-payment guard: local commit `20092d3` on `fix/stripe-invoice-payment-guard-20261123`, not pushed.
- Scheduled-invoice setup check: read-only, needs a Supabase, Vercel and CRM sign-in. The scheduler stays off; never call the email worker.
- The unused worktree `.claude/worktrees/stripe-invoice-guard-20261123` was left in place as instructed.

## Approval boundaries

Pushing this branch, opening a pull request, any hosted preview, merging and deploying each need Navid's explicit approval. Payment wording, deposit text, prices, guarantees and new business claims are out of scope for design work.
