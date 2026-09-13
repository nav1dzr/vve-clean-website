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
