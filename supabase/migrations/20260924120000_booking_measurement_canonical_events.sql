-- Additive upgrade from the immutable 20260917120000 deposit-only outbox.
-- Existing outbox rows and their values are deliberately left unchanged. New
-- rows use canonical_event_version=2 and the provider-neutral event contract.
-- This migration does not backfill bookings/payments or contact a provider.
alter table public.bookings add column if not exists utm_term text;
alter table public.bookings add column if not exists gbraid text;
alter table public.bookings add column if not exists wbraid text;
alter table public.bookings add column if not exists attribution_first_touch_at timestamptz;
alter table public.bookings add column if not exists measurement_advertising_consent boolean not null default false;
alter table public.bookings add column if not exists measurement_consent_version text;
alter table public.bookings add column if not exists measurement_consent_recorded_at timestamptz;
alter table public.bookings add column if not exists measurement_consent_withdrawn_at timestamptz;
alter table public.bookings add column if not exists measurement_is_test boolean not null default false;
alter table public.bookings add column if not exists measurement_email_sha256 text
  check (measurement_email_sha256 is null or measurement_email_sha256 ~ '^[0-9a-f]{64}$');
alter table public.bookings add column if not exists measurement_phone_sha256 text
  check (measurement_phone_sha256 is null or measurement_phone_sha256 ~ '^[0-9a-f]{64}$');

-- Extend the already-created outbox in place. The legacy paid_at column stays
-- available for old rows; canonical rows use occurred_at. Nullable legacy-only
-- values are intentional and are handled by the delivery compatibility layer.
alter table public.booking_measurement_outbox
  add column if not exists event_key text,
  add column if not exists occurred_at timestamptz,
  add column if not exists match_data jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists status_checks integer not null default 0,
  add column if not exists canonical_event_version smallint;

-- Adding the default after the nullable column preserves a NULL version on
-- every historical deposit-only row while making every future row version 2.
alter table public.booking_measurement_outbox
  alter column canonical_event_version set default 2,
  alter column payment_external_id drop not null,
  alter column amount_pence drop not null,
  alter column currency drop not null,
  alter column payment_type drop not null,
  alter column paid_at drop not null,
  alter column provider set default 'google_data_manager';

-- Replace only the constraints whose allowed values expand in version 2.
-- Historical rows remain valid and retain the original provider and fields.
alter table public.booking_measurement_outbox
  drop constraint if exists booking_measurement_outbox_event_name_check,
  drop constraint if exists booking_measurement_outbox_provider_check,
  drop constraint if exists booking_measurement_outbox_status_check,
  drop constraint if exists booking_measurement_outbox_canonical_row_check;

alter table public.booking_measurement_outbox
  add constraint booking_measurement_outbox_event_name_check check (event_name in (
    'booking_request_submitted',
    'booking_request_qualified',
    'deposit_paid',
    'booking_confirmed'
  )),
  add constraint booking_measurement_outbox_provider_check check (provider in (
    'google_ads_offline',
    'google_data_manager'
  )),
  add constraint booking_measurement_outbox_status_check check (status in (
    'pending','sending','submitted','validated','delivered','failed','suppressed'
  )),
  add constraint booking_measurement_outbox_canonical_row_check check (
    canonical_event_version is null or (
      canonical_event_version = 2
      and event_key is not null
      and occurred_at is not null
      and (
        (event_name = 'deposit_paid'
          and amount_pence > 0
          and currency = 'gbp'
          and (
            (payment_type = 'stripe_deposit'
              and payment_external_id ~ '^cs_[A-Za-z0-9_-]{1,196}$')
            or (payment_type = 'bank_transfer_deposit'
              and payment_external_id is null)
          ))
        or
        (event_name <> 'deposit_paid'
          and payment_external_id is null
          and amount_pence is null
          and currency is null
          and payment_type is null)
      )
    )
  ) not valid;

create unique index if not exists booking_measurement_outbox_event_key_key
  on public.booking_measurement_outbox(event_key);

drop index if exists public.booking_measurement_outbox_due;
create index if not exists booking_measurement_outbox_due
  on public.booking_measurement_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed','sending','submitted');

