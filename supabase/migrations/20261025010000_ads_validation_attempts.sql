-- Diagnostic-only preparation. Applying this requires separate execution approval.
-- No business records, triggers, foreign keys, RPC or completion updates.
create table public.ads_validation_attempts (
  plan_id text primary key check (plan_id = 'VVE-20261025-PRIVATE-MEASUREMENT-VALIDATION-V1'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  authority_sha256 text not null check (authority_sha256 ~ '^[0-9a-f]{64}$'),
  approved_start timestamptz not null,
  approved_end timestamptz not null,
  claimed_at timestamptz not null default clock_timestamp(),
  check (approved_end > approved_start and approved_end - approved_start <= interval '30 minutes'),
  check (claimed_at >= approved_start and claimed_at < approved_end)
);
alter table public.ads_validation_attempts enable row level security;
revoke all on table public.ads_validation_attempts from public, anon, authenticated, service_role;
grant select, insert on table public.ads_validation_attempts to service_role;
-- The unique plan_id is never reset/reclaimed. Preserve this table/row after
-- removing the temporary transport. No DELETE/UPDATE grants or client policies.
