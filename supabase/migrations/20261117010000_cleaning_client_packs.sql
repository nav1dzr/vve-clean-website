-- UNAPPLIED REVIEW DRAFT. Requires Navid's explicit production migration approval.
-- Reuses private report storage; does not update issued invoices/bookings/payments.
begin;
create table public.cleaning_client_packs (
 id uuid primary key,
 title text not null check(length(title) between 1 and 160),
 customer_name text not null check(length(customer_name) between 1 and 200),
 property_address text not null check(length(property_address) between 1 and 1000),
 service_date date not null,
 summary text not null default '' check(length(summary)<=4000),
 invoice_reference text not null default '' check(length(invoice_reference)<=100),
 customer_id uuid references public.customers(id),
 booking_id uuid references public.bookings(id),
 invoice_id uuid references public.invoices(id),
 status text not null default 'draft' check(status in ('draft','published','revoked')),
 revision integer not null default 1 check(revision>0),
 assets jsonb not null default '[]' check(jsonb_typeof(assets)='array' and jsonb_array_length(assets)<=30),
 token_hash text unique check(token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz, published_at timestamptz, revoked_at timestamptz,
 created_by uuid not null references public.admin_users(id),
 updated_by uuid not null references public.admin_users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status <> 'published' or (token_hash is not null and expires_at is not null))
);
create index cleaning_client_packs_customer on public.cleaning_client_packs(customer_id,created_at desc);
create index cleaning_client_packs_booking on public.cleaning_client_packs(booking_id,created_at desc);
create index cleaning_client_packs_invoice on public.cleaning_client_packs(invoice_id,created_at desc);
alter table public.cleaning_client_packs enable row level security;
revoke all on public.cleaning_client_packs from anon,authenticated;
revoke all on public.cleaning_client_packs from service_role;
grant select,insert,update on public.cleaning_client_packs to service_role;
-- Existing report endpoints retain their original 2 MB photo/4 MB PDF validation.
-- Direct uploads for client packs require larger photos/video. Bucket remains private.
do $$ begin
 if not exists(select 1 from storage.buckets where id='cleaning-reports-private' and public=false) then
  raise exception 'Install the approved private completion-report bucket first';
 end if;
end $$;
update storage.buckets set file_size_limit=greatest(coalesce(file_size_limit,0),104857600),
 allowed_mime_types=array['image/jpeg','image/png','application/pdf','video/mp4']
 where id='cleaning-reports-private' and public=false;
-- Existing restrictive storage policy blocks all anon/authenticated object access.
-- Upload/read links are issued server-side only after administrator or bearer checks.
commit;
