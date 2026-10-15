# Initial booking-request notification outbox

This repository change makes the first customer email, owner email and Telegram
alert recoverable after the booking request has been saved. It does not change
prices, payment collection, Stripe, DNS, provider credentials or existing
customer rows. Nothing in this change applies a migration or deploys code.

## Delivery contract

`20260924140000_booking_request_notification_outbox.sql` creates three channel
rows in the same database transaction as each new durable website request. The
trigger accepts only an insert with a request key and fingerprint, unpaid
`pending_payment` state and a zero deposit. It deliberately performs no
historic backfill, so applying it cannot notify an existing booking.

The request API and the existing authenticated booking worker use service-role
RPCs to claim channel rows. A unique `(booking_id, channel)` constraint and
`FOR UPDATE SKIP LOCKED` prevent concurrent form replays or worker runs from
sending the same completed channel. Each successful checkpoint also updates
the existing `email_customer_sent`, `email_business_sent` or `telegram_sent`
flag in the same transaction. The claim function first honours those flags, so
an email sent from the established CRM retry path is not sent again by this
outbox. A database fence also checks creation of the CRM's initial-email retry
message against the outbox. It skips an already-sent channel, refuses a retry
while the website worker is actively sending, and otherwise hands that channel
to the CRM retry path. This closes the race between the two workers.

Explicit provider rejections and pre-send connection/configuration failures
remain durable and are retried after five minutes, up to five provider
attempts. Missing configuration is checked again every 15 minutes. A transport
timeout, unknown send error, or process interruption after sending starts is
different: the row becomes `uncertain`, because the provider may have accepted
the message before the checkpoint was saved. That channel requires a
destination check before an authorised manual replay; it is never silently
duplicated. The service-role-only
`requeue_uncertain_booking_request_notification` RPC requires an explicit
`p_confirm_not_delivered = true` check before it can make that row claimable
again. Email messages use the outbox UUID as a stable `Message-ID`.

The outbox stores only its opaque booking foreign key, channel and delivery
state. Customer details remain in the existing protected booking row and are
read only inside the service-role claim. Browser roles have neither table nor
RPC access. Operational logs contain fixed event labels and allow-listed error
codes; provider response text and booking/customer values are not logged.

## Worker and rollout

The already protected `POST /api/booking-management?action=process-due` worker
claims up to 12 due initial-request channels on each run, before the existing
measurement retention and delivery work. No new public route, cron secret or
scheduler is introduced. The migration must be applied in an isolated test
database before code using the RPCs is released. Release approval and live
provider acceptance remain separate gates.

Useful review query after an authorised test submission:

```sql
select channel, status, attempts, last_attempt_at, sent_at, last_error_code
from public.booking_request_notification_outbox
where booking_id = '<synthetic-test-booking-uuid>'
order by channel;
```

No customer fields are needed for this check. A healthy configured run has one
`sent` row for each enabled channel and matching legacy sent flags. Preview
delivery keeps Telegram disabled and routes both emails to the approved preview
inbox.

## Repository validation

The focused API tests prove the customer and owner emails remain multipart,
Telegram still requires both HTTP success and provider `ok: true`, sent
channels are not reclaimed on a replay, and a failed channel alone can be
claimed and sent later. Migration tests cover atomic insertion, uniqueness,
bounded claims, stale-claim quarantine, token-fenced checkpoints and
service-role-only access. These mocked checks prove application behavior; live
SMTP and Telegram acceptance still require an approved isolated acceptance
test with test recipients.
