import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const schema = "vve_notification_test_20260924";
const migrationName =
  "20260924140000_booking_request_notification_outbox.sql";
const migrationUrl = new URL(
  `../supabase/migrations/${migrationName}`,
  import.meta.url,
);
const outputUrl = new URL(
  "../docs/VVE-OS-BOOKING-REQUEST-NOTIFICATION-ROLLBACK-TEST-2026-09-24.sql",
  import.meta.url,
);

const migration = await readFile(migrationUrl, "utf8");
const sha256 = createHash("sha256").update(migration).digest("hex");
const isolatedMigration = migration
  .replaceAll("public.", `${schema}.`)
  .replace(
    /set(\s+)search_path\s*=\s*public\b/gi,
    (_match, spacing) => `set${spacing}search_path = ${schema}`,
  );

if (
  /\bpublic\.(?:bookings|booking_journey_messages|booking_request_notification_outbox)\b/i.test(
    isolatedMigration,
  )
) {
  throw new Error("An application-table reference still targets public.");
}
if (/set\s+search_path\s*=\s*public\b/i.test(isolatedMigration)) {
  throw new Error("A security-definer search_path still targets public.");
}

const header = String.raw`-- VVE Clean booking-request notifications: VVE OS rollback-only validation
-- Generated from ${migrationName} SHA-256: ${sha256}
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
create schema ${schema};
revoke all on schema ${schema} from public, anon, authenticated;
grant usage on schema ${schema} to service_role;

-- Minimal synthetic prerequisites. Only columns referenced by the notification
-- migration are present; no production booking, media or payment data is used.
create table ${schema}.bookings (
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

create table ${schema}.booking_journey_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references ${schema}.bookings(id) on delete cascade,
  kind text not null
);

-- This eligible-looking record predates the migration. Its continued absence
-- from the outbox proves the migration performs no historical backfill.
insert into ${schema}.bookings (
  id, request_key, request_fingerprint, booking_ref, payment_status,
  deposit_amount
) values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'synthetic-historic-fingerprint', 'TEST-OS-HISTORIC',
  'pending_payment', 0
);

-- BEGIN mechanically schema-isolated repository migration
`;

