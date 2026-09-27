import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const schema = "vve_measurement_test_20260924";
const migrationNames = [
  "20260908100000_booking_journey.sql",
  "20260908120000_request_reliability.sql",
  "20260916183000_booking_confirmation_channels.sql",
  "20260917120000_booking_measurement_outbox.sql",
  "20260924120000_booking_measurement_canonical_events.sql",
];
const outputUrl = new URL(
  "../docs/VVE-OS-BOOKING-MEASUREMENT-ROLLBACK-TEST-2026-09-24.sql",
  import.meta.url,
);

const migrations = await Promise.all(
  migrationNames.map(async (name) => {
    const source = await readFile(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );
    return {
      name,
      sha256: createHash("sha256").update(source).digest("hex"),
      sql: source
        .replaceAll("public.", `${schema}.`)
        .replace(
          /set(\s+)search_path\s*=\s*public\b/gi,
          (_match, spacing) => `set${spacing}search_path = ${schema}`,
        ),
    };
  }),
);
const isolatedMigration = migrations
  .map(({ name, sql }) => `-- BEGIN ${name}\n${sql.trim()}\n-- END ${name}`)
  .join("\n\n");

if (/\bpublic\.(?:bookings|booking_journeys|booking_journey_payments|booking_measurement_outbox)\b/i.test(isolatedMigration)) {
  throw new Error("An application-table reference still targets public.");
}
if (/set\s+search_path\s*=\s*public\b/i.test(isolatedMigration)) {
  throw new Error("A security-definer search_path still targets public.");
}

const header = String.raw`-- VVE Clean booking measurement: VVE OS rollback-only compatibility test
-- Generated from the five ordered repository migrations listed below.
${migrations.map(({ name, sha256 }) => `-- ${name} SHA-256: ${sha256}`).join("\n")}
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
create schema ${schema};
revoke all on schema ${schema} from public, anon, authenticated;
grant usage on schema ${schema} to service_role;

-- Minimal synthetic prerequisites for the real measurement migration. They
-- mirror only the columns its functions and triggers depend upon.
create table ${schema}.bookings (
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
`;

