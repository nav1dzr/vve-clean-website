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

Everything else is optional or already safe. Two items that used to sit here
are now closed: the refund wording (item 5) lost its unconfirmed
one-business-day commitment, and the homepage FAQ (item 12) has been shortened
to six questions on your instruction.

**One thing to be aware of rather than act on.** The cancellation FAQ now
matches your Terms exactly: rescheduling is free before noon the day before,
but a cancellation inside 24 hours may mean the deposit is retained. The old
answer implied both were free, which was more generous than your Terms
actually are. **I have not changed the underlying policy** — only the wording
that describes it. If you would rather the policy itself were more generous,
that is a separate decision and it needs your approval (item 13).

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

## 12. Homepage FAQ — done, please look at it

**Implemented on your instruction.** Nothing outstanding here; this entry is
kept so you can see what changed and check it on the preview.

The homepage FAQ used to render all 15 questions, byte-identical to `/faq`.
It now shows the **six that block a booking**, in this order:

1. How does the end of tenancy re-clean guarantee work?
2. When do I pay?
3. Can the price change?
4. Can I reschedule or cancel?
5. What if the date I request is not available?
6. Which areas do you cover?

followed by a **"View all 15 FAQs"** button linking to `/faq`, which still
carries the full set. Both pages keep the accordion behaviour you already had:
question visible, answer expands on click.

Measured on the built pages, not estimated:

| | Before | After |
|---|---:|---:|
| Homepage FAQ section | 873 words | **366 words** |
| Whole homepage | 2,250 words | **1,727 words** (23% shorter) |
| `/faq` | 15 questions | **15 questions** (unchanged) |

**On search:** each page's `FAQPage` structured data is now generated from
exactly the questions that page renders — six on the homepage, fifteen on
`/faq`. That is what Google's FAQ guidance requires, and advertising answers a
visitor could not see would have risked the rich result. Nothing is lost from
search: `/faq` still carries all fifteen, and it is the page that ranks for
them.

The six answers are read from the same array as `/faq`, so the two pages can
never give different answers to the same question. Two new test files (28
specs) pin the selection, the order, the link, the schema/visible parity and
the fact that the homepage does not advertise the nine questions it no longer
shows.

Original measurements and the reasoning for keeping every other homepage
section: `docs/HOMEPAGE_SIMPLIFICATION_REVIEW.md`.

---

## 13. Cancellation policy — a question the FAQ correction raised

**Nothing is broken and nothing is blocked.** The site is now accurate. This
is a business question that only became visible once the wording was fixed.

The FAQ used to say customers could **cancel or reschedule** without charge
until noon the day before. Your Terms §5 do not say that. They say:

- free **reschedule** before 12:00 noon the day before, and
- cancellations with **less than 24 hours' notice**, or on the day, **may
  result in the deposit being forfeited**.

So the FAQ was offering a refund right the Terms do not give. It now states
the two separately, in your Terms' own terms. **The policy itself is
unchanged** — I only corrected the description, because changing what you
charge customers is your decision, not mine.

What is worth your attention:

- [ ] **Is the Terms wording the policy you actually operate?** "May result in
      the deposit being forfeited" is discretionary. If in practice you always
      refund a same-day cancellation, or never do, the Terms should say so —
      customers read "may" as "might not", and it is the kind of ambiguity
      that causes a dispute.
- [ ] **Do you want a free-cancellation window at all?** Many cleaning firms
      offer one at 48 hours. Adding one would be more generous than your
      current Terms and might reduce booking hesitancy. **This would change a
      customer-facing payment policy, so I will not touch it without you
      saying so explicitly.**

If you change nothing, the site stays correct as it is.
