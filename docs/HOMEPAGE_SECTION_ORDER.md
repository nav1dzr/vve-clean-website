# Homepage section order — before and after

Completion brief §9: make the homepage easier to scan without removing
conversion evidence.

## The change

| # | Before | After | Why |
|---|---|---|---|
| 1 | Hero | Hero | Unchanged — the promise leads. |
| 2 | AreaMarquee | AreaMarquee | Unchanged. |
| 3 | TrustBadges | **Services** | A visitor's first question is "do you do the thing I need?". Services now answers it before anything asks for trust. |
| 4 | **HomeServiceSelector** | TrustBadges | Trust follows the offer rather than preceding it. |
| 5 | **QuoteCalculator** | **OurKit** | Equipment evidence joins the trust block instead of sitting alone late in the page. |
| 6 | Reviews | Reviews | Now reads as proof of the trust claims just made. |
| 7 | Gallery | Gallery | Real results, immediately after the reviews. |
| 8 | **Guarantee** | **HomeServiceSelector** | The quote entry now arrives *after* the case has been made, not before it. |
| 9 | **OurKit** | **QuoteCalculator** | Unchanged pairing — see constraint below. |
| 10 | **Services** | **Guarantee** | The guarantee answers the objection the price has just raised. |
| 11 | Areas | Areas | Coverage after the price, as the brief specifies. |
| 12 | Contact | **FAQ** | Remaining questions before the fallback contact route. |
| 13 | FAQ | **Contact** | Direct contact last, for anything the FAQ did not answer. |

Resulting order: **promise → services → trust → proof → price entry →
coverage → FAQ**, which is the brief's requested sequence.

## Detail moved off the homepage

The guarantee section carried a two-column breakdown: four "what's covered"
bullets and **seven "not covered" bullets** — eleven lines of terms on the
homepage.

- The homepage now shows the promise, the four qualifying conditions, and one
  sentence naming the main exclusions, linking to the full terms.
- The complete covered/not-covered breakdown moved to
  `/end-of-tenancy-cleaning-london#guarantee`, the page the guarantee actually
  belongs to, as a new `GuaranteeTerms` section between pricing and the FAQ.
- Both render from `src/data/guarantee.ts`, so the short and long versions
  cannot drift apart.

`OurKit` was reviewed and **kept**. The brief mentions moving "detailed
equipment explanations", but this section is three bullets and one photograph
of the van — genuine trust evidence, not a detailed explanation. Removing it
would cost proof for no scanning benefit.

## Measured effect

| | Before | After |
|---|---|---|
| Prerendered homepage HTML | 165,295 bytes | 161,240 bytes |
| Guarantee bullets on homepage | 11 | 4 + 1 summary sentence |

## What did not change

- **The quote journey.** `#quote` still resolves to the calculator. The
  sticky bar, the 404 page's "Get a quote" and every in-page CTA scroll to the
  same place.
- **The selector/calculator pairing.** `HomeServiceSelector` sets the
  calculator's service and the calculator remounts on that change, so nothing
  may be rendered between them. A test asserts this.
- **Genuine reviews and results.** Every review and gallery item is retained;
  only their position changed.
- **No fabricated urgency** was introduced — no countdowns, slot counters or
  live-booking notifications.

## Regression cover

`src/pages/HomePage.sectionOrder.test.tsx` (14 specs) pins the order, the
selector/calculator adjacency, the preserved quote journey, and the fact that
the detailed exclusions are no longer on the homepage but the link to them is.
