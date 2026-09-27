-- VVE Clean booking-request notifications: VVE OS rollback-only validation
-- Generated from 20260924140000_booking_request_notification_outbox.sql SHA-256: 23f96f01768432476938044bfcc283604d8ec62285f0f646ee970f804aa11f45
--
-- SAFETY CONTRACT
-- * Run only in the VVE OS Supabase project (ref spbrstpxrimuuorkbsbo).
-- * Do not run in the live Website project (ref temlphabsqukkiqmrvhl).
-- * Every non-temporary object is created inside a brand-new isolated schema.
-- * No existing/public/vve_os/media table is read or written.
-- * All synthetic data and DDL are rolled back at the end.
-- * This script makes no HTTP request and cannot call email or Telegram providers.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '3s';
set local idle_in_transaction_session_timeout = '60s';

-- Deliberately fail instead of reusing or deleting a pre-existing schema.
create schema vve_notification_test_20260924;
revoke all on schema vve_notification_test_20260924 from public, anon, authenticated;
grant usage on schema vve_notification_test_20260924 to service_role;

-- Minimal synthetic prerequisites. Only columns referenced by the notification
-- migration are present; no production booking, media or payment data is used.
create table vve_notification_test_20260924.bookings (
  id uuid primary key default gen_random_uuid(),
  request_key uuid,
  request_fingerprint text,
  booking_ref text,
  full_name text,
  email text,
  phone text,
  address text,
  postcode text,
  service text,
  preferred_date text,
  preferred_time text,
  notes text,
  total_price numeric,
  payment_status text not null default 'pending_payment',
  deposit_amount numeric not null default 0,
  email_customer_sent boolean not null default false,
  email_business_sent boolean not null default false,
  telegram_sent boolean not null default false
);

create table vve_notification_test_20260924.booking_journey_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references vve_notification_test_20260924.bookings(id) on delete cascade,
  kind text not null
);

-- This eligible-looking record predates the migration. Its continued absence
-- from the outbox proves the migration performs no historical backfill.
insert into vve_notification_test_20260924.bookings (
  id, request_key, request_fingerprint, booking_ref, payment_status,
  deposit_amount
) values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'synthetic-historic-fingerprint', 'TEST-OS-HISTORIC',
  'pending_payment', 0
);

-- BEGIN mechanically schema-isolated repository migration

-- Durable initial website-request notifications. Additive only: this migration
-- creates no rows for existing bookings and does not contact any provider.
create table if not exists vve_notification_test_20260924.booking_request_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references vve_notification_test_20260924.bookings(id) on delete cascade,
  channel text not null check (channel in ('customer_email','business_email','telegram')),
  status text not null default 'pending' check (
    status in ('pending','sending','sent','failed','unconfigured','uncertain')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  claim_token uuid,
  claimed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, channel),
  check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9_.:-]{1,80}$')
);

create index if not exists booking_request_notification_outbox_due
  on vve_notification_test_20260924.booking_request_notification_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed','unconfigured','sending');

alter table vve_notification_test_20260924.booking_request_notification_outbox enable row level security;
revoke all on vve_notification_test_20260924.booking_request_notification_outbox from anon, authenticated;
grant all on vve_notification_test_20260924.booking_request_notification_outbox to service_role;

-- Only website requests committed with the durable request identity qualify.
-- The AFTER INSERT trigger makes the booking row and its three channel jobs one
-- transaction. There is deliberately no historic-data backfill in this file.
create or replace function vve_notification_test_20260924.enqueue_booking_request_notifications()
returns trigger language plpgsql security definer
set search_path = vve_notification_test_20260924, pg_temp as $$
begin
  if new.request_key is not null
    and nullif(new.request_fingerprint, '') is not null
    and coalesce(new.payment_status, '') = 'pending_payment'
    and coalesce(new.deposit_amount, -1) = 0
  then
    insert into vve_notification_test_20260924.booking_request_notification_outbox(
      booking_id, channel, status, sent_at
    )
    select
      new.id,
      queued.channel,
      case
        when queued.channel = 'customer_email' and new.email_customer_sent is true then 'sent'
        when queued.channel = 'business_email' and new.email_business_sent is true then 'sent'
        when queued.channel = 'telegram' and new.telegram_sent is true then 'sent'
        else 'pending'
      end,
      case
        when queued.channel = 'customer_email' and new.email_customer_sent is true then now()
        when queued.channel = 'business_email' and new.email_business_sent is true then now()
        when queued.channel = 'telegram' and new.telegram_sent is true then now()
        else null
      end
    from unnest(array['customer_email','business_email','telegram']) as queued(channel)
    on conflict (booking_id, channel) do nothing;
  end if;
  return new;
