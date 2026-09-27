// Only prepares SQL for the approved VVE OS test project. Does not connect.
import { readFile, writeFile } from 'node:fs/promises';
const names = [
  '20260711000000_create_bookings_table.sql',
  '20260712000000_add_security_columns.sql',
  '20260713000000_event_processing_state.sql',
  '20260717000000_add_crm_booking_fields.sql',
  '20260908100000_booking_journey.sql',
  '20260908120000_request_reliability.sql',
  '20260916183000_booking_confirmation_channels.sql',
  '20260917120000_booking_measurement_outbox.sql',
  '20260924120000_booking_measurement_canonical_events.sql',
  '20260924140000_booking_request_notification_outbox.sql',
];
const tables = ['bookings','processed_stripe_events','contact_enquiries','booking_journeys','booking_journey_events','booking_journey_messages','booking_journey_payments','booking_measurement_outbox','booking_request_notification_outbox'];
let sql = `-- VVE OS ONLY: spbrstpxrimuuorkbsbo. Never run in Website production.
-- Empty test-only booking tables; existing vve_os/media tables are untouched.
begin;
set local statement_timeout = '60s';
set local lock_timeout = '3s';
set local search_path = public;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name in (${tables.map(t=>`'${t}'`).join(',')})) then
    raise exception 'Refusing to reuse an existing booking table';
  end if;
end $$;
`;
for (const name of names) sql += `\n-- ${name}\n` + await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
sql += `\n-- No browser role may read or mutate these synthetic booking records.
revoke all on ${tables.map(t=>`public.${t}`).join(',')} from anon,authenticated;
grant all on ${tables.map(t=>`public.${t}`).join(',')} to service_role;
comment on table public.bookings is 'VVE-MEAS-E2E-20260927: synthetic website booking tests only; VVE OS project';
notify pgrst, 'reload schema';
commit;
select 'VVE OS booking test tables ready; existing OS/media tables untouched' as result;
`;
await writeFile(new URL('../docs/VVE-OS-MEASUREMENT-E2E-SETUP-2026-09-27.sql',import.meta.url),sql);
console.log(`Prepared test-only bootstrap from ${names.length} migrations.`);
