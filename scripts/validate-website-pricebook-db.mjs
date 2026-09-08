/**
 * Execute the actual migration against a disposable, in-memory PostgreSQL engine.
 * Run: node scripts/validate-website-pricebook-db.mjs [--pglite /path/to/pglite/dist/index.js]
 * No network connection, environment database URL, or persistent database is used.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPricingCatalogue, PRICEBOOK_PRICE_KEYS } from '../shared/pricingCatalogue.js';

const option = process.argv.indexOf('--pglite');
const moduleName = option >= 0 ? pathToFileURL(resolve(process.argv[option + 1])).href : '@electric-sql/pglite';
const { PGlite } = await import(moduleName);
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const checks = [];
const catalogue = createPricingCatalogue();
const baseline = Object.fromEntries(PRICEBOOK_PRICE_KEYS.map(key => [key, structuredClone(catalogue[key])]));
const first = '22222222-2222-4222-8222-222222222222';
const second = '33333333-3333-4333-8333-333333333333';
const third = '44444444-4444-4444-8444-444444444444';
const restored = '55555555-5555-4555-8555-555555555555';
const check = async (name, action) => { await action(); checks.push(name); };
const current = async () => (await db.query('SELECT public.get_published_website_pricebook() AS snapshot')).rows[0].snapshot;
const insert = (id, label, overrides) => db.query(
  'INSERT INTO public.website_pricebook_versions(id,label,overrides,created_by) VALUES ($1,$2,$3,$4)',
  [id, label, JSON.stringify(overrides), admin],
);
const publish = (id, expected, by = admin) => db.query(
  'SELECT public.publish_website_pricebook($1,$2,$3) AS publication', [id, expected, by],
);
const denied = action => assert.rejects(action, /permission denied|row-level security/i);

try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    -- Exercise the broad default grants a hosted Supabase project may supply.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY);
    INSERT INTO public.admin_users VALUES ('${admin}');
    CREATE TABLE public.validation_booking_snapshot(id integer PRIMARY KEY, agreed_total_pence integer, deposit_pence integer);
    INSERT INTO public.validation_booking_snapshot VALUES (1, 27900, 3000);
  `);
  const migration = await readFile(new URL('../supabase/migrations/20260908130000_website_pricebook.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec('SET ROLE service_role');

  await check('Empty pointer returns bundled prices with no private fields', async () => {
    assert.deepEqual(await current(), { id: 'bundled', version: 'bundled', overrides: {} });
  });

  await check('Complete snapshots are valid; incomplete, malformed and protected price edits fail in SQL', async () => {
    await insert(first, 'Unchanged prices', baseline);
    const bad = [null, [], {}, { ...baseline, DEPOSIT_P: 4000 }];
    for (const amount of [-1, 0, 1.2, 100000001, '5000', null, true]) bad.push({ ...baseline, CARPET_MIN_BOOKING_P: amount });
    bad.push({ ...baseline, CARPET_ITEM_PRICES_P: { ...baseline.CARPET_ITEM_PRICES_P, unapproved: 5000 } });
    const missing = structuredClone(baseline);
    delete missing.CARPET_ITEM_PRICES_P.bedroom;
    bad.push(missing);
    const inverted = structuredClone(baseline);
    inverted.EOT_PRICES_P.flat.bed1.complete = inverted.EOT_PRICES_P.flat.bed1.tailored - 1;
    bad.push(inverted);
    for (const overrides of bad) {
      await assert.rejects(() => insert(crypto.randomUUID(), 'Invalid draft', overrides), /check constraint|not-null constraint/i);
    }
    await assert.rejects(() => insert(crypto.randomUUID(), '', baseline), /check constraint/i);
    await assert.rejects(() => insert(crypto.randomUUID(), 'x'.repeat(121), baseline), /check constraint/i);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM public.website_pricebook_versions')).rows[0].total, 1);
  });

  await check('Publishing switches one pointer and records history; public snapshot omits staff and drafts', async () => {
    await publish(first, null);
    const value = await current();
    assert.equal(value.id, first);
    assert.equal(value.version, first);
    assert.deepEqual(value.overrides, baseline);
    assert.ok(value.publishedAt);
    assert.deepEqual(Object.keys(value).sort(), ['id', 'overrides', 'publishedAt', 'version']);
    const history = (await db.query('SELECT previous_version_id,version_id,published_by,refresh_status FROM public.website_pricebook_publications')).rows;
    assert.deepEqual(history, [{ previous_version_id: null, version_id: first, published_by: admin, refresh_status: 'pending' }]);
  });

  await check('Saved prices and publication identities are immutable to the server role', async () => {
    await denied(() => db.query('UPDATE public.website_pricebook_versions SET overrides=$1 WHERE id=$2', [JSON.stringify(baseline), first]));
    await denied(() => db.query('DELETE FROM public.website_pricebook_versions WHERE id=$1', [first]));
    await denied(() => db.query('UPDATE public.website_pricebook_state SET version_id=NULL'));
    await denied(() => db.query('UPDATE public.website_pricebook_publications SET published_by=NULL'));
    await db.query("UPDATE public.website_pricebook_publications SET refresh_status='requested' WHERE version_id=$1", [first]);
    assert.equal((await current()).id, first);
  });

  await check('Anonymous and signed-in customers cannot read drafts or call staff publication functions', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`RESET ROLE; SET ROLE ${role}`);
      await denied(() => db.query('SELECT * FROM public.website_pricebook_versions'));
      await denied(() => db.query('SELECT * FROM public.website_pricebook_state'));
      await denied(() => db.query('SELECT * FROM public.website_pricebook_publications'));
      await denied(() => current());
      await denied(() => publish(first, first));
      await denied(() => insert(crypto.randomUUID(), 'Not staff', baseline));
    }
    await db.exec('RESET ROLE; SET ROLE service_role');
  });

  await check('Unknown administrators and missing versions cannot change the selected price list', async () => {
    await assert.rejects(() => publish(first, first, '66666666-6666-4666-8666-666666666666'), /Admin required/);
    await assert.rejects(() => publish('66666666-6666-4666-8666-666666666666', first), /Version not found/);
    assert.equal((await current()).id, first);
  });

  await check('Competing publishes from the same review have one winner and one conflict', async () => {
    const changed = { ...baseline, CARPET_MIN_BOOKING_P: baseline.CARPET_MIN_BOOKING_P + 100 };
    await insert(second, 'First competing review', changed);
    await insert(third, 'Second competing review', { ...changed, CARPET_MIN_BOOKING_P: changed.CARPET_MIN_BOOKING_P + 100 });
    // PGlite serializes a single connection; this checks the actual lock/CAS SQL
    // with competing calls, not independent production-connection load behavior.
    const outcomes = await Promise.allSettled([publish(second, first), publish(third, first)]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(result => result.status === 'rejected');
    assert.match(String(rejected.reason), /PRICEBOOK_CONFLICT/);
    const selected = await current();
    assert.ok([second, third].includes(selected.id));
    assert.equal((await db.query('SELECT count(*)::int AS total FROM public.website_pricebook_publications')).rows[0].total, 2);
    assert.deepEqual((await db.query('SELECT overrides FROM public.website_pricebook_versions WHERE id=$1', [first])).rows[0].overrides, baseline);
  });

  await check('Rollback records a new version and preserves every earlier price snapshot', async () => {
    const before = (await current()).id;
    await insert(restored, 'Restore unchanged prices', baseline);
    await publish(restored, before);
    const selected = await current();
    assert.equal(selected.id, restored);
    assert.deepEqual(selected.overrides, baseline);
    const entry = (await db.query('SELECT previous_version_id FROM public.website_pricebook_publications WHERE version_id=$1', [restored])).rows[0];
    assert.equal(entry.previous_version_id, before);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM public.website_pricebook_versions')).rows[0].total, 4);
  });

  await check('The additive migration and publications do not change an agreed booking amount or deposit', async () => {
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT * FROM public.validation_booking_snapshot')).rows, [{ id: 1, agreed_total_pence: 27900, deposit_pence: 3000 }]);
  });

  console.log(JSON.stringify({ engine: 'PGlite, disposable in-memory database', migration: '20260908130000_website_pricebook.sql', passed: checks.length, checks }, null, 2));
} finally {
  await db.close();
}
