# Owner review queue

Only facts, assets and account decisions that VVE Clean must supply are listed
here. None of these makes the current branch unsafe to review.

**Branch:** `codex/website-conversion-final`

**Base:** `f7f9bad` (`origin/feature/website-final-owner-review`)

**Release state:** local review branch only — not pushed, merged or deployed

## Decisions needed before a final release

### 1. Team details and operational trust facts

The About page now tells the confirmed three-friends story, but the six-person
team section stays hidden until real details are supplied. For each person,
provide the customer-facing name, role and photo. Add experience, training or
DBS status only where it is true and can be evidenced.

Also confirm:

- whether subcontractors are used;
- who normally attends a job;
- what uniform or identification customers should expect;
- whether the £5m public-liability cover is current and the certificate can be
  provided on request.

### 2. Measurement and search accounts

The site records useful conversion events, but measurement cannot be judged
properly until the accounts are connected.

- GA4 measurement ID (`G-XXXXXXXXXX`)
- Google Search Console ownership and sitemap submission
- Google Business Profile name, phone, service area and Sunday hours
- Bing Webmaster Tools (optional; it can import Search Console)

Do not publish a two-hour reply promise until VVE OS data proves the team can
meet it consistently.

### 3. Real local proof

Islington and Stratford are indexable because each has genuine area-tagged
proof. **13 of the 15** area pages remain `noindex, follow` rather than
pretending that general London work happened in a specific borough.

Priority proof still needed for **Hackney, Camden and Walthamstow**. For each
area, supply one genuine local review, two tagged job photographs, or several
short factual job notes. Also confirm whether VVE Clean serves **N6/Highgate**.

The new service cards and videos on area pages are clearly labelled as examples
from VVE Clean work across London; they do not count as local proof.

### 4. Gallery storage and official channels

The gallery now organises the approved local media and includes real video.
Large future uploads should not be added to Git uncompressed.

Choose or supply:

- the Supabase Storage bucket/project to hold originals and web derivatives;
- permission to optimise and upload the remaining media;
- the official VVE Clean YouTube URL, if one exists.

Instagram, Facebook and Google links are shown. YouTube stays hidden until its
official URL is confirmed. A separate image CDN is not required yet; add one
only if measured delivery performance justifies the extra service.

### 5. Manager deposit workflow

The approved customer journey is now:

1. customer requests a preferred time with no payment;
2. the request appears in the manager queue as **Check availability**;
3. the manager checks scope/date and contacts the customer;
4. only after the customer accepts, the manager sends a secure £30 deposit
   invoice or payment link.

The website and VVE manager screens support this workflow, but sending the
later deposit is still an operational manager step. Decide whether the first
release should use the existing invoice/payment-link process, or whether a
future VVE OS task should add a one-click **Confirm time and send deposit
link** action. The latter requires a separately reviewed Stripe/email workflow.

### 6. Policy confirmations

- Confirm Sunday customer-contact hours are **10:00–15:00**.
- Confirm the current late-cancellation policy: the Terms say a cancellation
  inside 24 hours *may* result in the deposit being retained.
- Confirm `BUSINESS_EMAIL` points to a mailbox someone monitors.

## Safe defaults currently published

- No payment is taken before availability is checked.
- If an offered time is declined, nothing was charged and no refund is needed.
- Refund timing for a later paid deposit is described as issuer-controlled,
  typically 5–10 business days after issue.
- Queensway is labelled as a registered office only, with no walk-ins.
- No universal DBS, founder-attends-every-job or no-subcontractor claim is
  published.
- No unsupported star rating, “Most booked” label or response-time promise is
  published.

## External follow-up, not a code blocker

SPF, DKIM and Google Workspace MX were previously verified. Transactional
emails now include a plain-text part. Monitor real delivery after release. A
DMARC reporting address remains a sensible owner-managed DNS improvement, but
no DNS change belongs in this website release.
