-- Manual, one-recipient CRM correspondence. No automatic sending or job.
-- Apply to an isolated test database first. Production requires owner approval.
begin;
create table if not exists public.customer_emails (
  id uuid primary key,
  customer_id uuid not null references public.customers(id),
  created_by uuid not null references public.admin_users(id),
  recipient text not null check (length(recipient) between 3 and 254),
  subject text not null check (length(subject) between 1 and 180),
  body text not null check (length(body) between 1 and 20000),
  style text not null check (style in ('simple','branded')),
  content_hash text not null,
  html_snapshot text not null,
  text_snapshot text not null,
  status text not null default 'draft' check (status in ('draft','sending','accepted','uncertain')),
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  accepted_at timestamptz,
  provider_message_id text
);
create index if not exists customer_emails_history on public.customer_emails(customer_id, created_at desc);
alter table public.customer_emails enable row level security;
revoke all on public.customer_emails from anon, authenticated;
grant select, insert, update on public.customer_emails to service_role;
comment on table public.customer_emails is 'Private manual correspondence. Immutable preview snapshots; atomic draft-to-sending claim. SMTP uncertainty is never automatically retried.';
commit;
