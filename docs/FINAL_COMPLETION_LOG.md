# Website final completion log

This is the working record for the mobile-first completion branch. Items remain open until verified in the built preview.

| Area | Issue found | Action | Status |
|---|---|---|---|
| Pricing | Conflicting legacy page was resolved upstream | Keep one generated pricing catalogue and regression tests | Fixed and verified |
| Booking | Deposit copy implied a confirmed slot | Standardised to booking request and separate availability confirmation | Fixed |
| Accessibility | Primary blue and WhatsApp buttons failed contrast | Introduced accessible action colours | Fixed |
| Mobile navigation | Closed menu links remained focusable | Remove closed menu from the DOM and restore focus on Escape | Fixed |
| Keyboard | No skip link or route focus movement | Added skip link and route heading focus | Fixed |
| Booking form | Validation scrolled without focusing the invalid field | Focus first invalid control and add required/live semantics | Fixed |
| Booking semantics | Initial service-selection view had no H1 | Added a route-specific, screen-reader-visible H1 without duplicating the calculator heading | Fixed |
| Trust | No dedicated About, Contact or FAQ routes | Added substantial routes with safe copy and structured data | Fixed |
| Staff | Site-wide personnel claims lacked a source of truth | Replaced with direct-contact language; team details remain placeholders | Fixed pending owner assets |
| Schema | FAQ and service schema used inconsistent coverage or hostnames | Added visible FAQ schema where relevant and standardised the `www` host | Fixed |
| Locations | Angel inherited an Islington review through shared N1 | Reviews now require an exact named-area match | Fixed |
| Locations | Highgate was presented as confirmed coverage | Page now asks for postcode confirmation and remains noindex | Fixed |
| Content | Carpet and sofa pages made unsupported health/outcome claims | Replaced with method, suitability and result-variation language | Fixed |
| Commercial | Timing, staffing, document and payment claims needed confirmation | Replaced with written-scope and quote language | Fixed pending owner confirmation |
| Mobile | Homepage service cards created excessive scrolling | Converted to compact two-column cards and separate carpet/sofa intents | Fixed |
| Performance | Homepage hero preload appeared on every route | Route-limited preload and responsive AVIF/WebP derivatives | Fixed |
| Analytics | Placeholder GA4 measurement ID made a bogus request | Removed placeholder configuration | Fixed pending real ID |
| SEO | SPA navigation left stale page titles | Added route-aware client titles | Fixed |
| SEO | A stale global `noscript` block duplicated the H1 and old price claims on every prerendered page | Removed it; the production site is already server-rendered | Fixed |
| Page semantics | Standalone Contact and FAQ reused homepage H2 headings | Render H1 on standalone routes and H2 when embedded | Fixed |
| Forms | Calculator choices relied on colour alone | Added fieldset/legend structure, selected-state semantics and 44px targets | Fixed |
| Focus | EOT step changes and cookie settings lost user context | Focus the new step heading and restore the cookie-settings opener | Fixed |
| Blog | Legal guidance lacked sources and current review | Added GOV.UK sources and kept post noindex pending editorial sign-off | Fixed pending sign-off |
| Media | Owner unsure how many photos can be uploaded | Added an asset workflow and size targets | Fixed |
| Dependencies | Production and development advisories were present | Applied compatible targeted upgrades; `npm audit` now reports zero known vulnerabilities | Fixed and verified |
| QA | Mobile, schema, metadata, content, test and build sweeps | 1,261 tests pass; typecheck, lint and production prerender pass | Fixed and verified |
| Visual feedback | The accessible dark-blue treatment felt too heavy and flat | Rebalanced heroes to a fresh teal-blue palette with a pale aqua accent; retained AA contrast | Fixed and verified |
| Process FAQs | “How we clean” pages had only two or three useful questions and duplicated schema manually | Expanded each page to seven or eight questions and generate visible accordions and schema from one source | Fixed and verified |
| Performance | Main client bundle remains a single 178.98 kB gzip chunk | Route splitting requires a separate SSR/client routing refactor; current bundle is usable but can be improved later | Optional follow-up |