const footer = String.raw`
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
from ${schema}.booking_request_notification_outbox
where booking_id = '10000000-0000-4000-8000-000000000001';

-- Only a future durable, unpaid website request qualifies.
insert into ${schema}.bookings (
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
from ${schema}.booking_request_notification_outbox
where booking_id = '20000000-0000-4000-8000-000000000001';

-- Re-run the trigger's conflict-safe channel insert twice. The unique key must
-- retain exactly one row per booking/channel and preserve existing state.
insert into ${schema}.booking_request_notification_outbox(booking_id, channel)
select '20000000-0000-4000-8000-000000000001', channel
from unnest(array['customer_email','business_email','telegram']) as q(channel)
on conflict (booking_id, channel) do nothing;
insert into ${schema}.booking_request_notification_outbox(booking_id, channel)
select '20000000-0000-4000-8000-000000000001', channel
from unnest(array['customer_email','business_email','telegram']) as q(channel)
on conflict (booking_id, channel) do nothing;

insert into vve_notification_assertions
select 'replay remains unique',
       count(*) = 3 and count(distinct channel) = 3,
       'rows_after_two_replays=' || count(*)
from ${schema}.booking_request_notification_outbox
where booking_id = '20000000-0000-4000-8000-000000000001';

insert into vve_notification_assertions
select 'service-role-only queue and RPC access',
       c.relrowsecurity
         and not has_table_privilege(
           'anon', '${schema}.booking_request_notification_outbox', 'select'
         )
         and not has_table_privilege(
           'authenticated', '${schema}.booking_request_notification_outbox', 'select'
         )
         and has_table_privilege(
           'service_role', '${schema}.booking_request_notification_outbox', 'select'
         )
         and not has_function_privilege(
           'anon', '${schema}.claim_booking_request_notifications(uuid,integer)', 'execute'
         )
         and not has_function_privilege(
           'authenticated', '${schema}.record_booking_request_notification(uuid,uuid,text,text)', 'execute'
         )
         and has_function_privilege(
           'service_role', '${schema}.claim_booking_request_notifications(uuid,integer)', 'execute'
         )
         and has_function_privilege(
           'service_role', '${schema}.record_booking_request_notification(uuid,uuid,text,text)', 'execute'
         )
         and has_function_privilege(
           'service_role', '${schema}.requeue_uncertain_booking_request_notification(uuid,boolean)', 'execute'
         ),
       'rls=' || c.relrowsecurity::text
         || ', anon_select=' || has_table_privilege(
           'anon', '${schema}.booking_request_notification_outbox', 'select'
         )::text
         || ', service_role_select=' || has_table_privilege(
           'service_role', '${schema}.booking_request_notification_outbox', 'select'
         )::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = '${schema}'
  and c.relname = 'booking_request_notification_outbox';

create temp table vve_initial_notification_claims as
select ${schema}.claim_booking_request_notifications(
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
       not ${schema}.record_booking_request_notification(
         (payload->>'outbox_id')::uuid,
         'ffffffff-ffff-4fff-8fff-ffffffffffff',
         'sent', null
       ),
       'wrong_token_accepted=false'
from vve_initial_notification_claims
where payload->>'channel' = 'customer_email';

create temp table vve_initial_notification_results as
select payload->>'channel' as channel,
       ${schema}.record_booking_request_notification(
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
         and (select email_customer_sent from ${schema}.bookings
              where id = '20000000-0000-4000-8000-000000000001')
         and (select count(*) = 1
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'customer_email' and status = 'sent'
                and attempts = 1 and sent_at is not null)
         and (select count(*) = 1
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'business_email' and status = 'failed'
                and attempts = 1 and last_error_code = 'smtp_transient'
                and next_attempt_at > last_attempt_at)
         and (select count(*) = 1
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'telegram' and status = 'unconfigured'
                and attempts = 0
                and last_error_code = 'telegram_unconfigured'),
       'customer=sent, business=failed, telegram=unconfigured'
from vve_initial_notification_results;

-- Make only the two intentionally incomplete channels due, then prove each is
-- claimable again without creating a second channel row.
update ${schema}.booking_request_notification_outbox
set next_attempt_at = now()
where booking_id = '20000000-0000-4000-8000-000000000001'
  and channel in ('business_email', 'telegram');

create temp table vve_notification_retry_claims as
select ${schema}.claim_booking_request_notifications(
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
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'business_email')
         and (select attempts = 1
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and channel = 'telegram'),
       'retry_claims=' || count(*)
from vve_notification_retry_claims;

create temp table vve_notification_retry_results as
select payload->>'channel' as channel,
       ${schema}.record_booking_request_notification(
         (payload->>'outbox_id')::uuid,
         (payload->>'claim_token')::uuid,
         'sent', null
       ) as accepted
from vve_notification_retry_claims;

insert into vve_notification_assertions
select 'successful retries checkpoint all established flags',
       count(*) = 2 and bool_and(accepted)
         and (select count(*) = 3
              from ${schema}.booking_request_notification_outbox
              where booking_id = '20000000-0000-4000-8000-000000000001'
                and status = 'sent')
         and (select email_customer_sent and email_business_sent and telegram_sent
              from ${schema}.bookings
              where id = '20000000-0000-4000-8000-000000000001'),
       'completed_retry_checkpoints=' || count(*)
from vve_notification_retry_results;

-- A completed CRM retry is suppressed by the fence, so it cannot duplicate a
-- channel already checkpointed as sent.
insert into ${schema}.booking_journey_messages(booking_id, kind)
values (
  '20000000-0000-4000-8000-000000000001',
  'initial_customer'
);

insert into vve_notification_assertions
select 'completed CRM replay is suppressed',
       count(*) = 0,
       'journey_messages_inserted=' || count(*)
from ${schema}.booking_journey_messages
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
select case when to_regnamespace('${schema}') is null
  then 'PASS — notification checks passed and rollback removed the isolated schema'
  else 'FAIL — stop and ask for review; isolated notification schema still exists'
end as rollback_verification;
`;

await writeFile(
  outputUrl,
  `${header}\n${isolatedMigration.trim()}\n${footer}`,
  "utf8",
);

console.log(fileURLToPath(outputUrl));
