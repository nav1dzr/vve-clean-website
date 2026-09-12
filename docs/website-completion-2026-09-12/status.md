# Website implementation record — 12 September 2026

The approved public website changes are implemented and locally validated on `feature/website-final-completion`, from baseline `7e999c80826ca5a8c88af1f583c8584a746cddcb`. Ready for owner review of the preview. This is not a production-release sign-off: factual decisions and connected-system checks remain below.

Implementation commit: `3231a8dd2560048b00c2d154b1fd6226b888a6db`, pushed to the existing `nav1dzr/vve-clean-website` completion branch. The initial automatic push review required destination verification; the read-only ownership and payload checks succeeded and the retry was approved.

## What changed

- Replaced the homepage slogan with the actual services and London coverage. Retained real hero photography, useful captions and a local fallback. Simplified service, guide, local and contact copy.
- Reorganised pricing into service tabs, Complete property prices and optional expanded explanations. Preserved the existing tariff. Fresh EOT quotes require a property-size choice; saved explicit Tailored choices survive.
- Added an explicit, reversible Complete comparison: one-bed Tailored with all listed interiors costs £279, equal to Complete; the comparable two-bed Tailored selection costs £349 against £339 Complete. The three specified EOT carpet areas cost £110, £15 below the applicable £125 standalone bundle; no universal 50% claim remains.
- Fixed old carpet selections overriding a deliberate new service, same-page basket resume/reset, and the EOT return-to-quote destination. Generic booking now starts with a service choice. Customer request screens use plain language and focus their success message.
- Replaced unsupported numerical checklist and universal approval claims with the published inclusions. Service pages have compact methods; the guides explain preparation, cleaning and aftercare. The sofa guide now has actual steps.
- Centralised direct-entry and client-navigation metadata. Kept 21 indexable sitemap URLs, two indexable local pages and 13 excluded local pages. Improved missing-link/404 headings and neutral payment-checking states without changing payment processing.
- Both Google-rating surfaces now show the same score, count, checked/updated date and source. The dated fallback is explicitly a snapshot. Managed media order respects published positions; unavailable hero images do not leave broken frames.
- Corrected the EOT bathroom/WC layout at 320px while retaining 44px controls. Kept readable WhatsApp green.

## Evidence

1,861 automated tests passed, zero failed, 259 were skipped/conditional. Lint: zero errors and seven existing Fast Refresh warnings. TypeScript, client build, SSR build and all 37 prerendered application routes passed; the not-found document and sitemap also built.

All 39 pages/states were opened in an isolated real browser. Expected local HTTP statuses passed, with no browser page errors, visible broken images or horizontal overflow at 1365, 390 and 320px. Representative desktop/mobile screenshots were visually inspected. The confirmation document has alternative hidden status headings; the initial visible state remains neutral.

Four full browser journeys passed: same-page basket resume/remove/start; £389 EOT with three carpet areas through booking and back; £349 Tailored/£339 Complete in both directions; and fresh sofa selection plus client-side metadata changes. Focused regressions also cover stale storage, restored extras, neutral payment failure/no-JavaScript states and shared FAQ scope.

Actual inbound links were clicked for all 32 application routes that have them; titles, canonicals and robots matched direct entry. Booking uses a quote-button journey, management uses signed email, leaflet is campaign entry, and Angel/Highgate have no public inbound anchor. These five were directly checked, not claimed as link clicks. Five keyboard checks passed (pricing, menu, gallery, basket and skip link), as did ten tablet checks at 768px with normal and doubled root text size. Doubled root text is not browser zoom or formal accessibility certification.

See [the page ledger](page-ledger.md), [validation summary](validation-summary.json) and [media handover](media-handover.md). Detailed local test reports and browser artifacts are retained outside the committed source. These checks are not a certification of accessibility or of live integrations.

## Decisions before production release

| Decision | Concrete item to review | Current treatment |
|---|---|---|
| Tax | Confirm whether VVE is VAT registered and whether all displayed consumer amounts include any applicable VAT. | No tax status or new amount invented. Final tax wording is not signed off. |
| Cancellation | Reconcile the existing noon-before and 24-hour wording, including what applies to a request versus an agreed booking. | Terms and payment behaviour retained; no new cancellation rule introduced. |
| Complete scope | Review the published kitchen, bathroom and room inclusions shown on the EOT guide and service page. | Unsupported “67-point” label removed; no fabricated task count. |
| Upholstery | Confirm cushion/back-surface coverage and dining-chair eligibility/price. | Suitability is assessed; no guessed inclusion or new price added. |
| Commercial jobs | Confirm normal payment timing and any exceptions. | Commercial copy says timing and payment terms are agreed in the quote. |
| Trust | Keep current insurance/review/real-job evidence available and approve names/roles for any new team media. | Existing evidence and claims preserved; no invented reviews, locations or guarantees. |

An additional-fridge/freezer Tailored selection currently cannot be compared fairly with Complete by the existing pricing engine. The new switch is withheld and the customer is asked to confirm scope, rather than silently dropping the extra unit or changing the calculation. Resolving that underlying tariff behaviour needs a separately approved pricing change.

The existing application bundle remains about 710 KB minified (186 KB gzip), triggering Vite's size warning. No measured production speed or conversion uplift is claimed. A route-splitting/performance pass remains a follow-up, to be assessed on the deployed build.

## Preserved boundaries

The original dirty checkout and unrelated artifacts were preserved. The release branch remains frozen at `f6bc7b0`. No catalogue, service identifier, request field, API implementation, Stripe rule, £30 deposit, production data, DNS, Ads setting or CRM/cloud account was changed. No package or integration was installed.

Local review builds direct optional public clients to the local server. That server cannot send real enquiries or mutate bookings. Live delivery to the admin inbox, CRM editing, payment/email automation, cloud uploads and the review feed need separate connected verification; this website work does not prove them working. Production publishing needs its own approval.

## Preview and release record

Vercel reports the exact implementation commit as READY on the feature preview:
https://vve-clean-website-1xtg9mjai-nav1dzrs-projects.vercel.app

Deployment `dpl_9VYeu2Qyp2yVymYejzg8QQPTUFoA` has preview target and only the existing feature-branch alias. Direct HTML checks for home, pricing, EOT, contact, blog and an unknown route redirect to the existing Vercel authentication. The connected HTML fetch also received the authentication redirect. Therefore the platform build is verified, while authenticated deployed browser behaviour and actual deployed 404 remain unchecked. The complete local browser evidence is not presented as a deployed test.

Review the preview while signed into the owning Vercel account, then resolve the factual decisions above before approving production publication. The documentation commit contains no application changes.
