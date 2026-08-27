# Homepage simplification — second review

Requested: recheck the homepage against the simplification brief, do not
redesign it, and report whether any section can be removed or moved to a
service page without weakening conversion. Subjective changes are left for
owner review.

**Nothing in this document has been changed on the branch.** It is a report.
The one change I would make without hesitation is flagged as such and is
waiting on your word.

Measured 27 August 2026 against the built `dist/index.html`.

## What the homepage actually contains

12 sections, 2,250 rendered words in `<main>`, 11 `h2`, 12 `h3`.

| # | Section | Words | Share |
|---|---|---:|---:|
| 1 | Hero | 202 | 9% |
| 2 | Services — "Fixed-price cleaning, no surprises" | 271 | 12% |
| 3 | Trust badges | 26 | 1% |
| 4 | Our kit — "The equipment we bring" | 43 | 2% |
| 5 | Reviews — "Rated by London customers on Google" | 250 | 11% |
| 6 | Gallery — "Real jobs, real results" | 43 | 2% |
| 7 | Service selector — "What would you like cleaned today?" | 92 | 4% |
| 8 | Quote calculator — "Get an instant quote" | 88 | 4% |
| 9 | Guarantee | 132 | 6% |
| 10 | Areas we cover | 66 | 3% |
| 11 | **FAQ — "Before you book"** | **873** | **39%** |
| 12 | Contact | 164 | 7% |

## The finding

**The FAQ section is 39% of the homepage, and it is a byte-identical copy of
the standalone `/faq` page.**

Both render all **15** questions from the same `FAQS` array. The only
difference in the component is `<h1>` on `/faq` versus `<h2>` on the homepage
(`src/components/FAQ.tsx`, the `standalone` prop). Nothing is filtered.

At 873 words it is nearly **three times** the next-largest section, and it sits
between "Areas we cover" and the contact form — after the quote calculator,
where a visitor who has not yet converted is scrolling to decide.

This is the clearest remaining case in the brief's own terms: detail that has
a page of its own, duplicated in full on the homepage.

### Recommendation

Show a **short FAQ** on the homepage — the five or six questions that block a
booking — with a "See all questions" link to `/faq`. Something like:

1. When do I pay?
2. Can the price change?
3. Can I reschedule or cancel?
4. Which areas do you cover?
5. Do I need to be home during the clean?
6. How does the re-clean guarantee work?

Estimated effect: the FAQ section drops from ~873 to ~350 words, and the
homepage from 2,250 to roughly 1,730 — a **23% reduction** with no conversion
evidence lost, because every question remains one click away and `/faq`
already ranks for them.

**Conversion risk: low.** The questions most likely to block a booking stay
visible. The ones being moved are the long-tail ones (the carpet-discount
mechanics answer alone is 150 words).

**One caveat, stated plainly.** The homepage currently carries `FAQPage`
structured data for all 15 questions. Trimming the visible list means trimming
the schema to match — schema and visible copy must stay identical, which the
existing 29 parity specs enforce. `/faq` keeps the full set, so nothing is
lost from search; the questions move rather than disappear.

**I have not made this change.** It alters what a visitor sees on the most
important page, and the brief says to leave subjective changes for owner
review. Say the word and it is about twenty minutes' work plus tests.

## Sections I recommend keeping exactly as they are

| Section | Why |
|---|---|
| Reviews (250w) | Second-largest, and it is genuine third-party proof. This is the section that earns the booking. |
| Services (271w) | Answers "do you do what I need?" — the first question a visitor has. |
| Contact (164w) | The fallback for anyone the quote journey did not convert. |
| Guarantee (132w) | Already trimmed this pass: detailed exclusions moved to `/end-of-tenancy-cleaning-london#guarantee`, homepage kept the promise plus four qualifying conditions. |
| Our kit (43w) | Reviewed and kept. Three bullets and a photograph of the van is trust evidence, not a "detailed equipment explanation". |
| Gallery (43w) | Tiny, and it is real work. |
| Trust badges (26w) | Tiny. |
| Areas (66w) | Answers "do you cover my postcode?" — one of the four questions the brand guide says the site must answer quickly. |

## Competing calls to action

25 CTA-ish strings in `<main>`. That number sounds high but is not a problem in
practice: most are per-service "Get quote" buttons inside the service cards,
which is one dominant action per card, and the WhatsApp/phone pairs that the
brand guide explicitly permits alongside the main quote action.

Every section still has one visually dominant action. I found no section with
two competing primary CTAs.

## Length

2,250 words is reasonable for a service homepage that has to cover six
services, coverage, pricing and trust. Applying the FAQ recommendation above
brings it to roughly 1,730, which is comfortable. I would not cut further
without losing conversion evidence.
