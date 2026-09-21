-- Apply to an isolated test project first. This migration does not backfill or
-- rewrite historic bookings/payments and does not contact Google.
alter table public.bookings add column if not exists utm_term text;
alter table public.bookings add column if not exists gbraid text;
alter table public.bookings add column if not exists wbraid text;
alter table public.bookings add column if not exists measurement_advertising_consent boolean not null default false;
alter table public.bookings add column if not exists measurement_consent_version text;
alter table public.bookings add column if not exists measurement_consent_recorded_at timestamptz;
alter table public.bookings add column if not exists measurement_consent_withdrawn_at timestamptz;
alter table public.bookings add column if not exists measurement_is_test boolean not null default false;

create table if not exists public.booking_measurement_outbox (
  id uuid primary key default gen_random_uuid(),
  payment_external_id text unique not null references public.booking_journey_payments(external_id),
  booking_id uuid not null references public.bookings(id),
  event_name text not null check (event_name = 'deposit_paid'),
  conversion_id uuid unique not null default gen_random_uuid(),
  amount_pence integer not null check (amount_pence > 0),
  currency text not null check (currency = 'gbp'),
  payment_type text not null check (payment_type in ('stripe_deposit','bank_transfer_deposit')),
  paid_at timestamptz not null,
  attribution jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  provider text not null default 'google_ads_offline' check (provider = 'google_ads_offline'),
  status text not null check (status in ('pending','sending','delivered','failed','suppressed')),
  attempts integer not null default 0,
  provider_acknowledgement text,
  last_error text,
  claimed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_measurement_outbox_due
  on public.booking_measurement_outbox(status, created_at)
  where status in ('pending','failed','sending');

alter table public.booking_measurement_outbox enable row level security;
revoke all on public.booking_measurement_outbox from anon, authenticated;
grant all on public.booking_measurement_outbox to service_role;

create or replace function public.claim_booking_measurements(p_limit integer default 10)
returns setof public.booking_measurement_outbox language plpgsql security definer
set search_path = public as $$
begin
  return query
  with due as (
    select id from public.booking_measurement_outbox
    where (
      status in ('pending','failed')
      or (status = 'sending' and claimed_at < now() - interval '10 minutes')
    ) and attempts < 8
    order by created_at for update skip locked limit least(greatest(p_limit,1),25)
  )
  update public.booking_measurement_outbox o set status='sending',
    attempts=o.attempts+1, claimed_at=now(), last_error=null
  from due where o.id=due.id returning o.*;
end $$;
revoke all on function public.claim_booking_measurements(integer) from public, anon, authenticated;
grant execute on function public.claim_booking_measurements(integer) to service_role;

create or replace function public.queue_verified_deposit_measurement()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bookings; allowed boolean; attrs jsonb; consent_snapshot jsonb;
begin
  if new.kind not in ('deposit','manual_deposit') or new.amount_pence <= 0 then return new; end if;
  select * into b from public.bookings where id = new.booking_id;
  allowed := b.measurement_advertising_consent
    and b.measurement_consent_withdrawn_at is null
    and not b.measurement_is_test
    and coalesce(b.gclid, b.gbraid, b.wbraid) is not null;
  attrs := jsonb_strip_nulls(jsonb_build_object(
    'gclid', b.gclid, 'gbraid', b.gbraid, 'wbraid', b.wbraid,
    'utm_source', b.utm_source, 'utm_medium', b.utm_medium,
    'utm_campaign', b.utm_campaign, 'utm_content', b.utm_content,
    'utm_term', b.utm_term, 'landing_page', b.landing_page));
  consent_snapshot := jsonb_build_object(
    'advertising', b.measurement_advertising_consent,
    'version', b.measurement_consent_version,
    'recorded_at', b.measurement_consent_recorded_at,
    'withdrawn_at', b.measurement_consent_withdrawn_at);
  insert into public.booking_measurement_outbox(
    payment_external_id, booking_id, event_name, amount_pence, currency,
    payment_type, paid_at, attribution, consent, is_test, status, last_error)
  values(new.external_id, new.booking_id, 'deposit_paid', new.amount_pence,
    new.currency, case when new.kind='deposit' then 'stripe_deposit' else 'bank_transfer_deposit' end,
    new.created_at, attrs, consent_snapshot, b.measurement_is_test,
    case when allowed then 'pending' else 'suppressed' end,
    case when allowed then null when b.measurement_is_test then 'test_record'
      when not b.measurement_advertising_consent then 'advertising_consent_not_granted'
      when b.measurement_consent_withdrawn_at is not null then 'consent_withdrawn'
      else 'no_supported_click_id' end)
  on conflict(payment_external_id) do nothing;
  return new;
end $$;

drop trigger if exists queue_verified_deposit_measurement on public.booking_journey_payments;
create trigger queue_verified_deposit_measurement
after insert on public.booking_journey_payments
for each row execute function public.queue_verified_deposit_measurement();

-- Withdrawal is fail-closed: pending/failed records are suppressed immediately.
create or replace function public.withdraw_booking_measurement_consent(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set measurement_advertising_consent=false,
    measurement_consent_withdrawn_at=now() where id=p_booking_id;
  update public.booking_measurement_outbox set status='suppressed',
    last_error='consent_withdrawn', claimed_at=null
    where booking_id=p_booking_id and status in ('pending','failed','sending');
end $$;
revoke all on function public.withdraw_booking_measurement_consent(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_booking_measurement_consent(uuid) to service_role;

-- Retention: raw campaign attribution is no longer needed after 90 days;
-- delivered/suppressed audit rows are retained for 400 days for reconciliation.
create or replace function public.purge_expired_booking_measurement()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set gclid=null,gbraid=null,wbraid=null,utm_source=null,
    utm_medium=null,utm_campaign=null,utm_content=null,utm_term=null,landing_page=null
    where measurement_consent_recorded_at < now() - interval '90 days';
  delete from public.booking_measurement_outbox
    where status in ('delivered','suppressed') and created_at < now() - interval '400 days';
end $$;
revoke all on function public.purge_expired_booking_measurement() from public, anon, authenticated;
grant execute on function public.purge_expired_booking_measurement() to service_role;
