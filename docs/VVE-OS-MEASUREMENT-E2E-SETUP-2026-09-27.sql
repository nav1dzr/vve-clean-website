-- VVE OS ONLY: spbrstpxrimuuorkbsbo. Never run in Website production.
-- Empty test-only booking tables; existing vve_os/media tables are untouched.
begin;
set local statement_timeout = '60s';
set local lock_timeout = '3s';
set local search_path = public;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name in ('bookings','processed_stripe_events','contact_enquiries','booking_journeys','booking_journey_events','booking_journey_messages','booking_journey_payments','booking_measurement_outbox','booking_request_notification_outbox')) then
    raise exception 'Refusing to reuse an existing booking table';
  end if;
end $$;

-- 20260711000000_create_bookings_table.sql
-- Idempotent migration: creates the bookings table if it does not exist,
-- then adds every column the API expects. Safe to run against a database
-- where the table was created manually without tracked migrations.

CREATE TABLE IF NOT EXISTS bookings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Core booking columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id         text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status            text NOT NULL DEFAULT 'pending_payment';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount            numeric DEFAULT 30;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS full_name                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address                   text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS postcode                  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service                   text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_date            text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_time            text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at                timestamptz DEFAULT now();

-- Attribution / offer columns (written by the optional attribution update block)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_code                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_percent           numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS standard_total             numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount            numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_total_after_discount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS first_source               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_source                text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS landing_page               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_source                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_medium                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_campaign               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_content                text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gclid                      text;

-- UNIQUE constraints required for upsert onConflict behaviour in stripe-webhook.js
-- Each block adds the constraint only when it does not already exist.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_booking_ref_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_booking_ref_key UNIQUE (booking_ref);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_stripe_session_id_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_stripe_session_id_key UNIQUE (stripe_session_id);
  END IF;
END $$;

-- RLS — all API writes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- Authenticated admin users can read bookings; anonymous users cannot.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'authenticated_read_bookings'
  ) THEN
    EXECUTE 'CREATE POLICY "authenticated_read_bookings"
      ON bookings FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 20260712000000_add_security_columns.sql
-- Security hardening migration.
-- Idempotent: safe to run against a database that was partially set up.

-- ── 1. Confirmation token ──────────────────────────────────────────────────────
-- Cryptographically random 64-char hex token generated server-side when the
-- checkout session is created. Required for public confirmation page lookup.
-- Prevents enumeration of bookings by guessing POSTCODE+DDMMYY references.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_token text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_confirmation_token_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_confirmation_token_key UNIQUE (confirmation_token);
  END IF;
END $$;

-- Index for fast lookup by token on the confirmation page
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bookings' AND indexname = 'idx_bookings_confirmation_token'
  ) THEN
    CREATE INDEX idx_bookings_confirmation_token ON bookings (confirmation_token);
  END IF;
END $$;

-- ── 2. Processed Stripe events (idempotency) ──────────────────────────────────
-- Stores the Stripe event ID after successful processing. The webhook handler
-- checks this table before doing any work — if the event ID is already present,
-- the event was already processed (duplicate delivery) and the handler returns
-- 200 immediately without re-sending emails or Telegram messages.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id    text        PRIMARY KEY,
  event_type  text        NOT NULL,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_stripe_events' AND policyname = 'no_public_access_stripe_events'
  ) THEN
    EXECUTE 'CREATE POLICY "no_public_access_stripe_events"
      ON processed_stripe_events FOR ALL TO anon USING (false)';
  END IF;
END $$;

-- ── 3. Notification status columns ────────────────────────────────────────────
-- Track which notifications were sent for each booking. Allows retrying failed
-- notifications and investigating delivery issues without re-reading logs.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_customer_sent  boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_business_sent  boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_sent        boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sheets_sent          boolean DEFAULT false;

-- 20260713000000_event_processing_state.sql
-- Upgrade processed_stripe_events from a simple deduplication log to a
-- durable state machine. Existing rows (if any) are retroactively marked
-- 'completed' because they were inserted only after successful processing
-- under the old scheme.
--
-- State transitions:
--   new       → processing  : webhook handler atomically claims the event (INSERT)
--   processing → completed  : UPDATE after booking persisted + notifications sent
--   processing → failed     : UPDATE when DB persistence fails; Stripe retry re-claims
--   failed     → processing : Stripe retry atomically re-claims (UPDATE WHERE status='failed')
--
-- A duplicate delivery whose stored status is 'completed' returns 200 immediately.
-- A delivery whose stored status is 'processing' and claimed_at < 10 min ago also
-- returns 200 (another Lambda is handling it). A stale 'processing' row (> 10 min)
-- can be re-claimed, covering crashed Lambda recovery.

