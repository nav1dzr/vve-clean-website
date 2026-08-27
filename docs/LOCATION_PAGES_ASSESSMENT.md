# Location pages — assessment, and why none were published

Requested: four location pages (Hackney, Islington, Stratford, Walthamstow),
with the explicit instruction *"If sufficient genuine unique content cannot be
produced without inventing facts, do not publish thin pages. Report that
limitation instead."*

**Outcome: none published.** This is that report.

## What genuinely exists, per area

| Asset | Hackney | Islington | Stratford | Walthamstow |
|---|---|---|---|---|
| Confirmed in coverage list (`Areas.tsx`) | ✅ | ✅ | ✅ | ✅ |
| Postcodes in `areaServed` (`index.html`) | E8, E9 | N1, N5, N7 | E15, E20 | E17 |
| Adjacent covered areas | Dalston, Shoreditch, Bethnal Green, Bow | Highbury, Holloway, Finsbury Park, Stoke Newington | Bow, Canary Wharf | Tottenham, Walthamstow only |
| **Real area-tagged Google review** | ❌ | ✅ Hannah M., N1 | ✅ Ahmad B., E15 | ❌ |
| Area-tagged job photographs | ❌ | ❌ | ❌ | ❌ |
| Local case studies / named jobs | ❌ | ❌ | ❌ | ❌ |
| Documented response times or availability | ❌ | ❌ | ❌ | ❌ |

Two further facts are real, verifiable and useful, and apply to all four:

- **No travel surcharge.** Verified — nothing in `src/data/pricing.ts` or
  `src/data/carpetPricing.ts` varies by postcode, zone or distance. "The same
  fixed price in E17 as in N1" is a true and genuinely useful statement.
- The full service, price and guarantee set already published site-wide.

## Why that was not enough

Strip out what is identical across the four pages — services, prices,
guarantees, process, drying times, gallery, quote journey — and what remains
that is genuinely *area-specific* is:

1. a postcode list,
2. a list of neighbouring areas, and
3. for two of the four, one real customer review.

Hackney and Walthamstow have only (1) and (2). Two pages differing from each
other by a postcode list and an area name, on top of otherwise identical
content, is the textbook definition of a doorway page. Google's guidance names
this pattern explicitly, and the penalty is not confined to the thin pages — it
is a site-level quality signal, on the same domain as the service pages that
are currently ranking and that this branch has just spent effort improving.

Publishing two good pages (Islington, Stratford) and two thin ones would take
that risk for the weakest half of the set. Publishing all four "for
consistency" takes it for no gain at all.

The alternative — writing local colour about Victorian terraces in Walthamstow
or new-build flats around the Olympic Park — would be inventing claims about
VVE's work that no source in this project supports. That is exactly what the
brief prohibits, and it is the kind of detail a local reader spots.

## What would make them publishable

Per area, **any one** of the following closes the gap. None requires a code
change — they are content the business already has or can capture in a week:

1. **One genuine area-tagged Google review.** Islington and Stratford already
   have one each; that is what makes those two viable today. Two more reviews,
   tagged Hackney and Walthamstow, and all four pages have real local proof.
2. **Two area-tagged job photographs** — before/after or in-progress, with the
   area recorded. The manifests (`galleryMedia.ts`, `sofaMedia.ts`) carry no
   location field today; adding one is a small, safe change once there are
   photos to tag.
3. **A short, true local job note** — "three-bed terrace, E17, end of tenancy,
   carpets and oven" — with no invented outcome. Three or four of these per
   area is enough for a page that reads as genuinely local.

## Recommended sequence

1. Collect the two missing reviews (this is also what item 9's review-request
   workflow is for — it is the same bottleneck).
2. Add a `location` field to the gallery manifests and tag existing photos
   where the area is actually known.
3. Then build all four pages from one shared, data-driven component so they
   cannot drift, each carrying its own real proof.

Building the pages is a few hours' work and is not the hard part. The content
that makes them worth indexing is the hard part, and it is not code.

## Addendum (2026-08-07) — 15 pages shipped, per explicit owner sign-off

As part of a broader SEO growth request, Navid explicitly reviewed this
assessment and instructed: build all 15 pages now (not just the original
four), structured exactly as the "What would make them publishable" section
above describes — real postcode(s), real neighbouring-area data, the one
universally true pricing fact (no travel/postcode surcharge), and review/
photo proof slots that render only when real data exists.

This is not a reversal of the rule above. It is the honest implementation the
rule was asking for, applied now rather than after collecting more reviews
first:

- Postcodes are drawn only from `COVERAGE_POSTCODES` in
  `shared/pricingCatalogue.js` (the single canonical coverage list) — an area
  whose real postcode isn't in that list (Highgate/N6) gets no postcode
  claim rather than an invented one.
- Neighbour lists are drawn only from names already published in
  `Areas.tsx`/`AreaMarquee.tsx`.
- `AreaProofSection` (`src/components/areas/AreaProofSection.tsx`) renders
  nothing when an area has no real review, tagged photo, or job note —
  exactly the "None requires a code change" bar this document set. Nothing
  is fabricated to fill an empty slot.
- Indexability is computed per area
  (`src/lib/areaProof.ts:areaHasRealProof`), not asserted for all 15: a page
  ships `noindex, follow` until it has real proof, then flips to
  `index, follow` automatically once that proof exists — no redeploy needed
  beyond adding the data. As of this addendum, that's **Islington and
  Stratford** — the two the table above already flagged, and no others.

The residual risk this document raised — thin, duplicate-reading pages as a
site-level quality signal — is managed by that `noindex` default, not
eliminated by asserting all 15 are equally strong. See
`src/data/areas.ts`, `src/data/areas.test.ts` (postcode/neighbour
data-integrity guard) and `prerender.mjs` for the implementation.

### Correction (27 August 2026)

The paragraph above previously listed **Angel** as indexable, on the grounds
that it shares Islington's N1 postcode district with a real tagged review.
**That was wrong**, and it contradicted both the code and the sitemap.

`matchesNamedArea` requires an **exact named-area match**. Sharing a postcode
district is deliberately not enough — this is the same defect the completion
log records as fixed ("Angel inherited an Islington review through shared
N1"). Angel ships `noindex, follow`, which is correct.

Indexable today, verified against `src/lib/areaProof.ts`, the `index, follow`
pages in `dist/`, and `dist/sitemap.xml` — all three agree:

| Area | Indexable | Proof |
|---|---|---|
| Islington | Yes | Google review, Hannah M., N1 |
| Stratford | Yes | Google review, Ahmad B., E15 |
| The other 13 | No | None yet |

`tests/areaIndexability.test.js` now asserts this agreement, so documentation
cannot drift from the code again.