end;
$$;

create trigger bookings_enqueue_request_notifications
after insert on vve_notification_test_20260924.bookings
for each row execute function vve_notification_test_20260924.enqueue_booking_request_notifications();

revoke all on function vve_notification_test_20260924.enqueue_booking_request_notifications()
  from public, anon, authenticated;

-- The established CRM can also retry the two initial emails. Fence that path
-- against the website outbox: it waits for an active claim, skips a channel
-- already checkpointed as sent, and otherwise makes the CRM journey message
-- the sole retry owner until its existing legacy flag is set.
create or replace function vve_notification_test_20260924.fence_crm_initial_notification_retry()
returns trigger language plpgsql security definer
set search_path = vve_notification_test_20260924, pg_temp as $$
declare
  outbox_channel text;
  outbox_status text;
begin
  outbox_channel := case new.kind
    when 'initial_customer' then 'customer_email'
    when 'initial_business' then 'business_email'
    else null
  end;
  if outbox_channel is null then return new; end if;

  select o.status into outbox_status
  from vve_notification_test_20260924.booking_request_notification_outbox o
  where o.booking_id = new.booking_id and o.channel = outbox_channel
  for update;
  if not found then return new; end if;
  if outbox_status = 'sent' then return null; end if;
  if outbox_status = 'sending' then
    raise exception 'Initial request notification is already being processed'
      using errcode = '55000';
  end if;

  update vve_notification_test_20260924.booking_request_notification_outbox
  set status = 'uncertain',
      last_error_code = 'crm_initial_retry_owns_delivery',
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  where booking_id = new.booking_id and channel = outbox_channel;
  return new;
end;
$$;

create trigger booking_journey_messages_fence_initial_request_retry
before insert on vve_notification_test_20260924.booking_journey_messages
for each row execute function vve_notification_test_20260924.fence_crm_initial_notification_retry();

revoke all on function vve_notification_test_20260924.fence_crm_initial_notification_retry()
  from public, anon, authenticated;

-- Claiming is service-role only. Legacy flags are reconciled before selection
-- so a CRM retry that already sent an email cannot later be duplicated here.
-- An expired sending lease is ambiguous (the provider may have accepted it),
-- so it is held for review as uncertain rather than silently resent.
create or replace function vve_notification_test_20260924.claim_booking_request_notifications(
  p_booking_id uuid default null,
  p_limit integer default 12
) returns setof jsonb language plpgsql security definer
set search_path = vve_notification_test_20260924, pg_temp as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 30 then
    raise exception 'Invalid notification claim limit';
  end if;

  update vve_notification_test_20260924.booking_request_notification_outbox o
  set status = 'sent',
      sent_at = coalesce(o.sent_at, now()),
      last_error_code = null,
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  from vve_notification_test_20260924.bookings b
  where b.id = o.booking_id
    and (p_booking_id is null or o.booking_id = p_booking_id)
    and o.status <> 'sent'
    and (
      (o.channel = 'customer_email' and b.email_customer_sent is true)
      or (o.channel = 'business_email' and b.email_business_sent is true)
      or (o.channel = 'telegram' and b.telegram_sent is true)
    );

  update vve_notification_test_20260924.booking_request_notification_outbox
  set status = 'uncertain',
      last_error_code = 'claim_expired_after_send_started',
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  where status = 'sending'
    and claimed_until < now()
    and (p_booking_id is null or booking_id = p_booking_id);

  return query
  with candidates as (
    select o.id
    from vve_notification_test_20260924.booking_request_notification_outbox o
    where (p_booking_id is null or o.booking_id = p_booking_id)
      and o.next_attempt_at <= now()
      and (
        o.status in ('pending','unconfigured')
        or (o.status = 'failed' and o.attempts < 5)
      )
    order by o.created_at, o.channel
    for update skip locked
    limit p_limit
  ), claimed as (
    update vve_notification_test_20260924.booking_request_notification_outbox o
    set status = 'sending',
        attempts = o.attempts + 1,
        last_attempt_at = now(),
        claim_token = gen_random_uuid(),
        claimed_until = now() + interval '5 minutes',
        updated_at = clock_timestamp()
    from candidates c
    where o.id = c.id
    returning o.*
  )
  select jsonb_build_object(
    'outbox_id', c.id,
    'booking_id', c.booking_id,
    'channel', c.channel,
    'claim_token', c.claim_token,
    'booking', jsonb_build_object(
      'bookingRef', b.booking_ref,
      'fullName', b.full_name,
      'email', b.email,
      'phone', b.phone,
      'address', b.address,
      'postcode', b.postcode,
      'service', b.service,
      'date', b.preferred_date,
      'time', b.preferred_time,
      'message', b.notes,
      'totalPrice', b.total_price
    )
  )
  from claimed c
  join vve_notification_test_20260924.bookings b on b.id = c.booking_id;
