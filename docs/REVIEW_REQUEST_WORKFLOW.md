# Review-request workflow — design, and how to enable it

**Status: built, tested, and DISABLED.** Nothing can send an email today. No
migration has been applied. No production data has been touched.

## Why

Google review velocity is the strongest acquisition lever a local cleaning
business has, and nothing in the system currently asks for one — it depends
entirely on customers volunteering. It is also the bottleneck for the location
pages (see `LOCATION_PAGES_ASSESSMENT.md`): two of the four areas cannot be
published because no area-tagged review exists yet.

## What was built

| File | Purpose |
|---|---|
| `admin/migrations/20260803120000_add_review_request_tracking.sql` | Two nullable columns + partial index. **Not applied.** |
| `admin/api/_lib/reviewRequest.js` | Feature flag, eligibility rules, branded email template |
| `admin/tests/reviewRequest.test.js` | 27 tests, all passing |

## Two independent locks

Neither an accidental deploy nor an accidental migration can start emailing
customers. **Both** of these are required:

1. Apply the migration manually (see `admin/PHASE4_MIGRATIONS.md`), **and**
2. Set `REVIEW_REQUESTS_ENABLED=true` on the admin Vercel project.

With either missing, the feature reports unavailable and sends nothing.
`isReviewRequestEnabled()` is additionally hard-off whenever `NODE_ENV=test` or
`VITEST` is set, so no test run can email a real customer even with the variable
set — asserted by a test that reads the real `process.env`.

## Eligibility

A booking may be asked for a review only when **all** hold:

- `status === 'completed'` — never before the work is done
- `payment_status === 'paid'`
- a usable email address is stored
- `review_request_sent_at IS NULL` — the duplicate lock

Each failure returns a machine-readable reason (`not_completed`, `not_paid`,
`no_email`, `already_sent`, `feature_disabled`, `columns_missing`) with
human-readable text in `BLOCKED_REASON_TEXT`, so the CRM can disable the button
*and say why* rather than failing silently.

## Duplicate protection

Persisted in `bookings.review_request_sent_at`, not in component state, so it
survives a page reload, a second operator and a different device. A second
request to a customer who has already reviewed is exactly the kind of thing
that costs goodwill, so this is the one rule that needs to be durable.

`review_request_sent_to` snapshots the address actually used, so later editing
the customer record does not rewrite history.

## Degrading safely

`hasTrackingColumns(row)` detects whether the migration has run by checking for
the key on the returned row. If it is absent the feature reports
`columns_missing` and the rest of the CRM is unaffected — **an unapplied
migration must never take the CRM down**, which is why this is a check and not
a query that would throw `column does not exist`.

## The email

Reuses `emailWordmarkHtml()` — the same branded wordmark as the invoice emails —
and links to the real, existing review URL
(`https://g.page/r/CYDRQCaICK7vEAE/review`, the same one the public site uses).

Deliberate choices, each covered by a test:

- **No incentive of any kind.** Incentivised reviews breach Google's policies
  and would put the whole profile at risk. Tested against a word list.
- **Assumes nothing about the experience.** "We hope you were happy with your
  clean", not "thanks for the 5 stars".
- **Offers a route to complain instead.** Unhappy customers are directed to
  reply — better than discovering it in a public review. The wording is
  deliberately open-ended ("our team will look into it"). An earlier draft said
  "our 48-hour re-clean guarantee still applies"; because the operator chooses
  when to send this email, that sentence becomes false whenever it is sent more
  than 48 hours after the job. A test now blocks any time-bound promise here.
- **First name only**, with a `there` fallback.
- **HTML is escaped**; a plain-text alternative always ships.

## Remaining work to enable

1. Apply the migration (manual, reviewed).
2. Add the button to the booking detail page in `admin/src` — visible only when
   the feature is enabled and the booking is eligible, disabled with the
   blocked-reason text otherwise, and behind a confirmation dialog naming the
   customer and the address.
3. Add `POST /api/bookings/[id]/review-request` wiring `reviewRequest.js` to
   `mailer.js`, re-checking eligibility server-side and writing the timestamp
   **after** a successful send.
4. Set `REVIEW_REQUESTS_ENABLED=true`.

Steps 2 and 3 are intentionally not built: they are the parts that can actually
send, and the brief was to keep the feature disabled pending separate explicit
approval. The rules, the template and the safety locks they depend on are done
and tested.

## Deliberately not built

- **Automatic sending on completion.** Requested manual-only, and it is the
  right call: an automatic send after a job that went badly is worse than no
  request at all.
- **Reminders / second requests.** One ask per booking.
- **Anything in development or test.** Hard-blocked above.
