-- Apply to a test database first. No existing customer/payment rows are changed.
create table if not exists public.booking_journeys (
  booking_id uuid primary key references public.bookings (id),
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

alter table public.booking_journeys
add column if not exists reminder_sent_at timestamptz;

alter table public.booking_journeys
add column if not exists appointment_reminder_sent_at timestamptz;

create table if not exists public.booking_journey_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id),
  revision integer not null,
  actor text not null,
  event_type text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.booking_journey_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
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

create table if not exists public.booking_journey_payments (
  external_id text primary key,
  booking_id uuid not null references public.bookings (id),
  kind text not null,
  amount_pence integer not null,
  currency text not null check (currency = 'gbp'),
  created_at timestamptz not null default now()
);

create index if not exists booking_journey_messages_due on public.booking_journey_messages (status, created_at);

create index if not exists booking_journey_holds_due on public.booking_journeys (hold_until)
where
  state = 'offered';

alter table public.booking_journeys enable row level security;

alter table public.booking_journey_events enable row level security;

alter table public.booking_journey_messages enable row level security;

alter table public.booking_journey_payments enable row level security;

revoke all on public.booking_journeys,
public.booking_journey_events,
public.booking_journey_messages,
public.booking_journey_payments
from
  anon,
  authenticated;

grant all on public.booking_journeys,
public.booking_journey_events,
public.booking_journey_messages,
public.booking_journey_payments to service_role;

grant usage,
select
  on sequence public.booking_journey_events_id_seq to service_role;

-- One transaction owns the revision, immutable history, payment ledger and outbox.
-- Only trusted server code can call this; browsers have no execute permission.
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
set
  search_path = public as $$
declare j public.booking_journeys; next_row public.booking_journeys; affected integer;
begin
 select * into j from public.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(select 1 from public.booking_journey_payments where external_id = p_payment->>'external_id') then return to_jsonb(j); end if;
 if j.revision <> p_revision then raise exception 'Booking changed; reload before trying again' using errcode = '40001'; end if;
 if p_payment is not null then
   insert into public.booking_journey_payments(external_id,booking_id,kind,amount_pence,currency)
   values(p_payment->>'external_id',p_booking_id,p_payment->>'kind',(p_payment->>'amount_pence')::integer,'gbp');
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
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload') on conflict(dedup_key) do nothing;
   if p_message->>'kind' in ('reschedule_received','cancelled','payment_review') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business')) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function public.apply_booking_journey (
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
execute on function public.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
