# Owner review queue

Decisions and real business information only you can supply. Everything here
is blocked on a fact, an asset or an account — not on engineering work.

Nothing in this list is holding up the preview. Each item names what is
published in the meantime, so the site is correct and safe as it stands.

**Branch:** `feature/website-final-owner-review` · **Base:** `a5b90b8` (production `main`)

Page-by-page review links are in `OWNER_PAGE_REVIEW.md`.

### The short version — what actually needs you

1. **Team details** for `/about` (item 2), or the section stays hidden.
2. **GA4 ID and Search Console** (item 6), or nothing can be measured.
3. **One review, two photos or a few job notes** per area (item 7) to make the
   remaining 13 area pages indexable.
4. **A decision on the homepage FAQ** (item 12) — the one change I recommend
   but have not made.

Everything else is optional or already safe. The refund wording (item 5) no
longer needs anything from you: the unconfirmed one-business-day commitment
was removed after independent review.

---

## 1. Email deliverability — DNS decision

**Status of the domain today** (read-only checks against `vveclean.co.uk` via
8.8.8.8, 26 August 2026):

| Record | Value | Verdict |
|---|---|---|
| SPF | `v=spf1 include:_spf.google.com ~all` | Correct |
| DKIM | `google._domainkey` published, RSA key present | Correct |
| MX | Google Workspace | Correct |
| DMARC | `v=DMARC1; p=none;` | **Weak — no `rua=`** |

**This is good news.** SPF, DKIM and domain alignment are all in place, so the
usual causes of junk-foldering are already ruled out. The most likely in-code
cause — every transactional email being HTML-only with no plain-text part —
**is fixed on this branch** and needs nothing from you.

### What needs your decision

**1a. Add a DMARC reporting address.** Your DMARC record is `p=none` with no
`rua=`, so nobody is being told when mail fails authentication. You are flying
blind. The safest change, which does **not** affect delivery at all:

```
Host:  _dmarc.vveclean.co.uk
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@vveclean.co.uk; fo=1
```

`p=none` means "monitor only" — no message is ever rejected because of it.
After a few weeks of reports you can decide whether to move to `p=quarantine`.
**Do not skip to `p=quarantine` or `p=reject` now** — without report data
first, that risks silently dropping real mail.

**Recommendation:** make this change. It is monitoring only, reversible, and
zero-risk to delivery.

**1b. Confirm `BUSINESS_EMAIL` is a monitored mailbox.** Customer replies to
booking confirmations and contact acknowledgements now go to `BUSINESS_EMAIL`
via a new `Reply-To` header. Previously replies went to the raw sending
account. Confirm the address that variable points to is one someone reads.

**1c. Should we move to a transactional provider?** Not required. Only worth
doing if junk-foldering continues after the plain-text fix has been live for
a couple of weeks *and* DMARC reports show a real problem. If you do move,
**Postmark** is the recommendation for this use case — best deliverability
reputation for pure transactional mail, and delivery webhooks would let the
CRM show a true delivered/bounced status rather than only "we attempted to
send". Resend is a reasonable cheaper alternative; SES is the cheapest but
needs the most setup and has no useful UI. This is a staged change touching
production email configuration, so it needs its own branch and your approval.

---

## 2. Team section on /about

The team section is built and ships **empty**, so nothing team-related appears
on the page until you supply real people. No placeholder faces, no empty photo
boxes. Add entries to `src/data/team.ts`.

Per person (up to six), only what is confirmed:

- [ ] Name as a customer would hear it
- [ ] Role, e.g. "Cleaning technician"
- [ ] Photograph (optional — initials show instead; landscape or square, ideally 800px+)
- [ ] Experience, e.g. "Eight years in end of tenancy cleaning" — only if true
- [ ] Training or certification, e.g. IICRC — only if held
- [ ] **DBS: who exactly is checked, and to what level** (basic / standard /
      enhanced). This is per-person, never a blanket site-wide claim. The
      repository already blocks a universal DBS claim, and the About page
      currently makes none.

Also needed:

- [ ] **Do you use subcontractors?** If yes, the site must say so plainly.
- [ ] **Who normally attends a job?** e.g. "two technicians".
- [ ] **Identification/uniform** — what should a customer expect at the door?
- [ ] **Insurance:** the site states £5m public liability, certificate on
      request. Confirm this is current and that you can produce the
      certificate.

### The founding story

