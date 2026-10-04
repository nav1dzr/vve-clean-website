-- Additive, opt-in GA4 measurement. Apply to an isolated test database first.
-- No historical backfill, payment mutation, Stripe configuration or Ads changes.
-- The request API writes ga4_context only when the separately configured GA4
-- mode is validate/live. Validation rows cannot be promoted into live delivery.
alter table public.bookings add column if not exists ga4_context jsonb;

create table if not exists public.booking_ga4_measurement_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  event_name text not null check (event_name in ('begin_checkout','purchase')),
  event_key text not null unique,
  amount_pence integer not null check (amount_pence > 0),
  currency text not null check (currency = 'gbp'),
  occurred_at timestamptz not null,
  analytics_context jsonb not null default '{}',
  mode text not null check (mode in ('validate','live')),
  is_test boolean not null default false,
  status text not null check (status in (
    'pending','sending','failed','submitted','validated','suppressed','uncertain'
  )),
  attempts integer not null default 0,
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  submitted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (booking_id,event_name)
);
create index if not exists booking_ga4_measurement_due
  on public.booking_ga4_measurement_outbox(mode,status,next_attempt_at,created_at);
alter table public.booking_ga4_measurement_outbox enable row level security;
revoke all on public.booking_ga4_measurement_outbox from public, anon, authenticated;
grant all on public.booking_ga4_measurement_outbox to service_role;

