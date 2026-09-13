# Website completion handover — 13 September 2026

The public website implementation is complete for this review, with one scope confirmation still outstanding. This record supersedes the open VAT, cancellation, commercial-payment, route-loading and public media-mapping items in the 12 September status. Production publication and connected booking/media services are separate statuses below.

Review: [https://vve-clean-website-9ckktsc5b-nav1dzrs-projects.vercel.app](https://vve-clean-website-9ckktsc5b-nav1dzrs-projects.vercel.app)
Implementation through `fcec1d44612df7f7f0ab97bb094b2dde075f0439` on `feature/website-final-completion`. The prior completed website phase is `3231a8d`; the starting approved preview is `7e999c8`. The release branch stays frozen at `f6bc7b0`.

## Completed website work

- Plain service-led wording, retained real hero images, clearer pricing sections, service-specific cleaning methods and useful local/guide content.
- Complete-first end-of-tenancy prices with property assumptions, actual inclusions, separate extraction/extras and reversible comparisons. Existing amounts are preserved; a price reduction has not been invented or approved. Complete and Tailored remain distinct services.
- Saved basket, service switching, booking return links and accurate request/confirmation wording. £30 remains the agreed-offer deposit; the initial website request is free.
- Consistent score/count/date on Google-review surfaces. The current fallback is the verified 5.0/26 snapshot checked on 8 September, visibly dated. It is not described as an automatically refreshed live feed.
- Consistent route content, titles, canonicals and existing index/noindex choices, including useful missing-page recovery. All 15 local routes are covered.
- Shared gallery/result-to-hero mapping for carpet, sofa and EOT. The first assigned service result supplies its hero, or the first gallery result when no service-result assignment exists. A complete pair supplies the after image; clips and unusable images retain a genuine local fallback. Published replacements refresh on page load/window focus. The homepage retains its own slot. See the [exact maintenance guide](../website-completion-2026-09-12/media-handover.md).
- Page code loads by route while keeping the initial prerendered content until its interactive page is ready. Slow or failed page downloads have loading/recovery states; route focus, quote anchors and saved selections are preserved.

## Your confirmed business facts

These decisions came directly from Navid's replies on 13 September and now appear in the public website:

| Decision | Published treatment |
|---|---|
| Not VAT registered | “No VAT is added. VVE Clean is not VAT registered.” beside pricing/quote totals and in Terms/FAQ. Existing amounts unchanged. |
| At least 24 hours' notice | Cancellation/rescheduling is measured from the agreed arrival time. Free rescheduling is subject to availability. Short-notice charges require prior written agreement; no automatic forfeiture is introduced. |
| Commercial payment after cleaning | Due after the clean unless a different arrangement was agreed in writing in advance. The old 14-day default is removed from Terms and commercial billing copy. |

Website Terms and cancellation versions advance together to `2026-09-13`. Refund review and statutory rights remain separate from the business notice window. Existing historic acceptances are not rewritten. The separate CRM agreement snapshot still uses its earlier version and must be aligned when connected booking work is authorised; website validation does not claim that has happened.

## What you need to do

1. **Check the [Complete cleaning checklist](https://vve-clean-website-9ckktsc5b-nav1dzrs-projects.vercel.app/end-of-tenancy-cleaning-london#checklist) matches what your team actually cleans.** It currently covers oven/hob/grill/extractor, listed appliance interiors, empty cupboards/drawers/wardrobes, bathrooms, accessible internal windows, skirting/doors/switches, vacuuming and mopping. Professional carpet extraction and other listed extras are separate. The existing question is still pending; no new tasks or numerical checklist have been invented.
2. **Review the final preview.** Stronger genuine photos/videos can be supplied gradually using the media list. Loose cushions, unusual furniture and dining chairs remain assessed individually; no guessed price blocks this website review.
3. **After the scope is confirmed, approve a specifically prepared production release.** The current branch is still a preview. Its full difference from production includes older work, so any release must review the complete payload and connected configuration before merging or publishing.

You do not need to open another project, install a plugin or create a third Supabase project for these public website improvements.

## Verification and practical limits

1,904 automated tests passed, zero failed; 275 existing/conditional tests were skipped. The 16 additional skips compared with 12 September are generated rating checks for eight new source files; no route tests were removed. Typecheck, client build, synchronous server render and prerender passed. Lint has zero errors and seven existing development Fast Refresh warnings. The sitemap still contains 21 indexable URLs.

All 39 local routes/states were checked at 1365, 390 and 320 pixels: no horizontal overflow, visible broken images or browser page errors. The missing-page route returns HTTP 404 locally. Four complete browser journeys passed: basket resume/reset; £389 EOT with selected carpet areas through booking/back; £349 Tailored versus £339 Complete in both directions; and fresh sofa selection plus internal metadata changes. A subsequent two-line correction prevents gallery category changes from resetting focus; it was rebuilt, covered in the final full suite and retested with keyboard input in desktop/mobile browsers. The earlier 32 internal-link checks, five keyboard checks and ten tablet/enlarged-text cases remain recorded in the [12 September evidence](../website-completion-2026-09-12/status.md); they are not represented as newly rerun today.

The exact code preview is READY on Vercel and was inspected in the authenticated browser for home, pricing, EOT, Terms, commercial, contact and missing-page recovery. No real enquiry, email, payment or booking update was submitted. Authenticated rendering does not itself establish the server's deployed HTTP status code.

Built initial-route JavaScript dependency sizes, summed per-file gzip: homepage 163.58 KB versus 207.07 KB (about 21% less); pricing 113.98 KB (about 45% less); EOT 163.03 KB (about 21% less). Largest individual minified JS chunk: 174.69 KB. These are build measurements, not a claim about real-user speed or conversions.

## Connections still needing separate work

| Connection | Known position | Remaining proof |
|---|---|---|
| Booking → CRM/admin inbox → offer → £30 → confirmation/change/cancel emails | Earlier implementation exists; the public website is validated using controlled tests. | An isolated end-to-end test with synthetic records, an approved test inbox, test payment and updated agreement policy. Delivery to the real admin inbox is not certified. |
| Media uploads | Existing R2/Mux setup and earlier fixes are documented. Website reference mapping and simulated replacement tests pass. | Actual upload progress, processing, source assignment, publishing, replacement and failed-upload recovery in CRM. |
| Automatic Google score | Shared website display and dated verified fallback work. | Existing feed refresh/credentials and provider delivery. No new provider installed. |
| Live managed prices | Website uses the existing central catalogue and tested quote logic. | Connected managed-price publication/refresh, separately from this presentation work. |

The previously selected VVE TEST database could not resume because of Supabase free-project capacity. Both active projects are in use. Do not repurpose either. Test capacity needs resolving only for the connected work above; it is not a reason to create a new database for the website itself.

Prices, policies, reviews and contact details will need ordinary maintenance alongside photos and videos. Lower EOT tariffs need actual job-cost evidence and a separately approved pricing decision. Ads, Search Console, Business Profile and other external settings remain outside this website scope.

No production data, DNS, Stripe behaviour, £30 deposit, catalogue amount, API/admin implementation or external account was changed in this final phase. No dependencies were installed. The original dirty checkout and unrelated files were preserved. Production publication requires Navid's specific release approval under the repository rules.