end;
$$;

revoke all on function vve_notification_test_20260924.claim_booking_request_notifications(uuid, integer)
  from public, anon, authenticated;
grant execute on function vve_notification_test_20260924.claim_booking_request_notifications(uuid, integer)
  to service_role;

-- The claim token fences an expired worker. Marking a channel sent and updating
-- its established bookings flag happen in the same transaction.
create or replace function vve_notification_test_20260924.record_booking_request_notification(
  p_id uuid,
  p_token uuid,
  p_status text,
  p_error_code text default null
) returns boolean language plpgsql security definer
set search_path = vve_notification_test_20260924, pg_temp as $$
declare
  claimed_booking_id uuid;
  claimed_channel text;
begin
  if p_status not in ('sent','failed','unconfigured','uncertain')
    or (p_error_code is not null and p_error_code !~ '^[A-Za-z0-9_.:-]{1,80}$')
    or (p_status = 'sent' and p_error_code is not null)
  then
    raise exception 'Invalid notification result';
  end if;

  update vve_notification_test_20260924.booking_request_notification_outbox
  set status = p_status,
      attempts = case
        when p_status = 'unconfigured' then greatest(attempts - 1, 0)
        else attempts
      end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      last_error_code = case when p_status = 'sent' then null else p_error_code end,
      next_attempt_at = case
        when p_status = 'failed' then now() + interval '5 minutes'
        when p_status = 'unconfigured' then now() + interval '15 minutes'
        else now()
      end,
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  where id = p_id
    and claim_token = p_token
    and status = 'sending'
    and claimed_until > now()
  returning booking_id, channel into claimed_booking_id, claimed_channel;

  if not found then return false; end if;

  if p_status = 'sent' then
    update vve_notification_test_20260924.bookings
    set email_customer_sent = case
          when claimed_channel = 'customer_email' then true
          else email_customer_sent
        end,
        email_business_sent = case
          when claimed_channel = 'business_email' then true
          else email_business_sent
        end,
        telegram_sent = case
          when claimed_channel = 'telegram' then true
          else telegram_sent
        end
    where id = claimed_booking_id;
  end if;
  return true;
end;
$$;

