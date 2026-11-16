-- Invoice email queue: "send now" and "schedule send" for issued invoices.
--
-- Review-only until approved. Apply to an isolated test database first;
-- production requires Navid's explicit approval. Additive: one new table and
-- its indexes. No existing table, column, constraint, function, row or
-- scheduled job is changed. No email is sent by applying this file.
--
-- Rollback: `drop table public.invoice_email_outbox;` (after switching
-- INVOICE_EMAIL_QUEUE_ENABLED off). Nothing else depends on it.
begin;

create table if not exists public.invoice_email_outbox (
  -- Generated in the browser so a double-tap or retried request is one row.
  id uuid primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice')),
  recipient text not null check (length(recipient) between 3 and 254),
  custom_message text check (custom_message is null or length(custom_message) <= 2000),
  -- What the owner approved. Compared with the invoice just before sending;
  -- any difference holds the email for review instead of sending it.
  expected_document_version integer not null check (expected_document_version >= 1),
  expected_amount_due numeric not null check (expected_amount_due > 0),
  scheduled_for timestamptz not null,
  next_attempt_at timestamptz not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'sending', 'sent', 'uncertain', 'held', 'cancelled')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 40),
  hold_reason text check (hold_reason is null or length(hold_reason) <= 40),
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 40),
  created_by uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one email per invoice may be waiting for its time or for the
-- owner's decision. A second schedule must edit or cancel the first.
create unique index if not exists invoice_email_outbox_one_open
  on public.invoice_email_outbox (invoice_id)
  where status in ('scheduled', 'sending', 'held', 'uncertain');

create index if not exists invoice_email_outbox_due
  on public.invoice_email_outbox (status, next_attempt_at);

create index if not exists invoice_email_outbox_history
  on public.invoice_email_outbox (invoice_id, created_at desc);

-- Server-only, like every other financial table: no browser role can read
-- or write it. The CRM's server routes use the service role.
alter table public.invoice_email_outbox enable row level security;
revoke all on public.invoice_email_outbox from anon, authenticated;
grant select, insert, update on public.invoice_email_outbox to service_role;

comment on table public.invoice_email_outbox is
  'Queued and scheduled invoice emails. Atomic scheduled-to-sending claim; unconfirmed sends are marked uncertain and never retried automatically.';

commit;