-- ── 1. Add state columns (idempotent) ─────────────────────────────────────────

ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS claimed_at  timestamptz;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS error_detail text;

-- Back-fill pre-migration rows as 'completed' (they were successfully processed)
UPDATE processed_stripe_events
   SET status = 'completed', claimed_at = COALESCE(processed_at, now())
 WHERE status IS NULL;

-- Now make status NOT NULL with default 'processing' for new inserts
-- (code always writes the status explicitly; default is a safety net)
ALTER TABLE processed_stripe_events ALTER COLUMN status     SET NOT NULL;
ALTER TABLE processed_stripe_events ALTER COLUMN status     SET DEFAULT 'processing';
ALTER TABLE processed_stripe_events ALTER COLUMN claimed_at SET NOT NULL;
ALTER TABLE processed_stripe_events ALTER COLUMN claimed_at SET DEFAULT now();

-- ── 2. Add CHECK constraint (idempotent) ──────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'processed_stripe_events_status_check'
       AND conrelid = 'processed_stripe_events'::regclass
  ) THEN
    ALTER TABLE processed_stripe_events
      ADD CONSTRAINT processed_stripe_events_status_check
        CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

-- ── 3. Index for fast stale-processing recovery queries ───────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'processed_stripe_events'
       AND indexname  = 'idx_stripe_events_status_claimed'
  ) THEN
    CREATE INDEX idx_stripe_events_status_claimed
      ON processed_stripe_events (status, claimed_at);
  END IF;
END $$;

-- 20260717000000_add_crm_booking_fields.sql
-- Phase 2 CRM fields — additive and backwards-compatible only.
--
-- Every column here is nullable (or defaulted for existing rows) and none of
-- them are written by the public site's checkout/webhook code, which is not
-- modified by this migration. Existing rows will have NULL in every new
-- column except `status` (defaulted to 'new') — the admin UI must handle
-- that honestly (ADMIN_CRM_PLAN.md §12), not guess or fabricate values.

-- ── Operational booking status — separate from payment_status ────────────────
-- See ADMIN_CRM_PLAN.md §21. Deliberately excludes deposit_paid/refunded/
-- payment_issue, which describe payment/balance state, not job state.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status text;

UPDATE bookings SET status = 'new' WHERE status IS NULL;

ALTER TABLE bookings ALTER COLUMN status SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'new';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_status_check' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_status_check
        CHECK (status IN (
          'new', 'confirmed', 'scheduled', 'in_progress',
          'completed', 'rescheduled', 'cancelled', 'no_show'
        ));
  END IF;
END $$;

-- ── Approved future data fields (ADMIN_CRM_PLAN.md §24) ──────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_config jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_date date;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_status text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_payment_method text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_balance_status_check' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_balance_status_check
        CHECK (balance_status IS NULL OR balance_status IN (
          'not_due', 'outstanding', 'paid', 'waived'
        ));
  END IF;
END $$;

-- Index for the booking-list "service date" sort/filter (§18). Partial index
-- (WHERE service_date IS NOT NULL) since most historical rows will be NULL
-- until backfilled or set going forward — keeps the index small and useful.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_service_date'
  ) THEN
    CREATE INDEX idx_bookings_service_date ON bookings (service_date) WHERE service_date IS NOT NULL;
  END IF;
END $$;

-- Index for the booking-list "highest value" sort (§18), same partial-index
-- rationale as above.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_total_price'
  ) THEN
    CREATE INDEX idx_bookings_total_price ON bookings (total_price) WHERE total_price IS NOT NULL;
  END IF;
END $$;

-- Index for status/date filtering on the booking list and dashboard summary.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_status_created_at'
  ) THEN
    CREATE INDEX idx_bookings_status_created_at ON bookings (status, created_at DESC);
  END IF;
END $$;

-- 20260908100000_booking_journey.sql
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