revoke all on function vve_notification_test_20260924.record_booking_request_notification(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function vve_notification_test_20260924.record_booking_request_notification(uuid, uuid, text, text)
  to service_role;

-- A stale sender is never retried by automation because provider acceptance is
-- unknown. After checking the destination, an authorised operator can make an
-- explicitly confirmed channel claimable again without changing sent rows.
create or replace function vve_notification_test_20260924.requeue_uncertain_booking_request_notification(
  p_id uuid,
  p_confirm_not_delivered boolean
) returns boolean language plpgsql security definer
set search_path = vve_notification_test_20260924, pg_temp as $$
begin
  if p_confirm_not_delivered is not true then
    raise exception 'Destination check confirmation is required';
  end if;
  update vve_notification_test_20260924.booking_request_notification_outbox
  set status = 'pending',
      attempts = 0,
      next_attempt_at = now(),
      last_error_code = null,
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  where id = p_id and status = 'uncertain';
  return found;
end;
$$;

revoke all on function vve_notification_test_20260924.requeue_uncertain_booking_request_notification(uuid, boolean)
  from public, anon, authenticated;
grant execute on function vve_notification_test_20260924.requeue_uncertain_booking_request_notification(uuid, boolean)
  to service_role;

-- END mechanically schema-isolated repository migration

create temp table vve_notification_assertions (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

insert into vve_notification_assertions
select 'no historic backfill',
       count(*) = 0,
       'historic_outbox_rows=' || count(*)
from vve_notification_test_20260924.booking_request_notification_outbox
where booking_id = '10000000-0000-4000-8000-000000000001';

-- Only a future durable, unpaid website request qualifies.
insert into vve_notification_test_20260924.bookings (
  id, request_key, request_fingerprint, booking_ref, full_name, email, phone,
  address, postcode, service, preferred_date, preferred_time, notes,
  total_price, payment_status, deposit_amount
) values (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'synthetic-eligible-fingerprint', 'TEST-OS-NOTIFICATION',
  'Synthetic Notification Person', 'notification@example.invalid',
  '+447000000001', '2 Synthetic Validation Way', 'ZZ99 9ZZ',
  'Synthetic cleaning', '2026-09-30', '09:00',
  'Synthetic validation only', 125, 'pending_payment', 0
);

insert into vve_notification_assertions
select 'three channel rows for one eligible request',
       count(*) = 3 and count(distinct channel) = 3
         and bool_and(status = 'pending'),
       'rows=' || count(*) || ', channels=' || count(distinct channel)
from vve_notification_test_20260924.booking_request_notification_outbox
where booking_id = '20000000-0000-4000-8000-000000000001';

-- Re-run the trigger's conflict-safe channel insert twice. The unique key must
-- retain exactly one row per booking/channel and preserve existing state.
insert into vve_notification_test_20260924.booking_request_notification_outbox(booking_id, channel)
select '20000000-0000-4000-8000-000000000001', channel
from unnest(array['customer_email','business_email','telegram']) as q(channel)
on conflict (booking_id, channel) do nothing;
insert into vve_notification_test_20260924.booking_request_notification_outbox(booking_id, channel)
select '20000000-0000-4000-8000-000000000001', channel
from unnest(array['customer_email','business_email','telegram']) as q(channel)
on conflict (booking_id, channel) do nothing;

insert into vve_notification_assertions
select 'replay remains unique',
       count(*) = 3 and count(distinct channel) = 3,
       'rows_after_two_replays=' || count(*)
from vve_notification_test_20260924.booking_request_notification_outbox
where booking_id = '20000000-0000-4000-8000-000000000001';

insert into vve_notification_assertions
select 'service-role-only queue and RPC access',
       c.relrowsecurity
         and not has_table_privilege(
           'anon', 'vve_notification_test_20260924.booking_request_notification_outbox', 'select'
         )
         and not has_table_privilege(
           'authenticated', 'vve_notification_test_20260924.booking_request_notification_outbox', 'select'
         )
         and has_table_privilege(
           'service_role', 'vve_notification_test_20260924.booking_request_notification_outbox', 'select'
         )
         and not has_function_privilege(
           'anon', 'vve_notification_test_20260924.claim_booking_request_notifications(uuid,integer)', 'execute'
         )
         and not has_function_privilege(
           'authenticated', 'vve_notification_test_20260924.record_booking_request_notification(uuid,uuid,text,text)', 'execute'
         )
         and has_function_privilege(
           'service_role', 'vve_notification_test_20260924.claim_booking_request_notifications(uuid,integer)', 'execute'
         )
         and has_function_privilege(
           'service_role', 'vve_notification_test_20260924.record_booking_request_notification(uuid,uuid,text,text)', 'execute'
         )
         and has_function_privilege(
           'service_role', 'vve_notification_test_20260924.requeue_uncertain_booking_request_notification(uuid,boolean)', 'execute'
         ),
       'rls=' || c.relrowsecurity::text
         || ', anon_select=' || has_table_privilege(
           'anon', 'vve_notification_test_20260924.booking_request_notification_outbox', 'select'
         )::text
         || ', service_role_select=' || has_table_privilege(
           'service_role', 'vve_notification_test_20260924.booking_request_notification_outbox', 'select'
         )::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'vve_notification_test_20260924'
  and c.relname = 'booking_request_notification_outbox';

create temp table vve_initial_notification_claims as
select vve_notification_test_20260924.claim_booking_request_notifications(
  '20000000-0000-4000-8000-000000000001', 3
) as payload;

insert into vve_notification_assertions
select 'claim returns each channel with a fenced lease',
       count(*) = 3
         and count(distinct payload->>'channel') = 3
         and bool_and(nullif(payload->>'claim_token', '') is not null)
         and bool_and((payload->'booking'->>'bookingRef') = 'TEST-OS-NOTIFICATION'),
       'claimed=' || count(*) || ', channels=' || count(distinct payload->>'channel')
from vve_initial_notification_claims;

insert into vve_notification_assertions
select 'stale checkpoint token is rejected',
       not vve_notification_test_20260924.record_booking_request_notification(
         (payload->>'outbox_id')::uuid,
         'ffffffff-ffff-4fff-8fff-ffffffffffff',
         'sent', null
       ),
       'wrong_token_accepted=false'
from vve_initial_notification_claims
where payload->>'channel' = 'customer_email';

create temp table vve_initial_notification_results as
select payload->>'channel' as channel,
       vve_notification_test_20260924.record_booking_request_notification(
         (payload->>'outbox_id')::uuid,
         (payload->>'claim_token')::uuid,
         case payload->>'channel'
           when 'customer_email' then 'sent'
           when 'business_email' then 'failed'
           else 'unconfigured'
         end,
         case payload->>'channel'
           when 'business_email' then 'smtp_transient'
           when 'telegram' then 'telegram_unconfigured'
           else null
         end
       ) as accepted
from vve_initial_notification_claims;

insert into vve_notification_assertions
select 'checkpoints are atomic and retry-safe',
       count(*) = 3 and bool_and(accepted)
         and (select email_customer_sent from vve_notification_test_20260924.bookings
              where id = '20000000-0000-4000-8000-000000000001')
         and (select count(*) = 1
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'customer_email' and status = 'sent'
                and attempts = 1 and sent_at is not null)
         and (select count(*) = 1
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'business_email' and status = 'failed'
                and attempts = 1 and last_error_code = 'smtp_transient'
                and next_attempt_at > last_attempt_at)
         and (select count(*) = 1
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'telegram' and status = 'unconfigured'
                and attempts = 0
                and last_error_code = 'telegram_unconfigured'),
       'customer=sent, business=failed, telegram=unconfigured'
from vve_initial_notification_results;

-- Make only the two intentionally incomplete channels due, then prove each is
-- claimable again without creating a second channel row.
update vve_notification_test_20260924.booking_request_notification_outbox
set next_attempt_at = now()
where booking_id = '20000000-0000-4000-8000-000000000001'
  and channel in ('business_email', 'telegram');

create temp table vve_notification_retry_claims as
select vve_notification_test_20260924.claim_booking_request_notifications(
  '20000000-0000-4000-8000-000000000001', 3
) as payload;

insert into vve_notification_assertions
select 'failed and unconfigured channels retry independently',
       count(*) = 2
         and count(*) filter (
           where payload->>'channel' = 'business_email'
             and (payload->'booking'->>'bookingRef') = 'TEST-OS-NOTIFICATION'
         ) = 1
         and count(*) filter (
           where payload->>'channel' = 'telegram'
             and (payload->'booking'->>'bookingRef') = 'TEST-OS-NOTIFICATION'
         ) = 1
         and (select attempts = 2
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'business_email')
         and (select attempts = 1
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'telegram'),
       'retry_claims=' || count(*)
from vve_notification_retry_claims;

create temp table vve_notification_retry_results as
select payload->>'channel' as channel,
       vve_notification_test_20260924.record_booking_request_notification(
         (payload->>'outbox_id')::uuid,
         (payload->>'claim_token')::uuid,
         'sent', null
       ) as accepted
from vve_notification_retry_claims;

insert into vve_notification_assertions
select 'successful retries checkpoint all established flags',
       count(*) = 2 and bool_and(accepted)
         and (select count(*) = 3
              from vve_notification_test_20260924.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and status = 'sent')
         and (select email_customer_sent and email_business_sent and telegram_sent
              from vve_notification_test_20260924.bookings
              where id = '20000000-0000-4000-8000-000000000001'),
       'completed_retry_checkpoints=' || count(*)
from vve_notification_retry_results;

-- A completed CRM retry is suppressed by the fence, so it cannot duplicate a
-- channel already checkpointed as sent.
insert into vve_notification_test_20260924.booking_journey_messages(booking_id, kind)
values (
  '20000000-0000-4000-8000-000000000001',
  'initial_customer'
);

insert into vve_notification_assertions
select 'completed CRM replay is suppressed',
       count(*) = 0,
       'journey_messages_inserted=' || count(*)
from vve_notification_test_20260924.booking_journey_messages
where booking_id = '20000000-0000-4000-8000-000000000001'
  and kind = 'initial_customer';

do $vve_notification_results$
declare r record; total integer; failed integer;
begin
  for r in select * from vve_notification_assertions order by check_name loop
    raise notice '% | % | %', case when r.passed then 'PASS' else 'FAIL' end,
      r.check_name, r.detail;
  end loop;
  select count(*), count(*) filter (where not passed)
    into total, failed from vve_notification_assertions;
  raise notice 'VVE OS NOTIFICATION RESULT: % of % checks passed',
    total - failed, total;
  if failed > 0 then
    raise exception 'VVE OS notification validation failed: % of % checks failed',
      failed, total;
  end if;
end
$vve_notification_results$;

select 'PASS — all ' || count(*) ||
       ' isolated booking-request notification checks passed' as overall_result
from vve_notification_assertions;

-- This removes the schema, functions, triggers and every synthetic row above.
rollback;

-- Final visible result for editors that display only the last query.
select case when to_regnamespace('vve_notification_test_20260924') is null
  then 'PASS — notification checks passed and rollback removed the isolated schema'
  else 'FAIL — stop and ask for review; isolated notification schema still exists'
end as rollback_verification;
