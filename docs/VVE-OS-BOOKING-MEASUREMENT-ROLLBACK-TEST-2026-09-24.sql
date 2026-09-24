-- VVE Clean booking measurement: VVE OS rollback-only compatibility test
-- Generated from the five ordered repository migrations listed below.
-- 20260908100000_booking_journey.sql SHA-256: 975eba68558f75cb3d4ead039974f6412c411f39596a0996c1692c9d57cb2657
-- 20260908120000_request_reliability.sql SHA-256: 9caae5a95b305e1937944df6b2456ace1a7fdb95eeb6dc53d8a066d39ea5f100
-- 20260916183000_booking_confirmation_channels.sql SHA-256: 3bb27b1beb18f2a760783d65277046d43ff34b1a8db808e5c76974c7361a1f20
-- 20260917120000_booking_measurement_outbox.sql SHA-256: 08482095a12c67311b11800d232fe569d731ea5217e0d7ba76e99a8ce938979f
-- 20260924120000_booking_measurement_canonical_events.sql SHA-256: 67473ea9c856d92c11c1e4a923b4ea8a1ca94877da7acdb678b3d570667d5aa6
--
-- SAFETY CONTRACT
-- * Run only in the VVE OS Supabase project (ref spbrstpxrimuuorkbsbo).
-- * Do not run in the live Website project (ref temlphabsqukkiqmrvhl).
-- * Every persistent object is created inside a brand-new isolated schema.
-- * No public/vve_os/media table is read or written.
-- * All synthetic data and DDL are rolled back at the end.
-- * This script sends no HTTP request and cannot call Stripe, Google, email or Telegram.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '3s';
set local idle_in_transaction_session_timeout = '60s';

-- Deliberately fail instead of reusing or deleting a pre-existing schema.
create schema vve_measurement_test_20260924;
revoke all on schema vve_measurement_test_20260924 from public, anon, authenticated;
grant usage on schema vve_measurement_test_20260924 to service_role;

-- Minimal synthetic prerequisites for the real measurement migration. They
-- mirror only the columns its functions and triggers depend upon.
create table vve_measurement_test_20260924.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booking_ref text,
  payment_status text not null default 'pending_payment',
  deposit_amount numeric default 0,
  full_name text,
  email text,
  phone text,
  address text,
  postcode text,
  service text,
  preferred_date text,
  preferred_time text,
  service_date date,
  total_price numeric,
  balance_status text,
  balance_paid_at timestamptz,
  balance_payment_method text,
  status text,
  first_source text,
  last_source text,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  gclid text
);

-- BEGIN mechanically schema-isolated repository migrations

-- BEGIN 20260908100000_booking_journey.sql
-- Apply to a test database first. No existing customer/payment rows are changed.
create table if not exists vve_measurement_test_20260924.booking_journeys (
  booking_id uuid primary key references vve_measurement_test_20260924.bookings (id),
  revision integer not null default 0,
  offer_version integer not null default 0,
  state text not null default 'draft' check (
    state in (
      'draft',
      'offered',
      'change_pending',
      'confirmed',
      'expired',
      'cancelled',
      'completed',
      'payment_review'
    )
  ),
  draft jsonb not null default '{}',
  snapshot jsonb,
  previous_snapshot jsonb,
  token_generation uuid not null default gen_random_uuid(),
  token_expires_at timestamptz not null default (now() + interval '1 year'),
  hold_until timestamptz,
  reminder_sent_at timestamptz,
  checkout_id text,
  checkout_kind text,
  checkout_creating_at timestamptz,
  paid_pence integer not null default 0 check (paid_pence >= 0),
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  customer_request jsonb,
  updated_at timestamptz not null default now()
);

alter table vve_measurement_test_20260924.booking_journeys
add column if not exists reminder_sent_at timestamptz;

alter table vve_measurement_test_20260924.booking_journeys
add column if not exists appointment_reminder_sent_at timestamptz;

create table if not exists vve_measurement_test_20260924.booking_journey_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references vve_measurement_test_20260924.bookings (id),
  revision integer not null,
  actor text not null,
  event_type text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists vve_measurement_test_20260924.booking_journey_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references vve_measurement_test_20260924.bookings (id),
  dedup_key text unique not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'sending',
      'sent',
      'failed',
      'suppressed'
    )
  ),
  attempts integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists vve_measurement_test_20260924.booking_journey_payments (
  external_id text primary key,
  booking_id uuid not null references vve_measurement_test_20260924.bookings (id),
  kind text not null,
  amount_pence integer not null,
  currency text not null check (currency = 'gbp'),
  created_at timestamptz not null default now()
);

create index if not exists booking_journey_messages_due on vve_measurement_test_20260924.booking_journey_messages (status, created_at);

create index if not exists booking_journey_holds_due on vve_measurement_test_20260924.booking_journeys (hold_until)
where
  state = 'offered';

alter table vve_measurement_test_20260924.booking_journeys enable row level security;

alter table vve_measurement_test_20260924.booking_journey_events enable row level security;

alter table vve_measurement_test_20260924.booking_journey_messages enable row level security;

alter table vve_measurement_test_20260924.booking_journey_payments enable row level security;

revoke all on vve_measurement_test_20260924.booking_journeys,
vve_measurement_test_20260924.booking_journey_events,
vve_measurement_test_20260924.booking_journey_messages,
vve_measurement_test_20260924.booking_journey_payments
from
  anon,
  authenticated;

grant all on vve_measurement_test_20260924.booking_journeys,
vve_measurement_test_20260924.booking_journey_events,
vve_measurement_test_20260924.booking_journey_messages,
vve_measurement_test_20260924.booking_journey_payments to service_role;

grant usage,
select
  on sequence vve_measurement_test_20260924.booking_journey_events_id_seq to service_role;