create or replace function public.queue_booking_ga4_measurement(
  p_booking_id uuid, p_event_name text, p_amount_pence integer,
  p_currency text, p_occurred_at timestamptz, p_is_test boolean default false
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.bookings;
  c jsonb;
  reason text;
begin
  select * into b from public.bookings where id=p_booking_id;
  if not found or b.ga4_context is null then return; end if;
  c := b.ga4_context;
  if c->>'mode' not in ('validate','live') or c->>'mode' is null then return; end if;
  if p_event_name not in ('begin_checkout','purchase') or p_amount_pence <= 0
    or p_currency <> 'gbp' then return; end if;
  reason := case
    when b.measurement_is_test or p_is_test then 'test_record'
    when b.measurement_consent_withdrawn_at is not null then 'consent_withdrawn'
    when c->>'analytics' is distinct from 'true' then 'analytics_consent_not_granted'
    when c->>'consent_version' is distinct from '2026-07-14'
      or nullif(c->>'consent_recorded_at','') is null then 'consent_record_missing'
    when coalesce(c->>'client_id','') !~ '^[0-9]{1,20}\.[0-9]{1,20}$'
      then 'analytics_identity_missing'
    when coalesce(c->>'measurement_id','') !~ '^G-[A-Z0-9]{4,30}$'
      then 'analytics_property_missing'
    else null end;
  -- Never copy request text, address, bank reference, URLs or arbitrary context.
  c := case when reason is null then jsonb_strip_nulls(jsonb_build_object(
    'client_id',c->>'client_id',
    'measurement_id',c->>'measurement_id',
    'session_id',case when c->>'session_id' ~ '^[0-9]{1,16}$' then c->>'session_id' end,
    'captured_at',c->>'captured_at',
    'analytics',true,
    'advertising',coalesce(c->>'advertising','false')='true',
    'consent_version',c->>'consent_version',
    'consent_recorded_at',c->>'consent_recorded_at'
  )) else '{}'::jsonb end;
  insert into public.booking_ga4_measurement_outbox(
    booking_id,event_name,event_key,amount_pence,currency,occurred_at,
    analytics_context,mode,is_test,status,last_error
  ) values (
    b.id,p_event_name,'booking:'||b.id::text||':'||p_event_name,
    p_amount_pence,p_currency,p_occurred_at,c,b.ga4_context->>'mode',
    b.measurement_is_test or p_is_test,
    case when reason is null then 'pending' else 'suppressed' end,reason
  ) on conflict (booking_id,event_name) do nothing;
end $$;
revoke all on function public.queue_booking_ga4_measurement(uuid,text,integer,text,timestamptz,boolean)
  from public, anon, authenticated;
grant execute on function public.queue_booking_ga4_measurement(uuid,text,integer,text,timestamptz,boolean)
  to service_role;

-- Only an already-created, committed deposit Checkout Session starts checkout.
-- Browser request submission and clicks do not enter the payment funnel.
create or replace function public.queue_booking_ga4_checkout()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j public.booking_journeys;
  amount_text text;
begin
  if new.event_type <> 'checkout_ready' then return new; end if;
  select * into j from public.booking_journeys where booking_id=new.booking_id;
  if j.checkout_kind is distinct from 'deposit' then return new; end if;
  amount_text := new.details->'changes'->>'ga4_checkout_amount_pence';
  if amount_text is null or amount_text !~ '^[0-9]{1,9}$' then return new; end if;
  perform public.queue_booking_ga4_measurement(
    new.booking_id,'begin_checkout',amount_text::integer,'gbp',new.created_at,
    coalesce(new.details->'changes'->>'checkout_id','') like 'cs_test_%'
  );
  return new;
exception when others then
  -- Optional telemetry must never roll back a customer's checkout or payment.
  raise warning 'booking_ga4_checkout_enqueue_failed';
  return new;
end $$;
drop trigger if exists queue_booking_ga4_checkout on public.booking_journey_events;
create trigger queue_booking_ga4_checkout after insert on public.booking_journey_events
  for each row execute function public.queue_booking_ga4_checkout();

-- The restricted, authoritative payment ledger owns purchase. No page-view or
-- redirect can manufacture it. Balance payments and refunds are not deposits.
create or replace function public.queue_booking_ga4_purchase()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.kind not in ('deposit','manual_deposit') or new.amount_pence <= 0 then return new; end if;
  if new.kind='deposit' and new.external_id !~ '^cs_[A-Za-z0-9_-]{1,196}$' then return new; end if;
  perform public.queue_booking_ga4_measurement(
    new.booking_id,'purchase',new.amount_pence,new.currency,new.created_at,
    new.kind='deposit' and new.external_id like 'cs_test_%'
  );
  return new;
exception when others then
  raise warning 'booking_ga4_purchase_enqueue_failed';
  return new;
end $$;
drop trigger if exists queue_booking_ga4_purchase on public.booking_journey_payments;
create trigger queue_booking_ga4_purchase after insert on public.booking_journey_payments
  for each row execute function public.queue_booking_ga4_purchase();
revoke all on function public.queue_booking_ga4_checkout(),public.queue_booking_ga4_purchase()
  from public, anon, authenticated;

create or replace function public.claim_booking_ga4_measurements(
  p_mode text, p_limit integer default 10
) returns setof public.booking_ga4_measurement_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_mode not in ('validate','live') then return; end if;
  -- GA4 has purchase transaction deduplication, but no such promise for
  -- begin_checkout. An interrupted non-purchase send must be reviewed, not replayed.
  update public.booking_ga4_measurement_outbox set status='uncertain',
    claimed_at=null,last_error='ga4_previous_send_outcome_unknown'
    where mode=p_mode and status='sending' and event_name='begin_checkout'
      and claimed_at < now()-interval '10 minutes';
  return query with due as (
    select id from public.booking_ga4_measurement_outbox
    where mode=p_mode and attempts < 8 and (
      (status in ('pending','failed') and (next_attempt_at is null or next_attempt_at <= now()))
      or (status='sending' and event_name='purchase' and claimed_at < now()-interval '10 minutes')
    ) order by created_at for update skip locked limit least(greatest(p_limit,1),25)
  ) update public.booking_ga4_measurement_outbox o set status='sending',
      attempts=o.attempts+1,claimed_at=now(),last_error=null
    from due where o.id=due.id returning o.*;
end $$;
revoke all on function public.claim_booking_ga4_measurements(text,integer) from public, anon, authenticated;
grant execute on function public.claim_booking_ga4_measurements(text,integer) to service_role;

-- The existing consent-withdrawal RPC sets measurement_consent_withdrawn_at.
-- This trigger adds GA4 suppression without replacing that RPC or its Ads logic.
create or replace function public.suppress_withdrawn_booking_ga4()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.measurement_consent_withdrawn_at is not null or new.measurement_is_test
    or new.ga4_context->>'analytics' is distinct from 'true' then
    update public.booking_ga4_measurement_outbox set analytics_context='{}',
      status=case when status in ('pending','failed','sending') then 'suppressed' else status end,
      claimed_at=null,last_error=case when new.measurement_is_test then 'test_record' else 'consent_withdrawn' end
      where booking_id=new.id;
    -- Erase the identity on the booking itself as part of this same write.
    -- A later unmark/reconsent cannot restore or replay the old snapshot.
    new.ga4_context := null;
  end if;
  return new;
end $$;
drop trigger if exists suppress_withdrawn_booking_ga4 on public.bookings;
create trigger suppress_withdrawn_booking_ga4
  before update of ga4_context,measurement_consent_withdrawn_at,measurement_is_test on public.bookings
  for each row execute function public.suppress_withdrawn_booking_ga4();
revoke all on function public.suppress_withdrawn_booking_ga4() from public, anon, authenticated;

create or replace function public.purge_expired_booking_ga4_measurement()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Events older than GA4's maximum backdating window are never rewritten as new.
  update public.booking_ga4_measurement_outbox set status='suppressed',
    analytics_context='{}',claimed_at=null,last_error='ga4_event_expired'
    where status in ('pending','failed','sending') and occurred_at < now()-interval '72 hours';
  update public.bookings set ga4_context=null
    where ga4_context is not null and created_at < now()-interval '90 days';
  update public.booking_ga4_measurement_outbox set analytics_context='{}'
    where created_at < now()-interval '90 days' and analytics_context <> '{}';
  delete from public.booking_ga4_measurement_outbox
    where status in ('submitted','validated','suppressed') and created_at < now()-interval '400 days';
end $$;
revoke all on function public.purge_expired_booking_ga4_measurement() from public, anon, authenticated;
grant execute on function public.purge_expired_booking_ga4_measurement() to service_role;