You mentioned VVE Clean was started by three friends who previously worked at
different cleaning companies. **This is not published**, because the exact
wording needs to be yours. Send me the sentence or two you are happy with and
it goes on the page. Avoid naming former employers unless you are certain
that is wise.

---

## 3. Checkatrade

**Done, no action needed** — `/about` now links to
`https://www.checkatrade.com/trades/vvelimited`. The profile was verified live
before linking.

**Deliberate decision:** the rating (9.67/10) and review count (6) are **not**
printed on the site. A hard-coded score becomes a false claim the moment it
changes, and a test enforces that none is published. The link always shows the
current figure.

- [ ] Optional: your Checkatrade "Who we are" text says "founder-led" and
      claims a "vetted, DBS-checked team" and a "67-point checklist". The
      website deliberately makes none of those claims because they are not
      confirmed here. Either confirm them so the site can match, or consider
      softening the Checkatrade copy so the two do not contradict each other.

---

## 4. Opening hours

**Changed on this branch:** Sunday now reads **"by request"** instead of
**"Closed"**, per your instruction. Mon–Fri 9:00–18:00 and Sat 10:00–15:00 are
unchanged.

- [ ] Confirm Mon–Fri and Saturday hours are still accurate.
- [ ] Mirror this in Google Business Profile. Google has no "by appointment"
      state for a single day, so the closest options are to leave Sunday as
      Closed (matching what you have now) or to set Sunday hours to the window
      you would realistically accept a request in. Your call — the website is
      now the more accurate of the two either way.

---

## 5. Deposit refund wording — REVISED, and now needs nothing from you

You confirmed 14 business days, and I published it. **Independent review then
found two problems with that wording, and I agree with both.** It has been
rewritten.

**What was wrong.** The published sentence said the refund "will reach your
card within 14 business days" and that we would "start that refund within one
business day".

1. **Card settlement is not ours to promise.** Once a refund is issued, when
   it lands is decided by the customer's card issuer. "It will reach your card
   within 14 business days" is a guarantee the business cannot enforce — if a
   bank takes longer, VVE Clean has broken a published term through no fault
   of its own.
2. **The one-business-day SLA was never confirmed by you.** I had it in this
   queue as an open question while it was already live on the page. That was
   my error: an unconfirmed operational commitment should not have been
   published in the first place.

**Current published wording** (`/terms-of-service` §4 and `/faq`):

> If your requested date and arrival window are unavailable, we will contact
> you with the closest alternatives we can offer. If none of them works for
> you, we will refund your £30 deposit in full.
>
> Once we issue the refund, the money is returned to the card you paid with.
> Card refunds typically appear about 5 to 10 business days after they are
> issued, but the exact timing is controlled by your card issuer rather than
> by us. If it has not appeared after 10 business days, contact us with your
> booking reference and we will send you the refund confirmation from our
> payment provider so you can take it up with your bank.

This commits VVE Clean to the refund, describes the typical timing honestly,
names who actually controls it, and gives the customer a route if it stalls.
`/booking` keeps a one-clause version that makes no timing claim and links
here.

**Nothing is outstanding on this item.** No unconfirmed SLA is published.

- [ ] *Optional:* if you **do** want to commit to a turnaround — "we issue the
      refund within one business day", say — tell me and I will add it. It
      would be a genuine differentiator, but only if you can meet it every
      time.

**Optional follow-up (unchanged):** handling `charge.refunded` in the webhook
would make the CRM correct after a refund, instead of still showing the
booking as paid. That is a Stripe + Supabase change needing its own branch and
your approval — not done here.

---

## 6. Analytics and search accounts

Needed before any measurement plan can produce numbers:

- [ ] **GA4 measurement ID** (`G-XXXXXXXXXX`). The invalid placeholder was
      removed previously; there is currently no analytics on the site.
- [ ] **Google Search Console** — verify the property, submit
      `https://www.vveclean.co.uk/sitemap.xml`.
- [ ] **Bing Webmaster Tools** — can import from Search Console in one step.
- [ ] **Google Business Profile** — confirm name, address, phone and service
      area match the site exactly.

---

## 7. Local area pages — real proof

**13 of the 15** `/cleaning-*` pages are `noindex, follow` because they have no
genuine local proof. This is deliberate and correct: publishing near-identical
pages differing only by a postcode list is a doorway-page pattern that risks
the whole domain.

**Indexable today: Islington and Stratford. Those two only.** They are the only
areas with a genuine area-tagged review (Hannah M., N1 and Ahmad B., E15).

