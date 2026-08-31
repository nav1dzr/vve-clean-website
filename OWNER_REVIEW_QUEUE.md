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

### 5. Future payment workflow

The current customer journey is now:

1. customer requests a preferred time with no payment;
2. the request appears in the manager queue as **Check availability**;
3. the manager checks scope/date and contacts the customer;
4. the appointment is confirmed after the customer agrees the time, scope and
   final price. No online deposit is required.

The old Stripe booking endpoint is retained but disabled by default, so the
reviewed implementation can be restored later without being available to
customers now. A future VVE OS task can define how confirmed appointments are
invoiced or paid; that is not required for this website release.

### 6. Policy confirmations

- Confirm Sunday customer-contact hours are **10:00–15:00**.
- Decide whether confirmed appointments should ever carry a specific late-
  cancellation or call-out fee. Until then, the Terms say a charge applies only
  when it was stated and agreed in writing at confirmation.
- Confirm `BUSINESS_EMAIL` points to a mailbox someone monitors.

## Safe defaults currently published

- No payment is taken before availability is checked.
- If an offered time is declined, nothing was charged and no refund is needed.
- The public booking journey contains no online deposit or refund promise.
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