-- 20260908120000_request_reliability.sql
-- Additive only. Apply in an isolated test database before an approved release.
alter table public.bookings add column if not exists request_key uuid;
alter table public.bookings add column if not exists request_fingerprint text;
create unique index if not exists bookings_request_key_unique on public.bookings(request_key) where request_key is not null;

create table if not exists public.contact_enquiries (
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
alter table public.contact_enquiries enable row level security;
revoke all on public.contact_enquiries from anon, authenticated;
grant all on public.contact_enquiries to service_role;

-- The token fences a worker whose lease expired; returning the row from the
-- claim prevents an older CRM snapshot from resending completed channels.
alter table public.contact_enquiries add column if not exists delivery_claim_token uuid;
drop function if exists public.claim_enquiry_delivery(uuid);
create function public.claim_enquiry_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare claimed public.contact_enquiries;
begin
  update public.contact_enquiries
    set delivery_claim_until = now() + interval '2 minutes', delivery_claim_token = gen_random_uuid()
    where id = p_id and (delivery_claim_until is null or delivery_claim_until < now())
    returning * into claimed;
  if not found then return null; end if;
  return to_jsonb(claimed);
end;
$$;
revoke all on function public.claim_enquiry_delivery(uuid) from public, anon, authenticated;
grant execute on function public.claim_enquiry_delivery(uuid) to service_role;

create or replace function public.record_enquiry_delivery(p_id uuid, p_token uuid, p_channel text, p_result jsonb) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_channel is null or p_channel not in ('sheet','telegram','businessEmail','customerEmail')
    or p_result is null or jsonb_typeof(p_result) <> 'object'
    or coalesce(p_result->>'status','') not in ('sending','sent','failed','unconfigured')
    or octet_length(p_result::text) > 2000 then
    raise exception 'Invalid delivery result';
  end if;
  update public.contact_enquiries
    set delivery = jsonb_set(delivery, array[p_channel], p_result), updated_at = clock_timestamp()
    where id = p_id and delivery_claim_token = p_token and delivery_claim_until > now();
  return found;
end;
$$;
revoke all on function public.record_enquiry_delivery(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_enquiry_delivery(uuid,uuid,text,jsonb) to service_role;

create or replace function public.finish_enquiry_delivery(p_id uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  update public.contact_enquiries set delivery_claim_until = null, delivery_claim_token = null
    where id = p_id and delivery_claim_token = p_token returning delivery into result;
  return result;
end;
$$;
revoke all on function public.finish_enquiry_delivery(uuid,uuid) from public, anon, authenticated;
grant execute on function public.finish_enquiry_delivery(uuid,uuid) to service_role;

-- 20260916183000_booking_confirmation_channels.sql
-- Apply after the booking journey migration. Adds independent, retryable owner and calendar deliveries.
-- Does not rewrite existing bookings, payments or messages.
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
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','reschedule_received','cancellation_requested','cancelled','payment_review') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business')) on conflict(dedup_key) do nothing;
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':telegram',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business','channel','telegram')) on conflict(dedup_key) do nothing;
   end if;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','cancelled') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':calendar','calendar_sync',(p_message->'payload')||jsonb_build_object('audience','business','channel','calendar')) on conflict(dedup_key) do nothing;
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

-- 20260917120000_booking_measurement_outbox.sql
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

-- 20260924120000_booking_measurement_canonical_events.sql
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

-- 20260924140000_booking_request_notification_outbox.sql
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

-- No browser role may read or mutate these synthetic booking records.
revoke all on public.bookings,public.processed_stripe_events,public.contact_enquiries,public.booking_journeys,public.booking_journey_events,public.booking_journey_messages,public.booking_journey_payments,public.booking_measurement_outbox,public.booking_request_notification_outbox from anon,authenticated;
grant all on public.bookings,public.processed_stripe_events,public.contact_enquiries,public.booking_journeys,public.booking_journey_events,public.booking_journey_messages,public.booking_journey_payments,public.booking_measurement_outbox,public.booking_request_notification_outbox to service_role;
comment on table public.bookings is 'VVE-MEAS-E2E-20260927: synthetic website booking tests only; VVE OS project';
notify pgrst, 'reload schema';
commit;
select 'VVE OS booking test tables ready; existing OS/media tables untouched' as result;
