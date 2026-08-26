# Search and AI visibility — audit and measurement plan

Completion brief §12. Every recommendation here is checked against primary
sources (Google Search Central, Schema.org, Companies House), not SEO
marketing claims. Nothing in this document promises that any AI system will
recommend VVE Clean — no provider offers a mechanism for that, and anyone
selling one is selling a guess.

Audited 27 August 2026 against `feature/website-final-owner-review`.

---

## 1. What was already correct

These were verified, not assumed, and needed no change:

| Item | State |
|---|---|
| Crawlability | `robots.txt` allows all, names the sitemap |
| Sitemap | Generated at build; 21 indexable URLs; no stale `<lastmod>` |
| Canonicals | Absolute, `www` host, homepage canonical matches its sitemap entry including trailing slash |
| Server-rendered content | 39 routes prerendered — content is in the HTML, not assembled by JavaScript |
| FAQ schema parity | Visible copy and `FAQPage` generated from one array; 29 specs enforce it across 12 pages plus all 15 area pages |
| Offer catalogue | Lists the six services actually sold, each linked to its page |
| `lang` | `en-GB`, matching the copy |
| Asset caching | `/assets/*` immutable for a year; HTML still revalidates so deploys reach cached visitors |
| Titles / H1s / descriptions | Unique per route, set in `prerender.mjs` |
| Thin-page risk | 12 of 15 area pages are `noindex, follow` until they have real local proof |

## 2. What changed in this pass

**Business entity identity.** The `HouseCleaningService` schema had no
`sameAs`, so nothing tied this website to the same business elsewhere. Added
three links, each verified live before publishing:

- `https://www.checkatrade.com/trades/vvelimited` — active profile for VVE
  Limited, passed Checkatrade's vetting checks.
- `https://www.instagram.com/vve__clean` — already linked from the site.
- Companies House entry for **17234391** — confirmed "VVE LIMITED", status
  Active.

Also added `legalName` and a Companies House `identifier`. `vatID` is
deliberately absent: the business is not VAT registered, and an empty or null
property is worse than no property.

**No street address in schema, deliberately.** VVE Clean works at the
customer's property. Queensway is a registered office, not somewhere anyone
can visit. Publishing it as `streetAddress` would misrepresent the business
and contradict `/contact`, which now says plainly that there are no walk-ins.
A test asserts it stays out.

**Area page FAQs** went from two to six per page, all drawn from real data.

**Legacy URL shape** `/end-of-tenancy-cleaning-[area]` now 308s to the
canonical `/cleaning-[area]`, capturing any link using the requested shape
without splitting signals across two URLs.

## 3. llms.txt — not added, and why

Google's **June 2026** Search Central documentation update ("Clarifying
guidance on llms.txt files") states that llms.txt files neither help nor hurt
rankings and are not used for AI features in Search. Gary Illyes said Google
does not support it and has no plans to; John Mueller compared it to the
keywords meta tag — a self-declared signal that was abandoned precisely
because it was trivially gamed.

As of Q1 2026 no major AI provider — OpenAI, Google, Anthropic, Meta,
Mistral — has publicly committed to reading llms.txt in production.

**Recommendation: do not add one.** A test asserts it stays absent, so a
future agent does not add it on the strength of a blog post. If a major
provider publishes a commitment to honouring it, revisit — that is a
documentation change, not a rankings change.

The thing that actually helps AI systems describe the business correctly is
the same thing that helps search: server-rendered content, accurate
structured data, consistent name/phone/service-area, and real proof. All of
that is in place.

## 4. Known risks, honestly stated

| Risk | Severity | Note |
|---|---|---|
| **No analytics at all** | High | No GA4 ID configured, so none of the metrics below can be measured yet. Owner queue item 6. |
| **Not verified in Search Console** | High | Nobody is seeing crawl errors, schema errors or impressions. Owner queue item 6. |
| Area pages read as templated | Medium | Managed, not eliminated: the 12 without real proof are `noindex`, so Google is not asked to index near-duplicates. Adding real proof is content work, not code. |
| Single JS bundle (~179 kB gzip) | Low–Medium | Route splitting needs an SSR/client routing refactor. Content is prerendered, so first paint does not wait on it. Recorded as an optional follow-up. |
| Blog is one post, `noindex` | Low | Pending editorial sign-off. Owner queue item 9. |
| DMARC `p=none`, no `rua=` | Medium | Email, not search, but same "nobody is watching" pattern. Owner queue item 1. |

## 5. Measurement plan

Nothing here can start until GA4 and Search Console exist (owner queue item
6). Once they do, this is the minimum worth watching. Review monthly; expect
no meaningful signal for the first 6–8 weeks.

### Indexing and crawl health — Search Console

| Metric | Where | Healthy | Act when |
|---|---|---|---|
| Indexed pages | Pages report | ~21, matching the sitemap | A page you expect is "Crawled – currently not indexed" |
| Crawl errors | Pages report | 0 server errors | Any 5xx, or a soft 404 |
| Schema errors | Enhancements | 0 | Any error; warnings are usually ignorable |
| Sitemap status | Sitemaps | Success, 21 discovered | Discovered count drifts from 21 |

### Demand and clicks — Search Console

| Metric | Why it matters |
|---|---|
| Impressions and clicks, total | The baseline. Expect near-zero at first. |
| **Non-branded service queries** | The real test. "end of tenancy cleaning hackney" earns new customers; "vve clean" is people who already know you. Filter out queries containing "vve". |
| Average position for the six service pages | Movement here precedes traffic. |
| Area page impressions | Only Islington and Stratford are indexable, so only they can appear. |

### Behaviour and conversion — GA4

| Metric | Definition |
|---|---|
| Quote calculator starts | First interaction with the calculator |
| Booking requests submitted | Reaching the Stripe checkout |
| Calls and WhatsApp taps | Already instrumented (`trackPhoneClick`, `trackWhatsAppClick`) |
| Contact form submissions | Already instrumented (`trackContactFormSubmitted`) |
| Quote-start → booking-request rate | The single most useful number on this list |

### Local and referral

| Metric | Where |
|---|---|
| Google Business Profile views, calls, direction requests | GBP dashboard |
| Checkatrade profile views and enquiries | Checkatrade dashboard |
| Referral traffic from checkatrade.com | GA4 referrals |
| Referral traffic from AI platforms | GA4 referrals: chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com |

**On that last row, be realistic.** AI referral traffic is measurable when a
platform sends a clickable citation, and it is usually a very small number.
Much AI usage produces an answer with no click at all, which is not
measurable by anyone. Treat it as a bonus signal, never as a target, and
distrust any tool claiming to measure "AI visibility" precisely.

## 6. Accounts needed before any of this works

See `OWNER_REVIEW_QUEUE.md` item 6: GA4 measurement ID, Search Console
verification, Bing Webmaster Tools (imports from Search Console), and Google
Business Profile consistency with the site's name, phone and service area.

---

## Sources

- [Spam policies for Google web search — doorway pages](https://developers.google.com/search/docs/advanced/guidelines/doorway-pages)
- [An update on doorway pages — Google Search Central Blog](https://developers.google.com/search/blog/2015/03/an-update-on-doorway-pages)
- [Companies House — VVE LIMITED (17234391)](https://find-and-update.company-information.service.gov.uk/company/17234391)
- Google Search Central documentation update, June 2026: "Clarifying guidance on llms.txt files"
