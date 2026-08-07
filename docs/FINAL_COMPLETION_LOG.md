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
| QA | Mobile, schema, metadata, content, test and build sweeps | 1,206 tests pass; typecheck, lint and production prerender pass | Fixed and verified |
| Performance | Main client bundle remains a single 178.98 kB gzip chunk | Route splitting requires a separate SSR/client routing refactor; current bundle is usable but can be improved later | Optional follow-up |

## Owner inputs before deployment

These are intentionally not invented. The relevant pages are safe or noindexed until the information is supplied.

1. Replace the About-page team photo placeholder with a recent owner/team image. Add names, roles, DBS wording and who attends jobs only after confirming them.
2. Supply the real GA4 measurement ID if analytics is required. The invalid placeholder was removed; Google Ads remains consent-gated.
3. Confirm the published phone/WhatsApp hours and any commercial terms you want advertised. Current commercial copy promises only what is agreed in writing.
4. Add genuine area-tagged job photos, reviews or job notes. Only Islington and Stratford currently have enough exact local proof to be indexed; unsupported area pages remain `noindex`.
5. Confirm whether N6/Highgate is served. The current Highgate route asks for the postcode first and is excluded from the sitemap.
6. Review and approve the England tenancy-deposit article before removing its `noindex` tag.

## Deliberately not added

- Fake live-booking notifications, slot counters, countdowns or fabricated urgency.
- A dark-mode toggle that distracts from the booking journey.
- Unverified Trustpilot totals, customer numbers, team credentials or outcome claims.
- FAQ schema where the same questions and answers are not visible on the page.