-- One transaction owns the revision, immutable history, payment ledger and outbox.
-- Only trusted server code can call this; browsers have no execute permission.
create or replace function vve_measurement_test_20260924.apply_booking_journey (
  p_booking_id uuid,
  p_revision integer,
  p_actor text,
  p_event text,
  p_patch jsonb default '{}',
  p_booking_patch jsonb default '{}',
  p_message jsonb default null,
  p_payment jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = vve_measurement_test_20260924 as $$
declare j vve_measurement_test_20260924.booking_journeys; next_row vve_measurement_test_20260924.booking_journeys; affected integer;
begin
 select * into j from vve_measurement_test_20260924.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(select 1 from vve_measurement_test_20260924.booking_journey_payments where external_id = p_payment->>'external_id') then return to_jsonb(j); end if;
 if j.revision <> p_revision then raise exception 'Booking changed; reload before trying again' using errcode = '40001'; end if;
 if p_payment is not null then
   insert into vve_measurement_test_20260924.booking_journey_payments(external_id,booking_id,kind,amount_pence,currency)
   values(p_payment->>'external_id',p_booking_id,p_payment->>'kind',(p_payment->>'amount_pence')::integer,'gbp');
 end if;
 next_row := jsonb_populate_record(j, p_patch - 'booking_id' - 'revision' - 'updated_at');
 update vve_measurement_test_20260924.booking_journeys set revision=j.revision+1, offer_version=next_row.offer_version,
 state=next_row.state,draft=next_row.draft,snapshot=next_row.snapshot,previous_snapshot=next_row.previous_snapshot,
 token_generation=next_row.token_generation,token_expires_at=next_row.token_expires_at,hold_until=next_row.hold_until,
 reminder_sent_at=next_row.reminder_sent_at,
 appointment_reminder_sent_at=next_row.appointment_reminder_sent_at,
 checkout_id=next_row.checkout_id,checkout_kind=next_row.checkout_kind,checkout_creating_at=next_row.checkout_creating_at,
 paid_pence=next_row.paid_pence,refunded_pence=next_row.refunded_pence,customer_request=next_row.customer_request,updated_at=now()
 where booking_id=p_booking_id returning * into j;
 if p_booking_patch <> '{}'::jsonb then
   update vve_measurement_test_20260924.bookings set
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
 insert into vve_measurement_test_20260924.booking_journey_events(booking_id,revision,actor,event_type,details)
 values(p_booking_id,j.revision,p_actor,p_event,jsonb_build_object('changes',p_patch,'booking_changes',p_booking_patch));
 if p_message is not null then
   insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload') on conflict(dedup_key) do nothing;
   if p_message->>'kind' in ('reschedule_received','cancelled','payment_review') then
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business')) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function vve_measurement_test_20260924.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from
  public,
  anon,
  authenticated;

grant
execute on function vve_measurement_test_20260924.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
-- END 20260908100000_booking_journey.sql

-- BEGIN 20260908120000_request_reliability.sql
-- Additive only. Apply in an isolated test database before an approved release.
alter table vve_measurement_test_20260924.bookings add column if not exists request_key uuid;
alter table vve_measurement_test_20260924.bookings add column if not exists request_fingerprint text;
create unique index if not exists bookings_request_key_unique on vve_measurement_test_20260924.bookings(request_key) where request_key is not null;

create table if not exists vve_measurement_test_20260924.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  request_fingerprint text not null,
  full_name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  source_page text,
  marketing_opt_in boolean not null default false,
  attribution jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  delivery jsonb not null default '{}'::jsonb,
  delivery_claim_until timestamptz,
  delivery_claim_token uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table vve_measurement_test_20260924.contact_enquiries enable row level security;
revoke all on vve_measurement_test_20260924.contact_enquiries from anon, authenticated;
grant all on vve_measurement_test_20260924.contact_enquiries to service_role;

-- The token fences a worker whose lease expired; returning the row from the
-- claim prevents an older CRM snapshot from resending completed channels.
alter table vve_measurement_test_20260924.contact_enquiries add column if not exists delivery_claim_token uuid;
drop function if exists vve_measurement_test_20260924.claim_enquiry_delivery(uuid);
create function vve_measurement_test_20260924.claim_enquiry_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
declare claimed vve_measurement_test_20260924.contact_enquiries;
begin
  update vve_measurement_test_20260924.contact_enquiries
    set delivery_claim_until = now() + interval '2 minutes', delivery_claim_token = gen_random_uuid()
    where id = p_id and (delivery_claim_until is null or delivery_claim_until < now())
    returning * into claimed;
  if not found then return null; end if;
  return to_jsonb(claimed);
end;
$$;
revoke all on function vve_measurement_test_20260924.claim_enquiry_delivery(uuid) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.claim_enquiry_delivery(uuid) to service_role;

create or replace function vve_measurement_test_20260924.record_enquiry_delivery(p_id uuid, p_token uuid, p_channel text, p_result jsonb) returns boolean
language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  if p_channel is null or p_channel not in ('sheet','telegram','businessEmail','customerEmail')
    or p_result is null or jsonb_typeof(p_result) <> 'object'
    or coalesce(p_result->>'status','') not in ('sending','sent','failed','unconfigured')
    or octet_length(p_result::text) > 2000 then
    raise exception 'Invalid delivery result';
  end if;
  update vve_measurement_test_20260924.contact_enquiries
    set delivery = jsonb_set(delivery, array[p_channel], p_result), updated_at = clock_timestamp()
    where id = p_id and delivery_claim_token = p_token and delivery_claim_until > now();
  return found;
end;
$$;
revoke all on function vve_measurement_test_20260924.record_enquiry_delivery(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.record_enquiry_delivery(uuid,uuid,text,jsonb) to service_role;

create or replace function vve_measurement_test_20260924.finish_enquiry_delivery(p_id uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
declare result jsonb;
begin
  update vve_measurement_test_20260924.contact_enquiries set delivery_claim_until = null, delivery_claim_token = null
    where id = p_id and delivery_claim_token = p_token returning delivery into result;
  return result;
end;
$$;
revoke all on function vve_measurement_test_20260924.finish_enquiry_delivery(uuid,uuid) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.finish_enquiry_delivery(uuid,uuid) to service_role;
-- END 20260908120000_request_reliability.sql

-- BEGIN 20260916183000_booking_confirmation_channels.sql
-- Apply after the booking journey migration. Adds independent, retryable owner and calendar deliveries.
-- Does not rewrite existing bookings, payments or messages.
create or replace function vve_measurement_test_20260924.apply_booking_journey (
  p_booking_id uuid,
  p_revision integer,
  p_actor text,
  p_event text,
  p_patch jsonb default '{}',
  p_booking_patch jsonb default '{}',
  p_message jsonb default null,
  p_payment jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = vve_measurement_test_20260924 as $$
declare j vve_measurement_test_20260924.booking_journeys; next_row vve_measurement_test_20260924.booking_journeys; affected integer;
begin
 select * into j from vve_measurement_test_20260924.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(select 1 from vve_measurement_test_20260924.booking_journey_payments where external_id = p_payment->>'external_id') then return to_jsonb(j); end if;
 if j.revision <> p_revision then raise exception 'Booking changed; reload before trying again' using errcode = '40001'; end if;
 if p_payment is not null then
   insert into vve_measurement_test_20260924.booking_journey_payments(external_id,booking_id,kind,amount_pence,currency)
   values(p_payment->>'external_id',p_booking_id,p_payment->>'kind',(p_payment->>'amount_pence')::integer,'gbp');
 end if;
 next_row := jsonb_populate_record(j, p_patch - 'booking_id' - 'revision' - 'updated_at');
 update vve_measurement_test_20260924.booking_journeys set revision=j.revision+1, offer_version=next_row.offer_version,
 state=next_row.state,draft=next_row.draft,snapshot=next_row.snapshot,previous_snapshot=next_row.previous_snapshot,
 token_generation=next_row.token_generation,token_expires_at=next_row.token_expires_at,hold_until=next_row.hold_until,
 reminder_sent_at=next_row.reminder_sent_at,
 appointment_reminder_sent_at=next_row.appointment_reminder_sent_at,
 checkout_id=next_row.checkout_id,checkout_kind=next_row.checkout_kind,checkout_creating_at=next_row.checkout_creating_at,
 paid_pence=next_row.paid_pence,refunded_pence=next_row.refunded_pence,customer_request=next_row.customer_request,updated_at=now()
 where booking_id=p_booking_id returning * into j;
 if p_booking_patch <> '{}'::jsonb then
   update vve_measurement_test_20260924.bookings set
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
 insert into vve_measurement_test_20260924.booking_journey_events(booking_id,revision,actor,event_type,details)
 values(p_booking_id,j.revision,p_actor,p_event,jsonb_build_object('changes',p_patch,'booking_changes',p_booking_patch));
 if p_message is not null then
   insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload') on conflict(dedup_key) do nothing;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','reschedule_received','cancellation_requested','cancelled','payment_review') then
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business')) on conflict(dedup_key) do nothing;
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':telegram',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business','channel','telegram')) on conflict(dedup_key) do nothing;
   end if;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','cancelled') then
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':calendar','calendar_sync',(p_message->'payload')||jsonb_build_object('audience','business','channel','calendar')) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function vve_measurement_test_20260924.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from
  public,
  anon,
  authenticated;

grant
execute on function vve_measurement_test_20260924.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
-- END 20260916183000_booking_confirmation_channels.sql

-- BEGIN 20260917120000_booking_measurement_outbox.sql
-- Apply to an isolated test project first. This migration does not backfill or
-- rewrite historic bookings/payments and does not contact Google.
alter table vve_measurement_test_20260924.bookings add column if not exists utm_term text;
alter table vve_measurement_test_20260924.bookings add column if not exists gbraid text;
alter table vve_measurement_test_20260924.bookings add column if not exists wbraid text;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_advertising_consent boolean not null default false;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_version text;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_recorded_at timestamptz;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_withdrawn_at timestamptz;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_is_test boolean not null default false;

create table if not exists vve_measurement_test_20260924.booking_measurement_outbox (
  id uuid primary key default gen_random_uuid(),
  payment_external_id text unique not null references vve_measurement_test_20260924.booking_journey_payments(external_id),
  booking_id uuid not null references vve_measurement_test_20260924.bookings(id),
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
  on vve_measurement_test_20260924.booking_measurement_outbox(status, created_at)
  where status in ('pending','failed','sending');

alter table vve_measurement_test_20260924.booking_measurement_outbox enable row level security;
revoke all on vve_measurement_test_20260924.booking_measurement_outbox from anon, authenticated;
grant all on vve_measurement_test_20260924.booking_measurement_outbox to service_role;

create or replace function vve_measurement_test_20260924.claim_booking_measurements(p_limit integer default 10)
returns setof vve_measurement_test_20260924.booking_measurement_outbox language plpgsql security definer
set search_path = vve_measurement_test_20260924 as $$
begin
  return query
  with due as (
    select id from vve_measurement_test_20260924.booking_measurement_outbox
    where (
      status in ('pending','failed')
      or (status = 'sending' and claimed_at < now() - interval '10 minutes')
    ) and attempts < 8
    order by created_at for update skip locked limit least(greatest(p_limit,1),25)
  )
  update vve_measurement_test_20260924.booking_measurement_outbox o set status='sending',
    attempts=o.attempts+1, claimed_at=now(), last_error=null
  from due where o.id=due.id returning o.*;
end $$;
revoke all on function vve_measurement_test_20260924.claim_booking_measurements(integer) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.claim_booking_measurements(integer) to service_role;

create or replace function vve_measurement_test_20260924.queue_verified_deposit_measurement()
returns trigger language plpgsql security definer set search_path = vve_measurement_test_20260924 as $$
declare b vve_measurement_test_20260924.bookings; allowed boolean; attrs jsonb; consent_snapshot jsonb;
begin
  if new.kind not in ('deposit','manual_deposit') or new.amount_pence <= 0 then return new; end if;
  select * into b from vve_measurement_test_20260924.bookings where id = new.booking_id;
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
  insert into vve_measurement_test_20260924.booking_measurement_outbox(
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

drop trigger if exists queue_verified_deposit_measurement on vve_measurement_test_20260924.booking_journey_payments;
create trigger queue_verified_deposit_measurement
after insert on vve_measurement_test_20260924.booking_journey_payments
for each row execute function vve_measurement_test_20260924.queue_verified_deposit_measurement();

-- Withdrawal is fail-closed: pending/failed records are suppressed immediately.
create or replace function vve_measurement_test_20260924.withdraw_booking_measurement_consent(p_booking_id uuid)
returns void language plpgsql security definer set search_path = vve_measurement_test_20260924 as $$
begin
  update vve_measurement_test_20260924.bookings set measurement_advertising_consent=false,
    measurement_consent_withdrawn_at=now() where id=p_booking_id;
  update vve_measurement_test_20260924.booking_measurement_outbox set status='suppressed',
    last_error='consent_withdrawn', claimed_at=null
    where booking_id=p_booking_id and status in ('pending','failed','sending');
end $$;
revoke all on function vve_measurement_test_20260924.withdraw_booking_measurement_consent(uuid) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.withdraw_booking_measurement_consent(uuid) to service_role;

-- Retention: raw campaign attribution is no longer needed after 90 days;
-- delivered/suppressed audit rows are retained for 400 days for reconciliation.
create or replace function vve_measurement_test_20260924.purge_expired_booking_measurement()
returns void language plpgsql security definer set search_path = vve_measurement_test_20260924 as $$
begin
  update vve_measurement_test_20260924.bookings set gclid=null,gbraid=null,wbraid=null,utm_source=null,
    utm_medium=null,utm_campaign=null,utm_content=null,utm_term=null,landing_page=null
    where measurement_consent_recorded_at < now() - interval '90 days';
  delete from vve_measurement_test_20260924.booking_measurement_outbox
    where status in ('delivered','suppressed') and created_at < now() - interval '400 days';
end $$;
revoke all on function vve_measurement_test_20260924.purge_expired_booking_measurement() from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.purge_expired_booking_measurement() to service_role;
-- END 20260917120000_booking_measurement_outbox.sql

-- BEGIN 20260924120000_booking_measurement_canonical_events.sql
-- Additive upgrade from the immutable 20260917120000 deposit-only outbox.
-- Existing outbox rows and their values are deliberately left unchanged. New
-- rows use canonical_event_version=2 and the provider-neutral event contract.
-- This migration does not backfill bookings/payments or contact a provider.
alter table vve_measurement_test_20260924.bookings add column if not exists utm_term text;
alter table vve_measurement_test_20260924.bookings add column if not exists gbraid text;
alter table vve_measurement_test_20260924.bookings add column if not exists wbraid text;
alter table vve_measurement_test_20260924.bookings add column if not exists attribution_first_touch_at timestamptz;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_advertising_consent boolean not null default false;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_version text;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_recorded_at timestamptz;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_consent_withdrawn_at timestamptz;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_is_test boolean not null default false;
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_email_sha256 text
  check (measurement_email_sha256 is null or measurement_email_sha256 ~ '^[0-9a-f]{64}$');
alter table vve_measurement_test_20260924.bookings add column if not exists measurement_phone_sha256 text
  check (measurement_phone_sha256 is null or measurement_phone_sha256 ~ '^[0-9a-f]{64}$');

-- Extend the already-created outbox in place. The legacy paid_at column stays
-- available for old rows; canonical rows use occurred_at. Nullable legacy-only
-- values are intentional and are handled by the delivery compatibility layer.
alter table vve_measurement_test_20260924.booking_measurement_outbox
  add column if not exists event_key text,
  add column if not exists occurred_at timestamptz,
  add column if not exists match_data jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists status_checks integer not null default 0,
  add column if not exists canonical_event_version smallint;

-- Adding the default after the nullable column preserves a NULL version on
-- every historical deposit-only row while making every future row version 2.
alter table vve_measurement_test_20260924.booking_measurement_outbox
  alter column canonical_event_version set default 2,
  alter column payment_external_id drop not null,
  alter column amount_pence drop not null,
  alter column currency drop not null,
  alter column payment_type drop not null,
  alter column paid_at drop not null,
  alter column provider set default 'google_data_manager';

-- Replace only the constraints whose allowed values expand in version 2.
-- Historical rows remain valid and retain the original provider and fields.
alter table vve_measurement_test_20260924.booking_measurement_outbox
  drop constraint if exists booking_measurement_outbox_event_name_check,
  drop constraint if exists booking_measurement_outbox_provider_check,
  drop constraint if exists booking_measurement_outbox_status_check,
  drop constraint if exists booking_measurement_outbox_canonical_row_check;

alter table vve_measurement_test_20260924.booking_measurement_outbox
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
  on vve_measurement_test_20260924.booking_measurement_outbox(event_key);

drop index if exists vve_measurement_test_20260924.booking_measurement_outbox_due;
create index if not exists booking_measurement_outbox_due
  on vve_measurement_test_20260924.booking_measurement_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed','sending','submitted');

alter table vve_measurement_test_20260924.booking_measurement_outbox enable row level security;
revoke all on vve_measurement_test_20260924.booking_measurement_outbox from anon, authenticated;
grant all on vve_measurement_test_20260924.booking_measurement_outbox to service_role;

-- Preserve the latest booking journey behaviour while allowing a verified
-- payment provider/owner action to supply when the payment actually occurred.
-- Missing or malformed timestamps safely fall back to the transaction time.
create or replace function vve_measurement_test_20260924.apply_booking_journey (
  p_booking_id uuid,
  p_revision integer,
  p_actor text,
  p_event text,
  p_patch jsonb default '{}',
  p_booking_patch jsonb default '{}',
  p_message jsonb default null,
  p_payment jsonb default null
) returns jsonb language plpgsql security definer
set search_path = vve_measurement_test_20260924, pg_temp as $$
declare
  j vve_measurement_test_20260924.booking_journeys;
  next_row vve_measurement_test_20260924.booking_journeys;
  affected integer;
  payment_occurred_at timestamptz;
begin
 select * into j from vve_measurement_test_20260924.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(
   select 1 from vve_measurement_test_20260924.booking_journey_payments
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
   insert into vve_measurement_test_20260924.booking_journey_payments(
     external_id,booking_id,kind,amount_pence,currency,created_at
   ) values(
     p_payment->>'external_id',p_booking_id,p_payment->>'kind',
     (p_payment->>'amount_pence')::integer,'gbp',payment_occurred_at
   );
 end if;
 next_row := jsonb_populate_record(j, p_patch - 'booking_id' - 'revision' - 'updated_at');
 update vve_measurement_test_20260924.booking_journeys set revision=j.revision+1, offer_version=next_row.offer_version,
 state=next_row.state,draft=next_row.draft,snapshot=next_row.snapshot,previous_snapshot=next_row.previous_snapshot,
 token_generation=next_row.token_generation,token_expires_at=next_row.token_expires_at,hold_until=next_row.hold_until,
 reminder_sent_at=next_row.reminder_sent_at,
 appointment_reminder_sent_at=next_row.appointment_reminder_sent_at,
 checkout_id=next_row.checkout_id,checkout_kind=next_row.checkout_kind,checkout_creating_at=next_row.checkout_creating_at,
 paid_pence=next_row.paid_pence,refunded_pence=next_row.refunded_pence,customer_request=next_row.customer_request,updated_at=now()
 where booking_id=p_booking_id returning * into j;
 if p_booking_patch <> '{}'::jsonb then
   update vve_measurement_test_20260924.bookings set
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
 insert into vve_measurement_test_20260924.booking_journey_events(booking_id,revision,actor,event_type,details)
 values(p_booking_id,j.revision,p_actor,p_event,jsonb_build_object('changes',p_patch,'booking_changes',p_booking_patch));
 if p_message is not null then
   insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload')
   on conflict(dedup_key) do nothing;
   if p_message->>'kind' in (
     'confirmation','revised_confirmation','receipt','reschedule_received',
     'cancellation_requested','cancelled','payment_review'
   ) then
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',
       (p_message->'payload')||jsonb_build_object('audience','business')
     ) on conflict(dedup_key) do nothing;
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':telegram',p_message->>'kind',
       (p_message->'payload')||jsonb_build_object('audience','business','channel','telegram')
     ) on conflict(dedup_key) do nothing;
   end if;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','cancelled') then
     insert into vve_measurement_test_20260924.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(
       p_booking_id,(p_message->>'dedup_key')||':calendar','calendar_sync',
       (p_message->'payload')||jsonb_build_object('audience','business','channel','calendar')
     ) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function vve_measurement_test_20260924.apply_booking_journey(
  uuid,integer,text,text,jsonb,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.apply_booking_journey(
  uuid,integer,text,text,jsonb,jsonb,jsonb,jsonb
) to service_role;

create or replace function vve_measurement_test_20260924.claim_booking_measurements(p_limit integer default 10)
returns setof vve_measurement_test_20260924.booking_measurement_outbox language plpgsql security definer
set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  return query
  with due as (
    select id,status from vve_measurement_test_20260924.booking_measurement_outbox
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
  update vve_measurement_test_20260924.booking_measurement_outbox o set
    status=case when due.status='submitted' then 'submitted' else 'sending' end,
    attempts=o.attempts+case when due.status='submitted' then 0 else 1 end,
    status_checks=o.status_checks+case when due.status='submitted' then 1 else 0 end,
    claimed_at=now(),
    last_error=case when due.status='submitted' then o.last_error else null end
  from due where o.id=due.id returning o.*;
end $$;
revoke all on function vve_measurement_test_20260924.claim_booking_measurements(integer) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.claim_booking_measurements(integer) to service_role;

-- Snapshot only non-personal campaign and consent fields. Ineligible events
-- remain visible for reconciliation but can never be claimed for delivery.
create or replace function vve_measurement_test_20260924.queue_booking_measurement(
  p_booking_id uuid,
  p_event_name text,
  p_event_key text,
  p_occurred_at timestamptz,
  p_payment_external_id text default null,
  p_amount_pence integer default null,
  p_currency text default null,
  p_payment_type text default null
) returns void language plpgsql security definer
set search_path = vve_measurement_test_20260924, pg_temp as $$
declare
  b vve_measurement_test_20260924.bookings;
  allowed boolean;
  attrs jsonb;
  consent_snapshot jsonb;
  match_snapshot jsonb;
begin
  select * into b from vve_measurement_test_20260924.bookings where id = p_booking_id;
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

  insert into vve_measurement_test_20260924.booking_measurement_outbox(
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
revoke all on function vve_measurement_test_20260924.queue_booking_measurement(
  uuid,text,text,timestamptz,text,integer,text,text
) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.queue_booking_measurement(
  uuid,text,text,timestamptz,text,integer,text,text
) to service_role;

-- A modern website request always has a UUID request key, starts unpaid, and
-- carries no deposit. Legacy checkout/import rows are deliberately excluded.
create or replace function vve_measurement_test_20260924.queue_booking_request_submitted_measurement()
returns trigger language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  if new.request_key is null
    or coalesce(new.payment_status, '') <> 'pending_payment'
    or coalesce(new.deposit_amount, -1) <> 0
    or coalesce(new.status, '') <> 'new' then
    return new;
  end if;
  perform vve_measurement_test_20260924.queue_booking_measurement(
    new.id,
    'booking_request_submitted',
    'booking:' || new.id::text || ':booking_request_submitted',
    new.created_at
  );
  return new;
end $$;

drop trigger if exists queue_booking_request_submitted_measurement on vve_measurement_test_20260924.bookings;
create trigger queue_booking_request_submitted_measurement
after insert on vve_measurement_test_20260924.bookings
for each row execute function vve_measurement_test_20260924.queue_booking_request_submitted_measurement();

-- Entering offered or confirmed means VVE accepted the request as a genuine
-- opportunity. A confirmation is eligible for advertising measurement only
-- after an authoritative deposit ledger row exists. This keeps after-clean or
-- manually confirmed no-deposit arrangements out of the paid funnel. Unique
-- event keys keep both lifetime milestones single even after later revisions.
create or replace function vve_measurement_test_20260924.queue_booking_state_measurements()
returns trigger language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  if new.state in ('offered','confirmed') then
    perform vve_measurement_test_20260924.queue_booking_measurement(
      new.booking_id,
      'booking_request_qualified',
      'booking:' || new.booking_id::text || ':booking_request_qualified',
      new.updated_at
    );
  end if;
  if new.state = 'confirmed'
    and old.state is distinct from 'confirmed'
    and exists (
      select 1 from vve_measurement_test_20260924.booking_journey_payments p
      where p.booking_id = new.booking_id
        and p.kind in ('deposit','manual_deposit')
        and p.amount_pence > 0
    )
  then
    perform vve_measurement_test_20260924.queue_booking_measurement(
      new.booking_id,
      'booking_confirmed',
      'booking:' || new.booking_id::text || ':booking_confirmed',
      new.updated_at
    );
  end if;
  return new;
end $$;

drop trigger if exists queue_booking_state_measurements on vve_measurement_test_20260924.booking_journeys;
create trigger queue_booking_state_measurements
after update of state on vve_measurement_test_20260924.booking_journeys
for each row execute function vve_measurement_test_20260924.queue_booking_state_measurements();

-- Only an authoritative ledger insert can create deposit_paid. The outbox
-- retains an opaque Stripe session ID; operator-entered bank references remain
-- exclusively in the restricted payment ledger because they may contain PII.
create or replace function vve_measurement_test_20260924.queue_verified_deposit_measurement()
returns trigger language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  if new.kind not in ('deposit','manual_deposit') or new.amount_pence <= 0 then return new; end if;
  if new.kind='deposit'
    and new.external_id !~ '^cs_[A-Za-z0-9_-]{1,196}$' then return new; end if;
  perform vve_measurement_test_20260924.queue_booking_measurement(
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

drop trigger if exists queue_verified_deposit_measurement on vve_measurement_test_20260924.booking_journey_payments;
create trigger queue_verified_deposit_measurement
after insert on vve_measurement_test_20260924.booking_journey_payments
for each row execute function vve_measurement_test_20260924.queue_verified_deposit_measurement();

-- Withdrawal is fail-closed before an event leaves VVE: pending/failed/sending
-- rows are suppressed immediately. A submitted row has already been accepted
-- by Data Manager; its later status check sends only the opaque request ID and
-- remains available for truthful reconciliation.
drop function if exists vve_measurement_test_20260924.withdraw_booking_measurement_consent(uuid);
create function vve_measurement_test_20260924.withdraw_booking_measurement_consent(p_booking_id uuid)
returns timestamptz language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
declare
  withdrawn_at timestamptz := now();
  affected integer;
begin
  update vve_measurement_test_20260924.bookings set measurement_advertising_consent=false,
    measurement_consent_withdrawn_at=withdrawn_at,
    measurement_email_sha256=null,
    measurement_phone_sha256=null
    where id=p_booking_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Measurement booking not found' using errcode = 'P0002';
  end if;
  update vve_measurement_test_20260924.booking_measurement_outbox set match_data='{}'::jsonb,
    attribution='{}'::jsonb
    where booking_id=p_booking_id;
  update vve_measurement_test_20260924.booking_measurement_outbox set status='suppressed',
    last_error='consent_withdrawn', claimed_at=null
    where booking_id=p_booking_id and status in ('pending','failed','sending');
  return withdrawn_at;
end $$;
revoke all on function vve_measurement_test_20260924.withdraw_booking_measurement_consent(uuid) from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.withdraw_booking_measurement_consent(uuid) to service_role;

-- Retention: raw campaign attribution is no longer needed after 90 days;
-- delivered/suppressed audit rows are retained for 400 days for reconciliation.
create or replace function vve_measurement_test_20260924.booking_measurement_retention_origin(
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
revoke all on function vve_measurement_test_20260924.booking_measurement_retention_origin(jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.booking_measurement_retention_origin(jsonb,timestamptz)
  to service_role;

create or replace function vve_measurement_test_20260924.purge_expired_booking_measurement()
returns void language plpgsql security definer set search_path = vve_measurement_test_20260924, pg_temp as $$
begin
  update vve_measurement_test_20260924.bookings set gclid=null,gbraid=null,wbraid=null,first_source=null,
    last_source=null,utm_source=null,utm_medium=null,utm_campaign=null,
    utm_content=null,utm_term=null,landing_page=null,attribution_first_touch_at=null,
    measurement_email_sha256=null,measurement_phone_sha256=null
    where attribution_first_touch_at is not null
      and attribution_first_touch_at < now() - interval '90 days';
  update vve_measurement_test_20260924.booking_measurement_outbox set match_data='{}'::jsonb,
    attribution='{}'::jsonb
    where vve_measurement_test_20260924.booking_measurement_retention_origin(attribution, created_at)
        < now() - interval '90 days'
      and (match_data <> '{}'::jsonb or attribution <> '{}'::jsonb);
  delete from vve_measurement_test_20260924.booking_measurement_outbox
    where status in ('validated','delivered','suppressed') and created_at < now() - interval '400 days';
end $$;
revoke all on function vve_measurement_test_20260924.purge_expired_booking_measurement() from public, anon, authenticated;
grant execute on function vve_measurement_test_20260924.purge_expired_booking_measurement() to service_role;
-- END 20260924120000_booking_measurement_canonical_events.sql

-- END mechanically schema-isolated repository migrations

create temp table vve_measurement_assertions (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

-- Synthetic eligible ad-attributed request. The fake contact values exist only
-- to prove that raw customer data cannot enter the measurement outbox.
insert into vve_measurement_test_20260924.bookings (
  id, request_key, booking_ref, created_at, full_name, email, phone, address,
  postcode, service, payment_status, deposit_amount, status,
  first_source, last_source, landing_page, utm_source, utm_medium,
  utm_campaign, utm_content, utm_term, gclid, attribution_first_touch_at,
  measurement_advertising_consent, measurement_consent_version,
  measurement_consent_recorded_at, measurement_is_test,
  measurement_email_sha256, measurement_phone_sha256
) values (
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111112',
  'TEST-OS-ELIGIBLE', '2026-09-24 12:00:00+00',
  'Synthetic Measurement Person', 'measurement@example.invalid',
  '+447000000000', '1 Synthetic Validation Way', 'ZZ99 9ZZ',
  'Synthetic cleaning', 'pending_payment', 0, 'new',
  'google-ads', 'google-ads', '/synthetic-test', 'google', 'cpc',
  'synthetic-campaign', 'synthetic-content', 'synthetic-term',
  'synthetic-click-id', '2026-09-24 12:00:00+00', true,
  '2026-09-24', '2026-09-24 12:00:00+00', false,
  repeat('a', 64), repeat('b', 64)
);

insert into vve_measurement_test_20260924.booking_journeys(booking_id)
values ('11111111-1111-4111-8111-111111111111');

select vve_measurement_test_20260924.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  0, 'synthetic-os-validation', 'offer_sent',
  '{"state":"offered"}'::jsonb, '{}'::jsonb, null, null
);

select vve_measurement_test_20260924.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  1, 'synthetic-os-validation', 'stripe_deposit_received',
  '{"state":"confirmed","paid_pence":4700}'::jsonb,
  '{"status":"confirmed","payment_status":"paid","deposit_amount":47}'::jsonb,
  null,
  '{"external_id":"cs_synthetic_vve_os_measurement","kind":"deposit","amount_pence":4700}'::jsonb
);

-- Replay the same provider payment. The restricted ledger and journey function
-- must recognize it before attempting another state transition.
select vve_measurement_test_20260924.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  1, 'synthetic-os-validation', 'stripe_webhook_replay',
  '{"state":"confirmed"}'::jsonb, '{}'::jsonb, null,
  '{"external_id":"cs_synthetic_vve_os_measurement","kind":"deposit","amount_pence":4700}'::jsonb
);

-- Revisit the confirmed state. Unique canonical keys must prevent duplicates.
select vve_measurement_test_20260924.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  2, 'synthetic-os-validation', 'confirmed_replayed',
  '{"state":"confirmed"}'::jsonb, '{}'::jsonb, null, null
);

select vve_measurement_test_20260924.queue_booking_measurement(
  '11111111-1111-4111-8111-111111111111',
  'booking_request_submitted',
  'booking:11111111-1111-4111-8111-111111111111:booking_request_submitted',
  '2026-09-24 12:00:00+00'
);

insert into vve_measurement_assertions
select 'canonical events are each queued exactly once',
       count(*) = 4 and count(distinct event_name) = 4,
       'rows=' || count(*) || ', distinct_events=' || count(distinct event_name)
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='11111111-1111-4111-8111-111111111111';

insert into vve_measurement_assertions
select 'deposit uses the verified actual amount and opaque Stripe ID',
       count(*) = 1
         and min(amount_pence) = 4700
         and min(currency) = 'gbp'
         and min(payment_type) = 'stripe_deposit'
         and min(payment_external_id) = 'cs_synthetic_vve_os_measurement',
       'deposit_rows=' || count(*) || ', amount_pence=' || coalesce(min(amount_pence)::text, 'null')
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='11111111-1111-4111-8111-111111111111'
  and event_name='deposit_paid';

insert into vve_measurement_assertions
select 'outbox contains hashes and no synthetic raw customer data',
       bool_and(match_data->>'email_sha256' = repeat('a',64))
         and bool_and(match_data->>'phone_sha256' = repeat('b',64))
         and position('measurement@example.invalid' in lower(jsonb_agg(to_jsonb(o))::text)) = 0
         and position('+447000000000' in lower(jsonb_agg(to_jsonb(o))::text)) = 0
         and position('synthetic measurement person' in lower(jsonb_agg(to_jsonb(o))::text)) = 0
         and position('1 synthetic validation way' in lower(jsonb_agg(to_jsonb(o))::text)) = 0,
       'raw synthetic PII absent; consented SHA-256 match fields present'
from vve_measurement_test_20260924.booking_measurement_outbox o
where booking_id='11111111-1111-4111-8111-111111111111';

-- An operational after-clean confirmation without a verified deposit must not
-- enter the paid-confirmation measurement stage. Mark the fixture as a test so
-- its request/qualification rows cannot be claimed later in this script.
insert into vve_measurement_test_20260924.bookings (
  id, request_key, booking_ref, created_at, payment_status, deposit_amount,
  status, gclid, attribution_first_touch_at,
  measurement_advertising_consent, measurement_consent_version,
  measurement_consent_recorded_at, measurement_is_test
) values (
  '55555555-5555-4555-8555-555555555555',
  '55555555-5555-4555-8555-555555555556',
  'TEST-OS-NO-DEPOSIT', '2026-09-24 12:30:00+00',
  'pending_payment', 0, 'new', 'synthetic-no-deposit-click',
  '2026-09-24 12:30:00+00', true, '2026-09-24',
  '2026-09-24 12:30:00+00', true
);
insert into vve_measurement_test_20260924.booking_journeys(booking_id)
values ('55555555-5555-4555-8555-555555555555');
select vve_measurement_test_20260924.apply_booking_journey(
  '55555555-5555-4555-8555-555555555555',
  0, 'synthetic-os-validation', 'confirmed_without_deposit',
  '{"state":"confirmed"}'::jsonb, '{}'::jsonb, null, null
);

insert into vve_measurement_assertions
select 'confirmation is not counted before a verified deposit',
       count(*) = 2
         and count(*) filter (where event_name='booking_request_submitted') = 1
         and count(*) filter (where event_name='booking_request_qualified') = 1
         and count(*) filter (where event_name='deposit_paid') = 0
         and count(*) filter (where event_name='booking_confirmed') = 0,
       'rows=' || count(*)
         || ', confirmed=' || count(*) filter (where event_name='booking_confirmed')
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='55555555-5555-4555-8555-555555555555';

-- A test booking goes through all milestones, but none is claimable.
insert into vve_measurement_test_20260924.bookings (
  id, request_key, booking_ref, created_at, payment_status, deposit_amount,
  status, gclid, attribution_first_touch_at,
  measurement_advertising_consent, measurement_consent_version,
  measurement_consent_recorded_at, measurement_is_test
) values (
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222223',
  'TEST-OS-SUPPRESSED', '2026-09-24 13:00:00+00',
  'pending_payment', 0, 'new', 'synthetic-test-click',
  '2026-09-24 13:00:00+00', true, '2026-09-24',
  '2026-09-24 13:00:00+00', true
);
insert into vve_measurement_test_20260924.booking_journeys(booking_id)
values ('22222222-2222-4222-8222-222222222222');
select vve_measurement_test_20260924.apply_booking_journey(
  '22222222-2222-4222-8222-222222222222',
  0, 'synthetic-os-validation', 'offer_sent',
  '{"state":"offered"}'::jsonb, '{}'::jsonb, null, null
);
select vve_measurement_test_20260924.apply_booking_journey(
  '22222222-2222-4222-8222-222222222222',
  1, 'synthetic-os-validation', 'test_deposit_received',
  '{"state":"confirmed","paid_pence":5100}'::jsonb, '{}'::jsonb, null,
  '{"external_id":"cs_synthetic_vve_os_test","kind":"deposit","amount_pence":5100}'::jsonb
);

insert into vve_measurement_assertions
select 'test request and later milestones remain suppressed',
       count(*) = 4
         and bool_and(status='suppressed')
         and bool_and(last_error='test_record')
         and bool_and(is_test),
       'rows=' || count(*) || ', suppressed=' || count(*) filter (where status='suppressed')
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='22222222-2222-4222-8222-222222222222';

-- Denied consent must fail closed immediately.
insert into vve_measurement_test_20260924.bookings (
  id, request_key, booking_ref, created_at, payment_status, deposit_amount,
  status, gclid, attribution_first_touch_at,
  measurement_advertising_consent, measurement_consent_version,
  measurement_consent_recorded_at, measurement_is_test
) values (
  '33333333-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333334',
  'TEST-OS-DENIED', '2026-09-24 14:00:00+00',
  'pending_payment', 0, 'new', 'synthetic-denied-click',
  '2026-09-24 14:00:00+00', false, '2026-09-24',
  '2026-09-24 14:00:00+00', false
);

insert into vve_measurement_assertions
select 'denied advertising consent fails closed',
       count(*) = 1
         and bool_and(status='suppressed')
         and bool_and(last_error='advertising_consent_not_granted')
         and bool_and(match_data='{}'::jsonb),
       'rows=' || count(*) || ', reason=' || coalesce(min(last_error), 'null')
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='33333333-3333-4333-8333-333333333333';

-- A manual bank reference may be human-entered, so it must remain only in the
-- restricted ledger and never be copied to the analytics outbox.
insert into vve_measurement_test_20260924.bookings (
  id, request_key, booking_ref, created_at, payment_status, deposit_amount,
  status, gclid, attribution_first_touch_at,
  measurement_advertising_consent, measurement_consent_version,
  measurement_consent_recorded_at, measurement_is_test
) values (
  '44444444-4444-4444-8444-444444444444',
  '44444444-4444-4444-8444-444444444445',
  'TEST-OS-BANK', '2026-09-24 15:00:00+00',
  'pending_payment', 0, 'new', 'synthetic-bank-click',
  '2026-09-24 15:00:00+00', true, '2026-09-24',
  '2026-09-24 15:00:00+00', true
);
insert into vve_measurement_test_20260924.booking_journeys(booking_id)
values ('44444444-4444-4444-8444-444444444444');
select vve_measurement_test_20260924.apply_booking_journey(
  '44444444-4444-4444-8444-444444444444',
  0, 'synthetic-os-validation', 'manual_bank_deposit_received',
  '{"state":"confirmed","paid_pence":3000}'::jsonb, '{}'::jsonb, null,
  '{"external_id":"bank-deposit:synthetic:ZZ999ZZ-240926","kind":"manual_deposit","amount_pence":3000}'::jsonb
);

insert into vve_measurement_assertions
select 'manual bank reference remains outside the outbox',
       count(*) = 1
         and bool_and(payment_external_id is null)
         and position('bank-deposit:synthetic:zz999zz-240926' in lower(jsonb_agg(to_jsonb(o))::text)) = 0,
       'deposit_rows=' || count(*) || ', outbox_external_ids=' || count(payment_external_id)
from vve_measurement_test_20260924.booking_measurement_outbox o
where booking_id='44444444-4444-4444-8444-444444444444'
  and event_name='deposit_paid';

insert into vve_measurement_assertions
select 'RLS and role grants protect the outbox',
       c.relrowsecurity
         and not has_table_privilege('anon', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select')
         and not has_table_privilege('authenticated', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select')
         and has_table_privilege('service_role', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select'),
       'rls=' || c.relrowsecurity::text
         || ', anon_select=' || has_table_privilege('anon', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select')::text
         || ', authenticated_select=' || has_table_privilege('authenticated', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select')::text
         || ', service_role_select=' || has_table_privilege('service_role', 'vve_measurement_test_20260924.booking_measurement_outbox', 'select')::text
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='vve_measurement_test_20260924' and c.relname='booking_measurement_outbox';

-- Only the four eligible events are claimable. Withdrawing consent while they
-- are in-flight must suppress them and erase all matching/attribution snapshots.
with claimed as (
  select * from vve_measurement_test_20260924.claim_booking_measurements(25)
)
insert into vve_measurement_assertions
select 'only eligible canonical events can be claimed',
       count(*) = 4
         and bool_and(booking_id='11111111-1111-4111-8111-111111111111')
         and bool_and(status='sending'),
       'claimed=' || count(*)
from claimed;

select vve_measurement_test_20260924.withdraw_booking_measurement_consent(
  '11111111-1111-4111-8111-111111111111'
);

insert into vve_measurement_assertions
select 'consent withdrawal suppresses in-flight rows and clears snapshots',
       count(*) = 4
         and bool_and(status='suppressed')
         and bool_and(last_error='consent_withdrawn')
         and bool_and(match_data='{}'::jsonb)
         and bool_and(attribution='{}'::jsonb),
       'rows=' || count(*) || ', cleared=' || count(*) filter (
         where match_data='{}'::jsonb and attribution='{}'::jsonb
       )
from vve_measurement_test_20260924.booking_measurement_outbox
where booking_id='11111111-1111-4111-8111-111111111111';

do $vve_result_notices$
declare r record; total integer; failed integer;
begin
  for r in select * from vve_measurement_assertions order by check_name loop
    raise notice '% | % | %', case when r.passed then 'PASS' else 'FAIL' end,
      r.check_name, r.detail;
  end loop;
  select count(*), count(*) filter (where not passed)
    into total, failed from vve_measurement_assertions;
  raise notice 'VVE OS RESULT: % of % checks passed', total-failed, total;
end
$vve_result_notices$;

select case when bool_and(passed) over ()
       then 'PASS — all ' || count(*) over () || ' isolated measurement checks passed'
       else 'FAIL — ' || count(*) filter (where not passed) over ()
         || ' of ' || count(*) over () || ' checks failed'
       end as overall_result,
       check_name, passed, detail
from vve_measurement_assertions
order by passed, check_name;

-- This removes every schema object and every synthetic row above atomically.
rollback;

-- This is the final visible result in editors that display only the last query.
select case when to_regnamespace('vve_measurement_test_20260924') is null
  then 'PASS — rollback complete; isolated schema does not exist'
  else 'FAIL — stop and ask for review; isolated schema still exists'
end as rollback_verification;
