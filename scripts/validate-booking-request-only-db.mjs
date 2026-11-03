// Disposable local PostgreSQL only. No URL, credentials, production data or provider calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const i = process.argv.indexOf('--pglite');
if (i < 0 || !process.argv[i + 1]) throw Error('Supply an existing local --pglite module path');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[i + 1])).href);
const db = new PGlite();
let checks = 0;
const check = (condition) => { assert.ok(condition); checks++; };
const cutoff = '2026-11-03T00:00:00.000Z';
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.booking_measurement_outbox (
      id integer primary key,event_name text,provider text default 'google_data_manager',is_test boolean default false,
      occurred_at timestamptz default '2026-11-03T00:00:00Z',created_at timestamptz default '2026-11-03T00:00:00Z',
      status text default 'pending',attempts integer default 0,status_checks integer default 0,
      next_attempt_at timestamptz,claimed_at timestamptz,last_error text
    );`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261103180000_booking_request_only_claim.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into booking_measurement_outbox(id,event_name) values
    (1,'booking_request_submitted'),(2,'deposit_paid'),(3,'booking_confirmed'),(4,'booking_request_qualified'),
    (5,'booking_request_submitted'),(6,'booking_request_submitted'),(7,'booking_request_submitted'),
    (8,'booking_request_submitted'),(9,'booking_request_submitted'),(10,'booking_request_submitted'),
    (11,'booking_request_submitted'),(12,'booking_request_submitted');
    update booking_measurement_outbox set is_test=true where id=5;
    update booking_measurement_outbox set occurred_at='2026-11-02' where id=6;
    update booking_measurement_outbox set created_at='2026-11-02' where id=7;
    update booking_measurement_outbox set provider='google_ads_offline' where id=8;
    update booking_measurement_outbox set status='sending',claimed_at=now()-interval '20 minutes' where id=9;
    update booking_measurement_outbox set status='submitted',attempts=1 where id=10;
    update booking_measurement_outbox set status='validated' where id=11;
    update booking_measurement_outbox set status='suppressed',last_error='request_send_outcome_unknown' where id=12;
    update booking_measurement_outbox set status='sending',claimed_at=now()-interval '20 minutes' where id=2;`);
  const all = async () => (await db.query('select * from booking_measurement_outbox order by id')).rows;
  const before = await all();
  const claimed = (await db.query('select * from claim_booking_request_measurements($1,10)', [cutoff])).rows;
  check(JSON.stringify(claimed.map(x => x.id).sort((a,b) => a-b)) === '[1,10]');
  check(claimed.find(x => x.id === 1).status === 'sending');
  check(claimed.find(x => x.id === 10).status === 'submitted');
  check(claimed.find(x => x.id === 10).attempts === 1 && claimed.find(x => x.id === 10).status_checks === 1);
  const after = await all();
  for (const id of [2,3,4,5,6,7,8,11,12]) {
    check(JSON.stringify(before.find(x => x.id === id)) === JSON.stringify(after.find(x => x.id === id)));
  }
  check(after.find(x => x.id === 9).status === 'suppressed');
  check(after.find(x => x.id === 9).last_error === 'request_send_outcome_unknown');
  check((await db.query('select * from claim_booking_request_measurements($1,10)', [cutoff])).rows.length === 0);
  await assert.rejects(db.query('select * from claim_booking_request_measurements(null,10)')); checks++;
  await assert.rejects(db.query("select * from claim_booking_request_measurements('-infinity',10)")); checks++;
  for (const role of ['anon','authenticated']) {
    check(!(await db.query("select has_function_privilege($1,'public.claim_booking_request_measurements(timestamptz,integer)','execute') as allowed", [role])).rows[0].allowed);
  }
  check((await db.query("select has_function_privilege('service_role','public.claim_booking_request_measurements(timestamptz,integer)','execute') as allowed")).rows[0].allowed);
  check((await db.query("select proconfig from pg_proc where proname='claim_booking_request_measurements'")).rows[0].proconfig.includes('search_path=public, pg_temp'));
  console.log(`PASS ${checks} local SQL checks; no external database/provider used. Repeat-claim tested; multi-connection concurrency not exercised.`);
} finally { await db.close(); }
