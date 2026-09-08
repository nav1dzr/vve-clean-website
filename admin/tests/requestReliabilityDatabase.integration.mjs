// No network, credentials or external database: each run starts a fresh
// in-memory PostgreSQL instance. Set PGLITE_MODULE to an installed module URL
// when @electric-sql/pglite is not installed alongside this repository.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const root = new URL('../../', import.meta.url);
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.bookings(id uuid PRIMARY KEY);');
  const migration = readFileSync(new URL('supabase/migrations/20260908120000_request_reliability.sql', root), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Safe to reapply the additive migration.
  const id = '36cfe87e-c0a5-41af-bffa-3e22dd39be5b', key = 'f301d841-b86a-4d90-a1f1-c35d4e5bb270';
  const insert = () => db.query('INSERT INTO contact_enquiries(id,request_key,request_fingerprint,full_name,email,message) VALUES($1,$2,$3,$4,$5,$6)', [id, key, 'hash', 'Synthetic test', 'test@example.com', 'Synthetic enquiry']);
  await insert(); await assert.rejects(insert(), /duplicate key/);
  await db.query('INSERT INTO bookings(id,request_key) VALUES(gen_random_uuid(),$1)', [key]);
  await assert.rejects(db.query('INSERT INTO bookings(id,request_key) VALUES(gen_random_uuid(),$1)', [key]), /duplicate key/);
  await db.query('INSERT INTO bookings(id) VALUES(gen_random_uuid()),(gen_random_uuid())');
  const claim = async () => (await db.query('SELECT claim_enquiry_delivery($1) AS row', [id])).rows[0].row;
  const record = async (token, channel, result) => (await db.query('SELECT record_enquiry_delivery($1,$2,$3,$4) AS saved', [id, token, channel, result])).rows[0].saved;
  const finish = async token => (await db.query('SELECT finish_enquiry_delivery($1,$2) AS result', [id, token])).rows[0].result;
  const first = await claim(); assert(first.delivery_claim_token); assert.equal(await claim(), null);
  assert.equal(await record(first.delivery_claim_token, 'customerEmail', { status: 'sent' }), true);
  await assert.rejects(record(first.delivery_claim_token, 'arbitrary', { status: 'sent' }), /Invalid delivery/);
  await assert.rejects(record(first.delivery_claim_token, 'customerEmail', { status: 'invented' }), /Invalid delivery/);
  await assert.rejects(record(first.delivery_claim_token, 'customerEmail', { status: 'sent', detail: 'x'.repeat(2100) }), /Invalid delivery/);
  await db.query("UPDATE contact_enquiries SET delivery_claim_until=now()-interval '1 second' WHERE id=$1", [id]);
  const second = await claim(); assert.notEqual(second.delivery_claim_token, first.delivery_claim_token);
  assert.equal(second.delivery.customerEmail.status, 'sent', 'Claim must carry the latest channel state');
  assert.equal(await record(first.delivery_claim_token, 'customerEmail', { status: 'failed' }), false);
  assert.equal(await finish(first.delivery_claim_token), null, 'An old worker cannot release the new lease');
  assert.equal((await finish(second.delivery_claim_token)).customerEmail.status, 'sent');
  const third = await claim(); assert.equal(third.delivery.customerEmail.status, 'sent'); await finish(third.delivery_claim_token);
  const permissions = (await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.contact_enquiries'::regclass`)).rows[0];
  assert.equal(permissions.relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    const access = (await db.query("SELECT has_table_privilege($1,'public.contact_enquiries','SELECT') AS readable, has_function_privilege($1,'public.claim_enquiry_delivery(uuid)','EXECUTE') AS claimable, has_function_privilege($1,'public.record_enquiry_delivery(uuid,uuid,text,jsonb)','EXECUTE') AS writable, has_function_privilege($1,'public.finish_enquiry_delivery(uuid,uuid)','EXECUTE') AS finishable", [role])).rows[0];
    assert.deepEqual(access, { readable: false, claimable: false, writable: false, finishable: false });
  }
  assert.equal((await db.query("SELECT has_function_privilege('service_role','public.claim_enquiry_delivery(uuid)','EXECUTE') AS allowed")).rows[0].allowed, true);
  console.log('PASS: migration reapplied; unique request keys; fresh claims; concurrent exclusion; stale-token fencing; channel validation; partial completion durability; private-table RLS and service-only RPC permissions.');
} finally { await db.close(); }
