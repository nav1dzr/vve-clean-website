/** Disposable PostgreSQL validation. No database URL, customer data or external services.
 * node scripts/validate-booking-ga4-db.mjs --pglite /local/path/pglite/dist/index.js
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const option = process.argv.indexOf('--pglite');
const supplied = option >= 0 ? process.argv[option + 1] : process.env.PGLITE_MODULE;
if (option >= 0 && !supplied) throw new Error('--pglite needs a local module path');
const moduleName = supplied ? (supplied.startsWith('file:') ? supplied : pathToFileURL(resolve(supplied)).href) : '@electric-sql/pglite';
const { PGlite } = await import(moduleName);
const db = new PGlite();
const checks = [];
const check = async (name, action) => { await action(); checks.push(name); console.log(`PASS ${name}`); };
const id = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const context = (extra = {}) => ({
  client_id: '123456.654321', session_id: String(Math.floor(Date.now() / 1000)),
  measurement_id: 'G-TEST1234',
  captured_at: new Date().toISOString(), consent_recorded_at: new Date().toISOString(),
  analytics: true, advertising: false, consent_version: '2026-07-14', mode: 'live', ...extra,
});
const addBooking = async (n, ctx = context(), extraTest = false) => {
  await db.query('insert into bookings(id,ga4_context,measurement_is_test) values($1,$2,$3)', [id(n), ctx, extraTest]);
  await db.query("insert into booking_journeys(booking_id,checkout_kind) values($1,'deposit')", [id(n)]);
};
const outbox = async (n) => (await db.query('select * from booking_ga4_measurement_outbox where booking_id=$1 order by created_at', [id(n)])).rows;
const pay = async (n, external = `cs_live_synthetic_${n}`, kind = 'deposit', amount = 4275) => {
  await db.query('insert into booking_journey_payments(external_id,booking_id,kind,amount_pence,currency) values($1,$2,$3,$4,$5)',
    [external, id(n), kind, amount, 'gbp']);
};
const checkout = async (n, amount = 1725, reference = `cs_live_synthetic_${n}`) => {
  await db.query(`insert into booking_journey_events(booking_id,revision,actor,event_type,details)
    values($1,1,'system','checkout_ready',$2)`, [id(n), { changes: { checkout_id: reference, ga4_checkout_amount_pence: amount } }]);
};

try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create table public.bookings (
      id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(), booking_ref text,
      payment_status text not null default 'pending_payment', deposit_amount numeric default 0,
      full_name text,email text,phone text,address text,postcode text,service text,
      preferred_date text,preferred_time text,service_date date,total_price numeric,balance_status text,
      balance_paid_at timestamptz,balance_payment_method text,status text,first_source text,last_source text,
      landing_page text,utm_source text,utm_medium text,utm_campaign text,utm_content text,gclid text
    );
    -- The released bookings policy removes direct browser reads. Reproduce it
    -- here so the additive analytics column is tested under the existing RLS.
    alter table public.bookings enable row level security;
  `);
  for (const name of [
    '20260908100000_booking_journey.sql','20260908120000_request_reliability.sql',
    '20260916183000_booking_confirmation_channels.sql','20260917120000_booking_measurement_outbox.sql',
    '20260924120000_booking_measurement_canonical_events.sql',
  ]) await db.exec(await readFile(resolve('supabase/migrations', name), 'utf8'));
  await db.query('insert into bookings(id,booking_ref) values($1,$2)', [id(99), 'HISTORICAL-SYNTHETIC']);
  await db.query('insert into booking_journeys(booking_id) values($1)', [id(99)]);
  await pay(99);
  const historical = (await db.query('select * from bookings where id=$1', [id(99)])).rows[0];
  const migration = await readFile(resolve('supabase/migrations/20261004120000_booking_ga4_measurement.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration);

  await check('additive migration is repeatable, preserves historical data and performs no backfill', async () => {
    const after = (await db.query('select * from bookings where id=$1', [id(99)])).rows[0];
    for (const key of Object.keys(historical)) assert.deepEqual(after[key], historical[key]);
    assert.equal(after.ga4_context, null);
    assert.equal((await outbox(99)).length, 0);
  });

  await check('committed deposit checkout emits one event across repeated checkout attempts, at its real amount', async () => {
    await addBooking(1); await checkout(1); await checkout(1, 1725, 'cs_live_second_attempt');
    const rows = await outbox(1);
    assert.equal(rows.length, 1); assert.equal(rows[0].event_name, 'begin_checkout');
    assert.equal(rows[0].amount_pence, 1725); assert.equal(rows[0].status, 'pending');
    assert.equal(rows[0].analytics_context.advertising, false);
    assert.equal(rows[0].analytics_context.measurement_id, 'G-TEST1234');
  });

  await check('authoritative deposit ledger emits one purchase; duplicate payment transaction is rejected', async () => {
    await pay(1); await assert.rejects(pay(1), /duplicate key/);
    const rows = await outbox(1); assert.equal(rows.length, 2);
    const purchase = rows.find((r) => r.event_name === 'purchase');
    assert.equal(purchase.amount_pence, 4275); assert.equal(purchase.event_key, `booking:${id(1)}:purchase`);
    await pay(1, 'cs_live_second_deposit');
    assert.equal((await outbox(1)).filter((r) => r.event_name === 'purchase').length, 1);
  });

  await check('bank deposits never copy a manual reference or raw context into analytics', async () => {
    await addBooking(2, context({ email: 'synthetic@example.invalid', address: '1 Synthetic Road',
      postcode: 'ZZ99 9ZZ', private_link: '/manage#private' }));
    await pay(2, 'bank-reference-ZZ999ZZ-Synthetic-Person', 'manual_deposit', 2250);
    const rows = await outbox(2); assert.equal(rows[0].amount_pence, 2250);
    const serialized = JSON.stringify(rows);
    for (const value of ['synthetic@example', 'Synthetic Road', 'ZZ99', 'private_link', 'bank-reference'])
      assert.ok(!serialized.includes(value), `Unexpected private value ${value}`);
  });

  await check('balance payments, refunds and balance checkout never enter the deposit funnel', async () => {
    await addBooking(3);
    await db.query("update booking_journeys set checkout_kind='balance' where booking_id=$1", [id(3)]);
    await checkout(3); await pay(3, 'cs_live_balance', 'balance'); await pay(3, 'refund-id', 'refund');
    assert.equal((await outbox(3)).length, 0);
  });

  await check('unconfigured existing bookings generate no GA4 rows on future checkout/payment', async () => {
    await addBooking(4, null); await checkout(4); await pay(4);
    assert.equal((await outbox(4)).length, 0);
  });

  await check('denied consent, test bookings and Stripe test payments are suppressed', async () => {
    await addBooking(5, context({ analytics: false })); await pay(5);
    await addBooking(6, context(), true); await pay(6);
    await addBooking(7); await checkout(7, 3000, 'cs_test_synthetic_7'); await pay(7, 'cs_test_synthetic_7');
    for (const n of [5, 6, 7]) for (const row of await outbox(n)) {
      assert.equal(row.status, 'suppressed'); assert.deepEqual(row.analytics_context, {});
    }
  });

  await check('rollback of a payment also rolls back GA4 and Ads measurement rows', async () => {
    await addBooking(8); await db.exec('begin'); await pay(8); await db.exec('rollback');
    assert.equal((await outbox(8)).length, 0);
    assert.equal((await db.query('select * from booking_journey_payments where booking_id=$1', [id(8)])).rows.length, 0);
  });

  await check('claims are locked, mode-specific and never auto-promote validation data', async () => {
    await addBooking(9, context({ mode: 'validate' })); await pay(9);
    const live = (await db.query("select * from claim_booking_ga4_measurements('live',25)")).rows;
    assert.ok(live.length > 0); assert.ok(live.every((r) => r.mode === 'live'));
    assert.equal((await db.query("select * from claim_booking_ga4_measurements('live',25)")).rows.length, 0);
    const validation = (await db.query("select * from claim_booking_ga4_measurements('validate',25)")).rows;
    assert.equal(validation.length, 1); assert.equal(validation[0].booking_id, id(9));
    await db.query("update booking_ga4_measurement_outbox set status='validated' where booking_id=$1", [id(9)]);
    assert.equal((await db.query("select * from claim_booking_ga4_measurements('live',25)")).rows.length, 0);
  });

  await check('stale checkout send becomes uncertain; stale purchase may retry with its stable transaction', async () => {
    await db.query("update booking_ga4_measurement_outbox set claimed_at=now()-interval '11 minutes' where booking_id=$1", [id(1)]);
    const claims = (await db.query("select * from claim_booking_ga4_measurements('live',25)")).rows;
    assert.ok(claims.some((r) => r.booking_id === id(1) && r.event_name === 'purchase'));
    assert.ok(!claims.some((r) => r.event_name === 'begin_checkout'));
    assert.equal((await outbox(1)).find((r) => r.event_name === 'begin_checkout').status, 'uncertain');
  });

  await check('existing withdrawal RPC suppresses GA4 and clears identity without replacing Ads behavior', async () => {
    await db.query('select withdraw_booking_measurement_consent($1)', [id(1)]);
    const rows = await outbox(1);
    assert.equal(rows.find((r) => r.event_name === 'purchase').status, 'suppressed');
    assert.ok(rows.every((r) => Object.keys(r.analytics_context).length === 0));
    assert.equal((await db.query('select ga4_context from bookings where id=$1', [id(1)])).rows[0].ga4_context, null);
  });

  await check('marking a booking as test erases GA4 identity and unmarking does not replay it', async () => {
    await addBooking(12); await pay(12);
    await db.query('update bookings set measurement_is_test=true where id=$1', [id(12)]);
    assert.equal((await outbox(12))[0].status, 'suppressed');
    assert.equal((await db.query('select ga4_context from bookings where id=$1', [id(12)])).rows[0].ga4_context, null);
    await db.query('update bookings set measurement_is_test=false where id=$1', [id(12)]);
    await checkout(12);
    assert.equal((await outbox(12)).length, 1); assert.equal((await outbox(12))[0].status, 'suppressed');
  });

  await check('retention expires unsent events at 72h and clears old identities', async () => {
    await addBooking(10); await pay(10);
    await db.query("update booking_ga4_measurement_outbox set occurred_at=now()-interval '73 hours' where booking_id=$1", [id(10)]);
    await db.query('select purge_expired_booking_ga4_measurement()');
    const r = (await outbox(10))[0]; assert.equal(r.status, 'suppressed'); assert.equal(r.last_error, 'ga4_event_expired');
    assert.deepEqual(r.analytics_context, {});
  });

  await check('analytics failures cannot roll back a successful authoritative payment', async () => {
    await addBooking(11);
    await db.exec("alter table booking_ga4_measurement_outbox add constraint simulated_outage check (amount_pence <> 9999)");
    await pay(11, 'cs_live_synthetic_11', 'deposit', 9999);
    assert.equal((await outbox(11)).length, 0);
    const ledger = (await db.query('select amount_pence from booking_journey_payments where booking_id=$1', [id(11)])).rows;
    assert.equal(ledger[0].amount_pence, 9999);
  });

  await check('anonymous and authenticated users cannot read or claim the GA4 outbox', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from booking_ga4_measurement_outbox'), /permission denied/);
      await assert.rejects(db.query("select * from claim_booking_ga4_measurements('live',10)"), /permission denied/);
      assert.equal((await db.query('select ga4_context from bookings')).rows.length, 0);
      await db.exec('reset role');
    }
  });
  console.log(`GA4 PostgreSQL validation passed: ${checks.length} checks. No external services contacted.`);
} finally { await db.close(); }
