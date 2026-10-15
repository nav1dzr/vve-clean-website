-- Durable initial website-request notifications. Additive only: this migration
-- creates no rows for existing bookings and does not contact any provider.
create table if not exists public.booking_request_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
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
  on public.booking_request_notification_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed','unconfigured','sending');

alter table public.booking_request_notification_outbox enable row level security;
revoke all on public.booking_request_notification_outbox from anon, authenticated;
grant all on public.booking_request_notification_outbox to service_role;

-- Only website requests committed with the durable request identity qualify.
-- The AFTER INSERT trigger makes the booking row and its three channel jobs one
-- transaction. There is deliberately no historic-data backfill in this file.
create or replace function public.enqueue_booking_request_notifications()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.request_key is not null
    and nullif(new.request_fingerprint, '') is not null
    and coalesce(new.payment_status, '') = 'pending_payment'
    and coalesce(new.deposit_amount, -1) = 0
  then
    insert into public.booking_request_notification_outbox(
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
after insert on public.bookings
for each row execute function public.enqueue_booking_request_notifications();

revoke all on function public.enqueue_booking_request_notifications()
  from public, anon, authenticated;

-- The established CRM can also retry the two initial emails. Fence that path
-- against the website outbox: it waits for an active claim, skips a channel
-- already checkpointed as sent, and otherwise makes the CRM journey message
-- the sole retry owner until its existing legacy flag is set.
create or replace function public.fence_crm_initial_notification_retry()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
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
  from public.booking_request_notification_outbox o
  where o.booking_id = new.booking_id and o.channel = outbox_channel
  for update;
  if not found then return new; end if;
  if outbox_status = 'sent' then return null; end if;
  if outbox_status = 'sending' then
    raise exception 'Initial request notification is already being processed'
      using errcode = '55000';
  end if;

  update public.booking_request_notification_outbox
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
before insert on public.booking_journey_messages
for each row execute function public.fence_crm_initial_notification_retry();

revoke all on function public.fence_crm_initial_notification_retry()
  from public, anon, authenticated;

-- Claiming is service-role only. Legacy flags are reconciled before selection
-- so a CRM retry that already sent an email cannot later be duplicated here.
-- An expired sending lease is ambiguous (the provider may have accepted it),
-- so it is held for review as uncertain rather than silently resent.
create or replace function public.claim_booking_request_notifications(
  p_booking_id uuid default null,
  p_limit integer default 12
) returns setof jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 30 then
    raise exception 'Invalid notification claim limit';
  end if;

  update public.booking_request_notification_outbox o
  set status = 'sent',
      sent_at = coalesce(o.sent_at, now()),
      last_error_code = null,
      claim_token = null,
      claimed_until = null,
      updated_at = clock_timestamp()
  from public.bookings b
  where b.id = o.booking_id
    and (p_booking_id is null or o.booking_id = p_booking_id)
    and o.status <> 'sent'
    and (
      (o.channel = 'customer_email' and b.email_customer_sent is true)
      or (o.channel = 'business_email' and b.email_business_sent is true)
      or (o.channel = 'telegram' and b.telegram_sent is true)
    );

  update public.booking_request_notification_outbox
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
    from public.booking_request_notification_outbox o
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
    update public.booking_request_notification_outbox o
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
  join public.bookings b on b.id = c.booking_id;
end;
$$;

revoke all on function public.claim_booking_request_notifications(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_booking_request_notifications(uuid, integer)
  to service_role;

-- The claim token fences an expired worker. Marking a channel sent and updating
-- its established bookings flag happen in the same transaction.
create or replace function public.record_booking_request_notification(
  p_id uuid,
  p_token uuid,
  p_status text,
  p_error_code text default null
) returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
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

  update public.booking_request_notification_outbox
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
    update public.bookings
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

revoke all on function public.record_booking_request_notification(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_booking_request_notification(uuid, uuid, text, text)
  to service_role;

-- A stale sender is never retried by automation because provider acceptance is
-- unknown. After checking the destination, an authorised operator can make an
-- explicitly confirmed channel claimable again without changing sent rows.
create or replace function public.requeue_uncertain_booking_request_notification(
  p_id uuid,
  p_confirm_not_delivered boolean
) returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if p_confirm_not_delivered is not true then
    raise exception 'Destination check confirmation is required';
  end if;
  update public.booking_request_notification_outbox
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

revoke all on function public.requeue_uncertain_booking_request_notification(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.requeue_uncertain_booking_request_notification(uuid, boolean)
  to service_role;
