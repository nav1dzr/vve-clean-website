-- Optional canonical GA4 request event. Additive follow-up to the 4 October queue.
-- No backfill: installing this migration does not enqueue existing requests.
-- No price, Stripe, payment ledger or Google Ads configuration is changed.
-- Apply only to an isolated test database until production migration approval.
alter table public.booking_ga4_measurement_outbox
  drop constraint if exists booking_ga4_measurement_outbox_event_name_check;
alter table public.booking_ga4_measurement_outbox
  add constraint booking_ga4_measurement_outbox_event_name_check
  check (event_name in ('booking_request_submitted','begin_checkout','purchase'));
alter table public.booking_ga4_measurement_outbox alter column amount_pence drop not null;
alter table public.booking_ga4_measurement_outbox alter column currency drop not null;
alter table public.booking_ga4_measurement_outbox
  drop constraint if exists booking_ga4_measurement_event_value_check;
alter table public.booking_ga4_measurement_outbox
  add constraint booking_ga4_measurement_event_value_check check (
    (event_name = 'booking_request_submitted' and amount_pence is null and currency is null)
    or (event_name in ('begin_checkout','purchase') and amount_pence is not null
      and amount_pence > 0 and currency is not null and currency = 'gbp')
  );

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
  if p_event_name is null or p_event_name not in ('booking_request_submitted','begin_checkout','purchase') then return; end if;
  if p_event_name = 'booking_request_submitted' then
    if p_amount_pence is not null or p_currency is not null then return; end if;
  elsif p_amount_pence is null or p_amount_pence <= 0 or p_currency is distinct from 'gbp' then
    return;
  end if;
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

-- Website request insertion commits before its optional GA4 context is saved.
-- Capture that first context update, or an insert that already includes context.
-- Updates/retries use the original creation time and the same unique event key.
-- The request must be modern, unpaid and new; imports and old checkout rows are excluded.
create or replace function public.queue_booking_ga4_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if old.ga4_context is not null then return new; end if;
  end if;
  if new.ga4_context is null or new.request_key is null
    or coalesce(new.payment_status, '') <> 'pending_payment'
    or coalesce(new.deposit_amount, -1) <> 0
    or coalesce(new.status, '') <> 'new'
    or new.measurement_consent_withdrawn_at is not null then return new; end if;
  perform public.queue_booking_ga4_measurement(
    new.id,'booking_request_submitted',null,null,new.created_at,false
  );
  return new;
exception when others then
  -- Analytics remains optional: a queue failure must never reject a valid booking.
  raise warning 'booking_ga4_request_enqueue_failed';
  return new;
end $$;
drop trigger if exists queue_booking_ga4_request on public.bookings;
create trigger queue_booking_ga4_request after insert or update of ga4_context on public.bookings
  for each row execute function public.queue_booking_ga4_request();
revoke all on function public.queue_booking_ga4_request() from public, anon, authenticated;

create or replace function public.claim_booking_ga4_measurements(
  p_mode text, p_limit integer default 10
) returns setof public.booking_ga4_measurement_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_mode not in ('validate','live') then return; end if;
  -- GA4 has purchase transaction deduplication, but no such promise for
  -- custom requests or begin_checkout. Interrupted sends must be reviewed, not replayed.
  update public.booking_ga4_measurement_outbox set status='uncertain',
    claimed_at=null,last_error='ga4_previous_send_outcome_unknown'
    where mode=p_mode and status='sending' and event_name <> 'purchase'
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