const footer = String.raw`
-- END mechanically schema-isolated repository migrations

create temp table vve_measurement_assertions (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

-- Synthetic eligible ad-attributed request. The fake contact values exist only
-- to prove that raw customer data cannot enter the measurement outbox.
insert into ${schema}.bookings (
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

insert into ${schema}.booking_journeys(booking_id)
values ('11111111-1111-4111-8111-111111111111');

select ${schema}.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  0, 'synthetic-os-validation', 'offer_sent',
  '{"state":"offered"}'::jsonb, '{}'::jsonb, null, null
);

select ${schema}.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  1, 'synthetic-os-validation', 'stripe_deposit_received',
  '{"state":"confirmed","paid_pence":4700}'::jsonb,
  '{"status":"confirmed","payment_status":"paid","deposit_amount":47}'::jsonb,
  null,
  '{"external_id":"cs_synthetic_vve_os_measurement","kind":"deposit","amount_pence":4700}'::jsonb
);

-- Replay the same provider payment. The restricted ledger and journey function
-- must recognize it before attempting another state transition.
select ${schema}.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  1, 'synthetic-os-validation', 'stripe_webhook_replay',
  '{"state":"confirmed"}'::jsonb, '{}'::jsonb, null,
  '{"external_id":"cs_synthetic_vve_os_measurement","kind":"deposit","amount_pence":4700}'::jsonb
);

-- Revisit the confirmed state. Unique canonical keys must prevent duplicates.
select ${schema}.apply_booking_journey(
  '11111111-1111-4111-8111-111111111111',
  2, 'synthetic-os-validation', 'confirmed_replayed',
  '{"state":"confirmed"}'::jsonb, '{}'::jsonb, null, null
);

select ${schema}.queue_booking_measurement(
  '11111111-1111-4111-8111-111111111111',
  'booking_request_submitted',
  'booking:11111111-1111-4111-8111-111111111111:booking_request_submitted',
  '2026-09-24 12:00:00+00'
);

insert into vve_measurement_assertions
select 'canonical events are each queued exactly once',
       count(*) = 4 and count(distinct event_name) = 4,
       'rows=' || count(*) || ', distinct_events=' || count(distinct event_name)
from ${schema}.booking_measurement_outbox
where booking_id='11111111-1111-4111-8111-111111111111';

insert into vve_measurement_assertions
select 'deposit uses the verified actual amount and opaque Stripe ID',
       count(*) = 1
         and min(amount_pence) = 4700
         and min(currency) = 'gbp'
         and min(payment_type) = 'stripe_deposit'
         and min(payment_external_id) = 'cs_synthetic_vve_os_measurement',
       'deposit_rows=' || count(*) || ', amount_pence=' || coalesce(min(amount_pence)::text, 'null')
from ${schema}.booking_measurement_outbox
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
from ${schema}.booking_measurement_outbox o
where booking_id='11111111-1111-4111-8111-111111111111';

-- An operational after-clean confirmation without a verified deposit must not
-- enter the paid-confirmation measurement stage. Mark the fixture as a test so
-- its request/qualification rows cannot be claimed later in this script.
insert into ${schema}.bookings (
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
insert into ${schema}.booking_journeys(booking_id)
values ('55555555-5555-4555-8555-555555555555');
select ${schema}.apply_booking_journey(
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
from ${schema}.booking_measurement_outbox
where booking_id='55555555-5555-4555-8555-555555555555';

-- A test booking goes through all milestones, but none is claimable.
insert into ${schema}.bookings (
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
insert into ${schema}.booking_journeys(booking_id)
values ('22222222-2222-4222-8222-222222222222');
select ${schema}.apply_booking_journey(
  '22222222-2222-4222-8222-222222222222',
  0, 'synthetic-os-validation', 'offer_sent',
  '{"state":"offered"}'::jsonb, '{}'::jsonb, null, null
);
select ${schema}.apply_booking_journey(
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
from ${schema}.booking_measurement_outbox
where booking_id='22222222-2222-4222-8222-222222222222';

-- Denied consent must fail closed immediately.
insert into ${schema}.bookings (
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
from ${schema}.booking_measurement_outbox
where booking_id='33333333-3333-4333-8333-333333333333';

-- A manual bank reference may be human-entered, so it must remain only in the
-- restricted ledger and never be copied to the analytics outbox.
insert into ${schema}.bookings (
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
insert into ${schema}.booking_journeys(booking_id)
values ('44444444-4444-4444-8444-444444444444');
select ${schema}.apply_booking_journey(
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
from ${schema}.booking_measurement_outbox o
where booking_id='44444444-4444-4444-8444-444444444444'
  and event_name='deposit_paid';

insert into vve_measurement_assertions
select 'RLS and role grants protect the outbox',
       c.relrowsecurity
         and not has_table_privilege('anon', '${schema}.booking_measurement_outbox', 'select')
         and not has_table_privilege('authenticated', '${schema}.booking_measurement_outbox', 'select')
         and has_table_privilege('service_role', '${schema}.booking_measurement_outbox', 'select'),
       'rls=' || c.relrowsecurity::text
         || ', anon_select=' || has_table_privilege('anon', '${schema}.booking_measurement_outbox', 'select')::text
         || ', authenticated_select=' || has_table_privilege('authenticated', '${schema}.booking_measurement_outbox', 'select')::text
         || ', service_role_select=' || has_table_privilege('service_role', '${schema}.booking_measurement_outbox', 'select')::text
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='${schema}' and c.relname='booking_measurement_outbox';

-- Only the four eligible events are claimable. Withdrawing consent while they
-- are in-flight must suppress them and erase all matching/attribution snapshots.
with claimed as (
  select * from ${schema}.claim_booking_measurements(25)
)
insert into vve_measurement_assertions
select 'only eligible canonical events can be claimed',
       count(*) = 4
         and bool_and(booking_id='11111111-1111-4111-8111-111111111111')
         and bool_and(status='sending'),
       'claimed=' || count(*)
from claimed;

select ${schema}.withdraw_booking_measurement_consent(
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
from ${schema}.booking_measurement_outbox
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
select case when to_regnamespace('${schema}') is null
  then 'PASS — rollback complete; isolated schema does not exist'
  else 'FAIL — stop and ask for review; isolated schema still exists'
end as rollback_verification;
`;

await writeFile(
  outputUrl,
  `${header}\n${isolatedMigration.trim()}\n${footer}`,
  "utf8",
);

console.log(fileURLToPath(outputUrl));
