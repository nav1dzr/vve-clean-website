# Scheduled invoice emails, safety fixes and Home to-do list

Prepared 16 November 2026 on branch `claude/crm-safety-and-scheduled-send-20261116`, stacked on `codex/crm-completion-review-20261114` (PR #70). **Nothing here is live.** No migration has been applied, no production setting changed and no email sent.

## What this branch adds

### 1. Safety fixes — live as soon as the code is merged, no database change

- "Mark clean completed" and "Record payment and email receipt" ask for confirmation first; both email the customer.
- The booking agreement form keeps unsaved edits on the device for 24 hours and offers them back after an app switch or reload. Cleared on sign-out.
- An invoice replaced by a revision no longer counts towards the customer's outstanding balance, is labelled "Replaced" in lists, and cannot be emailed or reminded.
- A receipt cannot be emailed once its invoice is voided or no longer fully paid.
- Voiding an invoice that has a recorded payment or receipt needs an explicit tick-box acknowledgement.
- The payment date defaults to the UK date. Invoice history shows who each email went to.
- Send and Record payment sit at the top of the invoice page. The booking page leads with the customer's name, date and postcode.
- Home has a "Needs attention" list; Invoices has "Not emailed yet" and "Overdue" quick filters.

### 2. Scheduled invoice emails — stays hidden until switched on

Hidden while `INVOICE_EMAIL_QUEUE_ENABLED` is not `true`. With it off, the invoice page keeps the existing Send dialog (now with an amount and attachment summary) and the existing send route is unchanged.

When on:

- **Send** opens a sheet showing subject, amount due, total, deposit, due date, attachment and payment details, with **Send now** or **Schedule send**.
- Schedule send suggests the next morning at 08:00 UK time. Times are quarter-hours from 07:00 to 20:45, up to 60 days ahead.
- A draft gains **Issue and schedule email**: it issues first (permanent number, fixed PDF), then opens the sheet. Nothing is emailed until the time is confirmed.
- The invoice shows the waiting email with **Edit time**, **Send now** and **Cancel schedule**, and a history of every send.
- Invoices and Home list scheduled emails and any that need a decision.

Policy at send time (re-checked immediately before sending):

| Since scheduling | Result |
|---|---|
| Nothing changed | Sends the stored issued PDF |
| Paid in full, or voided | Cancelled; nothing sent |
| Part paid, details corrected, replaced by a revision, payment details incomplete | Held for your decision; nothing sent |
| More than 2 hours late, or outside 07:00–21:00 UK time | Held as "missed send time" |

Delivery outcomes — this does **not** claim exactly-once delivery:

- Accepted by Gmail → **Sent**.
- Definitely not transmitted (sign-in refused, recipient refused, connection never opened) → retried after 5, 15 and 45 minutes, then **On hold**.
- Anything else (timeout, dropped connection, interrupted run) → **Unsure**. Never retried automatically. You check Sent mail and choose "It did send" or "It did not send".
- A browser-generated request id, a one-open-email-per-invoice database index and an atomic claim prevent duplicates from double taps, retries and concurrent workers.

## Evidence

Run in `admin/` on 16 November 2026:

| Check | Result |
|---|---|
| `npm test` | 114 files, 1,561 tests passed after merging current main (PR #71) |
| `npm run typecheck`, `npm run lint`, `npm run build` | passed; lint 0 errors and 1 existing warning; existing bundle-size warning |
| `scripts/validate-invoice-email-outbox-db.sql` against a throwaway local PostgreSQL 18 | 10 of 10 checks passed: applies twice, repeated id refused, one open email per invoice, claim wins once, invalid values refused, browser roles have no access, rollback works |
| Phone-width (375×812) preview with made-up data | Home list, invoice page, Send sheet: no sideways scrolling; Send / Record payment at 192px from the top (was 1,378px) |

Not tested: a real email through Gmail, the production scheduler, and production data. Mail was a local stub in every test.

## Go-live checklist — each step needs Navid's approval

Do them in this order. Stop at any step that does not match.

1. **Merge PR #70 first**, then this branch's pull request. Both required checks must pass. After this step the safety fixes and Home list are live; scheduled sending is still hidden.
2. **Phase 0 read-only check** (`output/crm-audit-2026-11-15/phase0/` in the audit worktree): confirm `pg_cron`, `pg_net` and Vault are enabled.
3. **Apply the migration** `supabase/migrations/20261117090000_invoice_email_outbox.sql`. It only adds one table and three indexes.
4. **Create the worker secret**: a random string of 32 or more characters. Store it as `INVOICE_EMAIL_WORKER_SECRET` on the `vve-clean-crm` Vercel project (Production) and as the Vault secret `vve_invoice_email_worker_secret`. Do not paste it into chat or a file.
5. **Switch on** `INVOICE_EMAIL_QUEUE_ENABLED=true` on `vve-clean-crm` (Production) and redeploy.
6. **Test "Send now"** on an invoice addressed to your own email. Check it arrives once, with the PDF, and the invoice shows "Sent".
7. **Activate the scheduler**: run `ops/invoice-email-schedule.sql`. It refuses to run unless the Vault secret exists.
8. **Test "Schedule send"** for 15 minutes ahead on an invoice addressed to yourself. Check it arrives within about five minutes of the time, once.
9. Use it for real.

## Switching it off

| To stop | Do this | Effect |
|---|---|---|
| All scheduled sending immediately | `select cron.unschedule('vve-invoice-emails');` | Nothing is sent on a timer. "Send now" still works |
| The whole feature | Set `INVOICE_EMAIL_QUEUE_ENABLED` to `false` and redeploy | The old Send dialog returns. Waiting emails stay stored and are not sent |
| The code | Revert the merge commit | Removes everything in this branch |
| The table | `drop table public.invoice_email_outbox;` after the flag is off | Removes queue history. Invoices and their "sent" history are untouched |

## Decisions taken as defaults (change any of them)

- Scheduling from a draft issues the invoice immediately. The invoice date is the issue date on the draft, or today if blank; set it to the send date first if you want that.
- Default suggestion 08:00; no automatic sending between 21:00 and 07:00 UK time.
- Held, failed and unsure emails appear on Home and Invoices. No Telegram or email alert is sent to you for them.

## Not included

Scheduled payment reminders, receipts on the queue, a per-customer message timeline, one-screen manual booking, job templates, calendar activation, staff permissions, and the two-way link between booking payments and invoice payments.