## Independent review pass (8 August 2026)

A read-only review of the built `dist/` output, not just the source, found the
following. Everything below is now fixed on this branch.

| Area | Issue found | Action | Status |
|---|---|---|---|
| Schema | Six pages kept two hand-written FAQ literals — one visible, one for `FAQPage` — and they had drifted. The schema copy of the end of tenancy re-clean guarantee had **lost its exclusions**; the commercial carpet schema still claimed "Many offices and landlords book us" with "priority scheduling and consolidated monthly invoicing" after the visible copy had been corrected | Every page now derives both from one `FAQS` array, the pattern the How-we-clean pages already used. `src/pages/faqSchemaParity.test.tsx` checks question **and answer** parity on 12 pages plus all 15 area pages, and pins the guarantee exclusions and the sofa no-stain-guarantee wording | Fixed and verified |
| Trust | `/about` showed a customer-facing "Team photo placeholder — Replace this with a clear, recent photo…" card. `noindex` kept it out of Google but not out of the nav, where About is the first link on every page | Replaced with a finished "VVE Clean at a glance" panel carrying only verifiable facts (services, coverage, insurance, published pricing). No team claim of any kind. An approved photograph can replace the card in the same grid column later | Fixed |
| Indexing | `/about` was `noindex` solely because of that placeholder | Now indexable; the recorded reason no longer existed | Fixed |
| Performance | Every `ServiceLandingLayout` page (5 service + 3 process + 15 area = 23 prerendered routes) shipped its H1, badges and both hero CTAs inside `opacity-0`, because `useReveal` starts hidden and only flips in an effect. The prerendered HTML painted an empty navy panel until the client bundle hydrated | Hero renders unconditionally; below-fold reveals unchanged. `ServiceLandingLayout.heroVisible.test.tsx` asserts against the **server** render, the artefact prerender.mjs writes | Fixed and verified |
| Commercial | Four `/commercial-carpet-cleaning-london` benefit cards still promised no disruption, RAMS "before any job starts", 2–3 hour drying, priority booking and consolidated invoicing, and the heading implied an existing facilities-management client base — contradicting the corrected `whyPoints` and FAQs on the same page | Rewritten to written-scope language only. Heading is now "What we agree before a commercial carpet clean" | Fixed |
| Mobile | `mobile-page-bottom` (56px + `env(safe-area-inset-bottom)`) was used on four pages; 28 others used a flat `pb-[56px]` while the sticky bar adds the safe-area inset to its own height. On a phone with a home indicator the last ~34px of those pages sat under the bar | All six layouts/pages that render `MobileStickyFooter` now use the safe-area utility | Fixed |
| Accessibility | `silver-600` was `#8d97a0` — 2.97:1 on white, under the 4.5:1 AA floor — and the scale was non-monotonic (`600` was lighter than both `500` and `700`), so reaching for a "darker" token produced the one failing value. Used for quote-calculator helper text, cookie-consent descriptions and the contact confirmation | Scale is monotonic and AA-compliant at the dark end: `500` 4.76:1, `600` `#566274` 6.19:1, `700` `#47505e` 8.15:1 | Fixed |
| Schema | The sitewide `hasOfferCatalog` omitted carpet, sofa & upholstery and after-builders — the three services with their own indexable landing pages and priced offers — and listed "Deep Cleaning", a name matching no page and no published price. Inherited by every prerendered page | Catalogue now lists the six services actually sold, each linked to its page. "Deep Cleaning" became "Move-in Deep Clean": the pricing table's own name for it, and what the homepage selector books (`quoteService: 'move_in'`) | Fixed |
| Conversion | In the `manual` state the mobile sticky bar rendered two solid green WhatsApp buttons flush against each other, with no dominant action | Primary action is always blue; WhatsApp stays secondary. One green action in the bar, asserted by test | Fixed |
| Copy | The most-tapped mobile CTA said "Book — £30 deposit"; the quote calculator and page CTAs said "Book online". The deposit buys a booking **request** and availability is confirmed separately | All visible booking labels use "Request booking" language. The booking page's own copy was already correct | Fixed |
| Trust | The homepage guarantee section was headed "72-Hour Re-clean Guarantee" with no service named, so a carpet or sofa customer could read it as sitewide | Heading and eyebrow now name end of tenancy. The covered/not-covered lists are unchanged | Fixed |
| Performance | No `Cache-Control` on content-hashed bundles, so ~765 kB revalidated on every navigation under Vercel's static default | `/assets/(.*)` is `public, max-age=31536000, immutable`. HTML deliberately still revalidates so deploys reach cached visitors | Fixed |
| Tooling | `npm test` was flaky at Vitest's 5s default — two consecutive runs failed 9 then 11 specs from *different* files, all timeouts, while the same suite passed 1209/1209 at a higher timeout. A slow CI runner would go red with no real defect | `testTimeout: 20000` in `vite.config.ts` | Fixed and verified |
| Design | Navbar brand tagline rendered at 7px on mobile | Raised to 10px/11px; header controls keep their 44px targets | Fixed |
| SEO | `<html lang="en">` while all copy is British English and `confirmation.html` already said `en-GB`; homepage canonical was the bare origin while its sitemap `<loc>` had a trailing slash | `lang="en-GB"`; homepage canonical is `https://www.vveclean.co.uk/`, matching the sitemap | Fixed |
| Copy | Pricing H1 promised "Zero Surprises" while the FAQ below explains when a price can change; after-builders copy used "spotless" twice, once inside `Service` schema | "Published Prices, Shown Before You Book"; "spotless" replaced with what is actually done | Fixed |
| Booking | The retired `public/booking.html` compatibility shim shadowed the prerendered `/booking/index.html` in local production preview and redirected `/booking` back to itself | Removed the obsolete shim and added a one-way Vercel redirect from `/booking.html` to the real `/booking` route | Fixed and verified |
| Accessibility | The booking notes counter and a 10px pricing note used low-contrast silver tokens | Moved both to AA-readable tokens for their respective backgrounds | Fixed |
| Gallery | The page reserved 56px for a sticky footer it does not render | Removed the unused mobile bottom reserve | Fixed |
| Mobile landscape | The standalone booking selector relied on an IntersectionObserver reveal and could remain `opacity-0` on a short landscape viewport | Added an explicit above-fold mode for `/booking` and an SSR regression test; lower-page calculator reveals remain unchanged | Fixed and verified |