alter table public.booking_measurement_outbox enable row level security;
revoke all on public.booking_measurement_outbox from anon, authenticated;
grant all on public.booking_measurement_outbox to service_role;

-- Preserve the latest booking journey behaviour while allowing a verified
-- payment provider/owner action to supply when the payment actually occurred.
-- Missing or malformed timestamps safely fall back to the transaction time.
create or replace function public.apply_booking_journey (
  p_booking_id uuid,
  p_revision integer,
  p_actor text,
  p_event text,
  p_patch jsonb default '{}',
  p_booking_patch jsonb default '{}',
  p_message jsonb default null,
  p_payment jsonb default null
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  j public.booking_journeys;
  next_row public.booking_journeys;
  affected integer;
  payment_occurred_at timestamptz;
begin
 select * into j from public.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(
   select 1 from public.booking_journey_payments
   where external_id = p_payment->>'external_id'
 ) then return to_jsonb(j); end if;
 if j.revision <> p_revision then
   raise exception 'Booking changed; reload before trying again' using errcode = '40001';
 end if;
 if p_payment is not null then
   payment_occurred_at := now();
   if nullif(p_payment->>'occurred_at', '') is not null then
     begin
       payment_occurred_at := (p_payment->>'occurred_at')::timestamptz;
     exception
       when invalid_datetime_format or datetime_field_overflow then
         payment_occurred_at := now();
     end;
   end if;
   insert into public.booking_journey_payments(
     external_id,booking_id,kind,amount_pence,currency,created_at
   ) values(
     p_payment->>'external_id',p_booking_id,p_payment->>'kind',
     (p_payment->>'amount_pence')::integer,'gbp',payment_occurred_at
   );
 end if;
 next_row := jsonb_populate_record(j, p_patch - 'booking_id' - 'revision' - 'updated_at');
 update public.booking_journeys set revision=j.revision+1, offer_version=next_row.offer_version,
 state=next_row.state,draft=next_row.draft,snapshot=next_row.snapshot,previous_snapshot=next_row.previous_snapshot,
 token_generation=next_row.token_generation,token_expires_at=next_row.token_expires_at,hold_until=next_row.hold_until,
 reminder_sent_at=next_row.reminder_sent_at,
 appointment_reminder_sent_at=next_row.appointment_reminder_sent_at,
 checkout_id=next_row.checkout_id,checkout_kind=next_row.checkout_kind,checkout_creating_at=next_row.checkout_creating_at,
 paid_pence=next_row.paid_pence,refunded_pence=next_row.refunded_pence,customer_request=next_row.customer_request,updated_at=now()
 where booking_id=p_booking_id returning * into j;
 if p_booking_patch <> '{}'::jsonb then
   update public.bookings set
     service=coalesce(p_booking_patch->>'service',service),
     preferred_date=coalesce(p_booking_patch->>'preferred_date',preferred_date),
     preferred_time=coalesce(p_booking_patch->>'preferred_time',preferred_time),
     service_date=coalesce((p_booking_patch->>'service_date')::date,service_date),
     address=coalesce(p_booking_patch->>'address',address),postcode=coalesce(p_booking_patch->>'postcode',postcode),
     total_price=coalesce((p_booking_patch->>'total_price')::numeric,total_price),
     deposit_amount=coalesce((p_booking_patch->>'deposit_amount')::numeric,deposit_amount),
     payment_status=coalesce(p_booking_patch->>'payment_status',payment_status),
     balance_status=coalesce(p_booking_patch->>'balance_status',balance_status),
     balance_paid_at=coalesce((p_booking_patch->>'balance_paid_at')::timestamptz,balance_paid_at),
     balance_payment_method=coalesce(p_booking_patch->>'balance_payment_method',balance_payment_method),
     status=coalesce(p_booking_patch->>'status',status),updated_at=now()
   where id=p_booking_id;
 end if;
 insert into public.booking_journey_events(booking_id,revision,actor,event_type,details)
 values(p_booking_id,j.revision,p_actor,p_event,jsonb_build_object('changes',p_patch,'booking_changes',p_booking_patch));
 if p_message is not null then
   insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload')
   on conflict(dedup_key) do nothing;
   if p_message->>'kind' in (
     'confirmation','revised_confirmation','receipt','reschedule_received',
     'cancellation_requested','cancelled','payment_review'
   ) then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',
       (p_message->'payload')||jsonb_build_object('audience','business')
     ) on conflict(dedup_key) do nothing;
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':telegram',p_message->>'kind',
       (p_message->'payload')||jsonb_build_object('audience','business','channel','telegram')
     ) on conflict(dedup_key) do nothing;
   end if;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','cancelled') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':calendar','calendar_sync',
       (p_message->'payload')||jsonb_build_object('audience','business','channel','calendar')
     ) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function public.apply_booking_journey(
  uuid,integer,text,text,jsonb,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.apply_booking_journey(
  uuid,integer,text,text,jsonb,jsonb,jsonb,jsonb
) to service_role;

create or replace function public.claim_booking_measurements(p_limit integer default 10)
returns setof public.booking_measurement_outbox language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  return query
  with due as (
    select id,status from public.booking_measurement_outbox
    where (
      (status in ('pending','failed') and attempts < 8
        and (next_attempt_at is null or next_attempt_at <= now()))
      or (status = 'sending' and attempts < 8
        and claimed_at < now() - interval '10 minutes')
      or (status = 'submitted' and (next_attempt_at is null or next_attempt_at <= now())
        and (claimed_at is null or claimed_at < now() - interval '10 minutes'))
    )
    order by created_at for update skip locked limit least(greatest(p_limit,1),25)
  )
  update public.booking_measurement_outbox o set
    status=case when due.status='submitted' then 'submitted' else 'sending' end,
    attempts=o.attempts+case when due.status='submitted' then 0 else 1 end,
    status_checks=o.status_checks+case when due.status='submitted' then 1 else 0 end,
    claimed_at=now(),
    last_error=case when due.status='submitted' then o.last_error else null end
  from due where o.id=due.id returning o.*;
end $$;
revoke all on function public.claim_booking_measurements(integer) from public, anon, authenticated;
grant execute on function public.claim_booking_measurements(integer) to service_role;

-- Snapshot only non-personal campaign and consent fields. Ineligible events
-- remain visible for reconciliation but can never be claimed for delivery.
create or replace function public.queue_booking_measurement(
  p_booking_id uuid,
  p_event_name text,
  p_event_key text,
  p_occurred_at timestamptz,
  p_payment_external_id text default null,
  p_amount_pence integer default null,
  p_currency text default null,
  p_payment_type text default null
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  b public.bookings;
  allowed boolean;
  attrs jsonb;
  consent_snapshot jsonb;
  match_snapshot jsonb;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then raise exception 'Measurement booking not found'; end if;

  allowed := b.measurement_advertising_consent
    and b.measurement_consent_withdrawn_at is null
    and b.measurement_consent_recorded_at is not null
    and nullif(b.measurement_consent_version, '') is not null
    and not b.measurement_is_test
    and (
      b.gclid ~ '^[A-Za-z0-9._~-]{1,200}$'
      or b.gbraid ~ '^[A-Za-z0-9._~-]{1,200}$'
      or b.wbraid ~ '^[A-Za-z0-9._~-]{1,200}$'
      or b.measurement_email_sha256 ~ '^[0-9a-f]{64}$'
      or b.measurement_phone_sha256 ~ '^[0-9a-f]{64}$'
    );
  attrs := jsonb_strip_nulls(jsonb_build_object(
    'gclid', b.gclid, 'gbraid', b.gbraid, 'wbraid', b.wbraid,
    'first_source', b.first_source, 'last_source', b.last_source,
    'first_touch_at', b.attribution_first_touch_at,
    'utm_source', b.utm_source, 'utm_medium', b.utm_medium,
    'utm_campaign', b.utm_campaign, 'utm_content', b.utm_content,
    'utm_term', b.utm_term, 'landing_page', b.landing_page));
  consent_snapshot := jsonb_build_object(
    'advertising', b.measurement_advertising_consent,
    'version', b.measurement_consent_version,
    'recorded_at', b.measurement_consent_recorded_at,
    'withdrawn_at', b.measurement_consent_withdrawn_at);
  match_snapshot := case when b.measurement_advertising_consent
    and b.measurement_consent_withdrawn_at is null
    and b.measurement_consent_recorded_at is not null
    and nullif(b.measurement_consent_version, '') is not null then
      jsonb_strip_nulls(jsonb_build_object(
        'email_sha256', b.measurement_email_sha256,
        'phone_sha256', b.measurement_phone_sha256))
    else '{}'::jsonb end;

  insert into public.booking_measurement_outbox(
    event_key, canonical_event_version, booking_id, payment_external_id, event_name,
    amount_pence, currency, payment_type, occurred_at,
    attribution, consent, match_data, is_test, status, last_error)
  values(
    p_event_key, 2, p_booking_id, p_payment_external_id, p_event_name,
    p_amount_pence, p_currency, p_payment_type, p_occurred_at,
    attrs, consent_snapshot, match_snapshot, b.measurement_is_test,
    case when allowed then 'pending' else 'suppressed' end,
    case when allowed then null when b.measurement_is_test then 'test_record'
      when b.measurement_consent_withdrawn_at is not null then 'consent_withdrawn'
      when not b.measurement_advertising_consent then 'advertising_consent_not_granted'
      when b.measurement_consent_recorded_at is null
        or nullif(b.measurement_consent_version, '') is null then 'consent_record_missing'
      else 'no_eligible_match_data' end)
  on conflict(event_key) do nothing;
end $$;
revoke all on function public.queue_booking_measurement(
  uuid,text,text,timestamptz,text,integer,text,text
) from public, anon, authenticated;
grant execute on function public.queue_booking_measurement(
  uuid,text,text,timestamptz,text,integer,text,text
) to service_role;

-- A modern website request always has a UUID request key, starts unpaid, and
-- carries no deposit. Legacy checkout/import rows are deliberately excluded.
create or replace function public.queue_booking_request_submitted_measurement()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.request_key is null
    or coalesce(new.payment_status, '') <> 'pending_payment'
    or coalesce(new.deposit_amount, -1) <> 0
    or coalesce(new.status, '') <> 'new' then
    return new;
  end if;
  perform public.queue_booking_measurement(
    new.id,
    'booking_request_submitted',
    'booking:' || new.id::text || ':booking_request_submitted',
    new.created_at
  );
  return new;
end $$;

drop trigger if exists queue_booking_request_submitted_measurement on public.bookings;
create trigger queue_booking_request_submitted_measurement
after insert on public.bookings
for each row execute function public.queue_booking_request_submitted_measurement();

-- Entering offered or confirmed means VVE accepted the request as a genuine
-- opportunity. A confirmation is eligible for advertising measurement only
-- after an authoritative deposit ledger row exists. This keeps after-clean or
-- manually confirmed no-deposit arrangements out of the paid funnel. Unique
-- event keys keep both lifetime milestones single even after later revisions.
create or replace function public.queue_booking_state_measurements()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.state in ('offered','confirmed') then
    perform public.queue_booking_measurement(
      new.booking_id,
      'booking_request_qualified',
      'booking:' || new.booking_id::text || ':booking_request_qualified',
      new.updated_at
    );
  end if;
  if new.state = 'confirmed'
    and old.state is distinct from 'confirmed'
    and exists (
      select 1 from public.booking_journey_payments p
      where p.booking_id = new.booking_id
        and p.kind in ('deposit','manual_deposit')
        and p.amount_pence > 0
    )
  then
    perform public.queue_booking_measurement(
      new.booking_id,
      'booking_confirmed',
      'booking:' || new.booking_id::text || ':booking_confirmed',
      new.updated_at
    );
  end if;
  return new;
end $$;

drop trigger if exists queue_booking_state_measurements on public.booking_journeys;
create trigger queue_booking_state_measurements
after update of state on public.booking_journeys
for each row execute function public.queue_booking_state_measurements();

-- Only an authoritative ledger insert can create deposit_paid. The outbox
-- retains an opaque Stripe session ID; operator-entered bank references remain
-- exclusively in the restricted payment ledger because they may contain PII.
create or replace function public.queue_verified_deposit_measurement()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.kind not in ('deposit','manual_deposit') or new.amount_pence <= 0 then return new; end if;
  if new.kind='deposit'
    and new.external_id !~ '^cs_[A-Za-z0-9_-]{1,196}$' then return new; end if;
  perform public.queue_booking_measurement(
    new.booking_id,
    'deposit_paid',
    'booking:' || new.booking_id::text || ':deposit_paid',
    new.created_at,
    case when new.kind='deposit'
      and new.external_id ~ '^cs_[A-Za-z0-9_-]{1,196}$'
      then new.external_id else null end,
    new.amount_pence,
    new.currency,
    case when new.kind='deposit' then 'stripe_deposit' else 'bank_transfer_deposit' end
  );
  return new;
end $$;

drop trigger if exists queue_verified_deposit_measurement on public.booking_journey_payments;
create trigger queue_verified_deposit_measurement
after insert on public.booking_journey_payments
for each row execute function public.queue_verified_deposit_measurement();

-- Withdrawal is fail-closed before an event leaves VVE: pending/failed/sending
-- rows are suppressed immediately. A submitted row has already been accepted
-- by Data Manager; its later status check sends only the opaque request ID and
-- remains available for truthful reconciliation.
drop function if exists public.withdraw_booking_measurement_consent(uuid);
create function public.withdraw_booking_measurement_consent(p_booking_id uuid)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare
  withdrawn_at timestamptz := now();
  affected integer;
begin
  update public.bookings set measurement_advertising_consent=false,
    measurement_consent_withdrawn_at=withdrawn_at,
    measurement_email_sha256=null,
    measurement_phone_sha256=null
    where id=p_booking_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Measurement booking not found' using errcode = 'P0002';
  end if;
  update public.booking_measurement_outbox set match_data='{}'::jsonb,
    attribution='{}'::jsonb
    where booking_id=p_booking_id;
  update public.booking_measurement_outbox set status='suppressed',
    last_error='consent_withdrawn', claimed_at=null
    where booking_id=p_booking_id and status in ('pending','failed','sending');
  return withdrawn_at;
end $$;
revoke all on function public.withdraw_booking_measurement_consent(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_booking_measurement_consent(uuid) to service_role;

-- Retention: raw campaign attribution is no longer needed after 90 days;
-- delivered/suppressed audit rows are retained for 400 days for reconciliation.
create or replace function public.booking_measurement_retention_origin(
  p_attribution jsonb,
  p_legacy_created_at timestamptz
) returns timestamptz language plpgsql stable
set search_path = pg_catalog as $$
begin
  return coalesce(
    nullif(p_attribution->>'first_touch_at', '')::timestamptz,
    p_legacy_created_at
  );
exception
  when invalid_datetime_format or datetime_field_overflow then
    return p_legacy_created_at;
end $$;
revoke all on function public.booking_measurement_retention_origin(jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.booking_measurement_retention_origin(jsonb,timestamptz)
  to service_role;

create or replace function public.purge_expired_booking_measurement()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.bookings set gclid=null,gbraid=null,wbraid=null,first_source=null,
    last_source=null,utm_source=null,utm_medium=null,utm_campaign=null,
    utm_content=null,utm_term=null,landing_page=null,attribution_first_touch_at=null,
    measurement_email_sha256=null,measurement_phone_sha256=null
    where attribution_first_touch_at is not null
      and attribution_first_touch_at < now() - interval '90 days';
  update public.booking_measurement_outbox set match_data='{}'::jsonb,
    attribution='{}'::jsonb
    where public.booking_measurement_retention_origin(attribution, created_at)
        < now() - interval '90 days'
      and (match_data <> '{}'::jsonb or attribution <> '{}'::jsonb);
  delete from public.booking_measurement_outbox
    where status in ('validated','delivered','suppressed') and created_at < now() - interval '400 days';
end $$;
revoke all on function public.purge_expired_booking_measurement() from public, anon, authenticated;
grant execute on function public.purge_expired_booking_measurement() to service_role;