Verified against three sources, which agree: `src/lib/areaProof.ts`
(`areaHasRealProof`), the two `index, follow` pages in `dist/`, and the two
`/cleaning-*` entries in `dist/sitemap.xml`.

> **Correction.** An earlier version of this file, and
> `docs/LOCATION_PAGES_ASSESSMENT.md`, said Angel was also indexable because it
> shares Islington's N1 postcode district. That is wrong. `matchesNamedArea`
> requires an **exact named-area match**, precisely so an area cannot inherit a
> neighbour's review — a deliberate fix recorded in
> `docs/FINAL_COMPLETION_LOG.md`. Angel is `noindex` and correctly so. The code
> was right; the documentation was wrong.

Any **one** of these per area flips it to indexable automatically, with no code
change:

- [ ] One genuine area-tagged review, **or**
- [ ] Two area-tagged job photographs, **or**
- [ ] Three or four short, true job notes ("three-bed terrace, E17, end of
      tenancy, carpets and oven")

Priority areas from your brief still lacking proof: **Hackney**, **Camden**,
**Walthamstow**.

- [ ] **Is N6/Highgate actually served?** That page currently asks for a
      postcode first and is excluded from the sitemap.

---

## 8. Sofa and carpet media

You have ~108MB of unplaced media in the main checkout
(`public/sofa_upholstery/before_after/`, `random/`, `video/`).

- [ ] Confirm you want these on the site, and which are genuinely VVE Clean's
      own work (they must not imply a job or location that did not happen).
- [ ] Videos are HDR and need tone-mapping before publishing, or they will
      look washed out on most screens.

**Note:** 108MB is too large to commit to git as-is. These need compressing to
web derivatives (AVIF/WebP for stills, H.264/AV1 for video) first — the
existing `docs/MEDIA_UPLOAD_GUIDE.md` covers the targets. Say the word and I
can do that conversion as a separate piece of work.

---

## 9. Blog

- [ ] The England tenancy-deposit article is `noindex` pending your editorial
      sign-off. Read it and confirm before it is indexed.

---

## 10. Commercial page claims

Current copy promises only what is agreed in writing. If VVE Clean **does**
offer any of the following as standing commitments, say so and they can be
restored as stated facts on `/commercial-carpet-cleaning-london`:

- [ ] Out-of-hours availability
- [ ] RAMS turnaround time
- [ ] Typical drying time
- [ ] Priority scheduling
- [ ] Consolidated monthly invoicing

---

## 11. AGENTS.md — no action needed, but resolve your local edit

You asked for agents to be able to push and merge **after your approval**,
rather than being blocked outright.

**That is already the committed rule on `main`.** `AGENTS.md` line 5 reads:

> Never push, merge to `main`, or deploy without Navid's explicit written
> approval for that specific release.

So no change was needed on this branch, and none was made.

- [ ] Your main checkout (`d:\VVE_CLEAN_WEBSITE`) has an **uncommitted** edit
      to `AGENTS.md` that deletes two older lines (`Never deploy.` /
      `Never merge to main.`). That edit was made against an earlier version
      of the file and is now redundant — the current committed text already
      says what you want, and better. Discard it with
      `git checkout -- AGENTS.md` in the main checkout, or keep it; either
      way it will need resolving before you next pull. **I have not touched
      your working copy.**

---

## 12. Homepage FAQ — one change I recommend but have not made

The FAQ section on the homepage is **873 words, 39% of the whole page** — and
it renders all 15 questions, byte-identical to the standalone `/faq` page.
Nothing is filtered; the only difference is `h1` versus `h2`.

That is nearly three times the next-largest section, and it sits after the
quote calculator where an undecided visitor is scrolling.

**Recommendation:** show five or six booking-blocking questions on the
homepage — when do I pay, can the price change, cancellation, coverage, do I
need to be home, the re-clean guarantee — with a "See all questions" link to
`/faq`.

- Homepage FAQ: ~873 → ~350 words
- Whole homepage: 2,250 → ~1,730 words (**23% shorter**)
- Nothing lost: every question stays one click away, and `/faq` already ranks

**Conversion risk: low.** The questions that block a booking stay visible; the
long-tail ones move. The `FAQPage` schema would be trimmed to match the
visible list, which the existing parity specs enforce.

- [ ] **Shall I make this change?** It alters what a visitor sees on your most
      important page, so it is your call. About twenty minutes' work plus
      tests.

Full measurements and the reasoning for keeping every other section:
`docs/HOMEPAGE_SIMPLIFICATION_REVIEW.md`.
