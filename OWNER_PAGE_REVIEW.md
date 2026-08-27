# Page-by-page owner review checklist

**Preview:** https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app
**Branch:** `feature/website-final-owner-review` · **Base:** `a5b90b8` (production `main`)

> Vercel gives each commit its own URL. If a page looks stale, check the
> latest deployment for this branch on the Vercel dashboard rather than
> assuming the change did not ship.

Every route below was inspected mechanically (`node scripts/audit-pages.mjs`)
for title, description, single H1, heading order, canonical, robots state,
image alt text, JSON-LD validity and internal links. **Zero broken internal
links across the whole site.** What is left for you is judgement: is the copy
true, and does it read the way you want?

Status key — **Ready**: nothing needed from you. **Needs owner information**:
correct as published, but incomplete until you supply a fact or asset.
**Needs revision**: I think something should change.

---

## Changed in this pass — please look at these first

| Page | Status | What to check |
|---|---|---|
| [`/`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/) | **Ready** | **Section order changed.** Now promise → services → trust → reviews/results → quote → coverage → FAQ. The guarantee moved to just after the price, and its detailed exclusions moved to the EOT page. Does the page read better top to bottom? Comparison in `docs/HOMEPAGE_SECTION_ORDER.md`. |
| [`/about`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/about) | **Needs owner information** | "Owner-led service" is gone; heading is now "A local team you can contact directly". New Checkatrade link. **No team section appears yet** — that is deliberate, it renders nothing until you add real people to `src/data/team.ts`. See queue item 2. |
| [`/contact`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/contact) | **Needs owner information** | **Sunday now reads "by request"**, not "Closed". New Service dropdown on the form. Address block now says plainly: registered office only, no walk-ins, mobile teams. Confirm Mon–Fri and Sat hours are still right (queue item 4). |
| [`/booking`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/booking) | **Ready** | New error summary. To see it: press "Pay £30 deposit" with the form empty. It should list 10 problems, take focus, and each entry should jump to its field. Also a new one-line refund note by the date picker. |
| [`/terms-of-service`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/terms-of-service#bookings) | **Ready** | **New paragraphs in §4** on unavailable slots and the refund. Wording revised after review: it no longer guarantees the money "will reach your card" by a date (the card issuer controls that) and no longer publishes an unconfirmed one-business-day turnaround. Now says card refunds typically appear in about 5–10 business days, names who controls the timing, and tells the customer what to do if it stalls. Nothing outstanding. |
| [`/faq`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/faq) | **Ready** | Four new questions: unavailable dates, adding carpet to an EOT booking, how the "up to 50%" discount really works, and what happens when an agent flags an issue. **Please check the discount answer against what you actually charge.** |
| [`/end-of-tenancy-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/end-of-tenancy-cleaning-london#guarantee) | **Ready** | New "full terms" section carrying the covered / not-covered lists that used to sit on the homepage. Nothing was reworded — same 11 lines, better placed. |
| [`/gallery`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/gallery) | **Ready** | Had no booking CTA and no mobile bar. Both added. Check on a phone that nothing hides behind the bar. |
| [`/blog`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/blog) | **Ready** | Same fix as the gallery. |

### Corrected after independent review

| Page | Status | What changed |
|---|---|---|
| [`/booking`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/booking) | **Ready** | **Price fix.** The secondary-services note said "Window cleaning from £45" and "Garden services from £45"; both are **£75** in your catalogue and on the homepage. Now read from the catalogue so they cannot go stale again. Scroll to the bottom of the page to see them. |
| [`/sofa-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/sofa-cleaning-london) | **Ready** | **Search snippet fix.** Its Google description said "from £75", which matched no price you charge — the cheapest sofa is £70 and the £85 minimum means nobody pays £75. Now "from £70 for a 2-seater, £85 minimum booking". The page itself was already correct. |
| [`/`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/) | **Ready** | Three claims removed for lack of evidence: pressure washing "back to their original colour", garden "green-waste removal", and the commercial card's "Contract cleaning, out-of-hours visits, monthly invoicing". Each now describes the method or invites an enquiry. **No service was removed.** |
| [`/booking`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/booking) (quote panel) | **Ready** | The "**10% to 30% off** regular cleaning" claim is gone — no such discount exists in your pricing catalogue, and it sat inside the quote flow where a customer could rely on it. Replaced with an invitation to ask for a schedule quote. **If you do offer a regular discount, tell me the real figure and it goes back.** |
| [`/commercial`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/commercial) | **Needs owner information** | "Out-of-hours available" → "Access hours agreed per site"; "Monthly invoicing" → "Invoicing agreed per contract". Both previously contradicted this page's own FAQ. |

## Service pages

| Page | Status | Note |
|---|---|---|
| [`/pricing`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/pricing) | **Ready** | Unchanged. Own Call/WhatsApp bar, verified correct. |
| [`/carpet-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/carpet-cleaning-london) | **Ready** | Unchanged. |
| [`/sofa-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/sofa-cleaning-london) | **Needs owner information** | Unchanged, but your unplaced sofa media (~108MB) is not on it. Queue item 8. |
| [`/after-builders-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/after-builders-cleaning-london) | **Ready** | Unchanged. |
| [`/commercial`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/commercial) | **Needs owner information** | Promises only what is agreed in writing. If you *do* offer out-of-hours, RAMS turnaround, drying times, priority scheduling or consolidated invoicing, say so and they go back as facts. Queue item 10. |
| [`/commercial-carpet-cleaning-london`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/commercial-carpet-cleaning-london) | **Needs owner information** | Same as above. |
| [`/how-we-clean-carpets`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/how-we-clean-carpets) | **Ready** | Unchanged. |
| [`/how-we-clean-sofas-upholstery`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/how-we-clean-sofas-upholstery) | **Ready** | Unchanged. |
| [`/how-we-clean-end-of-tenancy`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/how-we-clean-end-of-tenancy) | **Ready** | Unchanged. |

## Area pages — all 15 now carry six FAQs

Only **Islington** and **Stratford** are indexable; they are the only two with
a real area-tagged review. The other 13 are `noindex, follow` on purpose and
flip automatically the moment real proof exists. See queue item 7.

| Page | Indexed | Status |
|---|---|---|
| [`/cleaning-islington`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-islington) | **Yes** | **Ready** — real N1 review |
| [`/cleaning-stratford`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-stratford) | **Yes** | **Ready** — real E15 review |
| [`/cleaning-hackney`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-hackney) | No | **Needs owner information** — priority area, no proof yet |
| [`/cleaning-camden`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-camden) | No | **Needs owner information** — priority area, no proof yet |
| [`/cleaning-walthamstow`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-walthamstow) | No | **Needs owner information** — priority area, no proof yet |
| [`/cleaning-angel`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-angel) | No | **Ready** — correctly does *not* inherit Islington's review despite sharing N1 |
| [`/cleaning-shoreditch`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-shoreditch) | No | **Ready** |
| [`/cleaning-bethnal-green`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-bethnal-green) | No | **Ready** |
| [`/cleaning-dalston`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-dalston) | No | **Ready** |
| [`/cleaning-stoke-newington`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-stoke-newington) | No | **Ready** |
| [`/cleaning-bow`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-bow) | No | **Ready** |
| [`/cleaning-finsbury-park`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-finsbury-park) | No | **Ready** |
| [`/cleaning-tottenham`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-tottenham) | No | **Ready** |
| [`/cleaning-canary-wharf`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-canary-wharf) | No | **Ready** |
| [`/cleaning-highgate`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/cleaning-highgate) | No | **Needs owner information** — asks for a postcode instead of claiming coverage. Do you serve N6? Queue item 7. |

## Legal, utility and other routes

| Page | Status | Note |
|---|---|---|
| [`/privacy-policy`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/privacy-policy) | **Ready** | Unchanged. |
| [`/leaflet`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/leaflet) | **Ready** | `noindex` on purpose — a permanent 20% offer must not compete with full-price pages. |
| [`/blog/london-deposit-deduction-guide`](https://vve-clean-website-2t0jcpk39-nav1dzrs-projects.vercel.app/blog/london-deposit-deduction-guide) | **Needs owner information** | `noindex` pending your editorial sign-off. Title shortened for search; the H1 is unchanged. Queue item 9. |
| `/confirmation.html` | **Ready** | Only reachable after a real payment. Three H1s are three mutually exclusive states; only one ever shows. |
| 404 (try any bad URL) | **Ready** | Real 404 status, with a route home and a quote link. |

---

## What to check on every page you open

1. **On a phone.** Does anything hide behind the bottom bar? Does the page
   scroll sideways at all? (It should not — guarded by tests, but eyes are
   better.)
2. **Is every claim true?** Prices, guarantees, coverage, hours. If a sentence
   makes a promise you cannot keep every time, tell me and it comes out.
3. **One obvious next action per screen.** If you cannot tell what to tap,
   that is a finding.
4. **Keyboard.** Tab from the top: focus should be visible throughout, and the
   first Tab should reveal "Skip to main content".

## What I could not check for you

- **Real device rendering.** Everything here is verified in the built HTML and
  by automated checks. I have not seen these pages on an actual iPhone.
- **Whether the copy sounds like you.** Tone is yours to judge.
- **Live email delivery.** The plain-text fix is verified in code and by test,
  but proving it clears the junk folder needs real sends over a couple of
  weeks.