## Owner inputs before deployment

These are intentionally not invented. The relevant pages are safe or noindexed until the information is supplied.

1. Supply a recent owner/team photograph for the About page when one is available. The page is complete and indexable without it — the "at a glance" card sits in the slot a photo would take. Add names, roles, DBS wording and who attends jobs only after confirming them.
2. Supply the real GA4 measurement ID if analytics is required. The invalid placeholder was removed; Google Ads remains consent-gated.
3. Confirm the published phone/WhatsApp hours and any commercial terms you want advertised. Current commercial copy promises only what is agreed in writing. If out-of-hours availability, RAMS turnaround, typical drying time, priority scheduling or consolidated invoicing **are** things VVE Clean offers, say so and they can go back on `/commercial-carpet-cleaning-london` as stated facts.
4. Add genuine area-tagged job photos, reviews or job notes. Only Islington and Stratford currently have enough exact local proof to be indexed; unsupported area pages remain `noindex`.
5. Confirm whether N6/Highgate is served. The current Highgate route asks for the postcode first and is excluded from the sitemap.
6. Review and approve the England tenancy-deposit article before removing its `noindex` tag.

## Deliberately not added

- Fake live-booking notifications, slot counters, countdowns or fabricated urgency.
- A dark-mode toggle that distracts from the booking journey.
- Unverified Trustpilot totals, customer numbers, team credentials or outcome claims.
- FAQ schema where the same questions and answers are not visible on the page.
