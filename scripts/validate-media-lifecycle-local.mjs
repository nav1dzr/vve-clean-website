// Disposable PostgreSQL lifecycle proof. No application env, credentials or cloud.
// Usage: node scripts/validate-media-lifecycle-local.mjs --run
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

if (!process.argv.includes('--run')) { console.log('Skipped: pass --run to use a fresh localhost-only PostgreSQL cluster.'); process.exit(0); }
const repo = fileURLToPath(new URL('../', import.meta.url));
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const out = resolve(repo, 'admin/output/media-lifecycle-' + Date.now());
const data = join(out, 'pgdata');
const port = '55478';
const user = 'vve_media_synthetic';
await mkdir(out, { recursive: true });
async function run(name, args, input) {
  return new Promise((yes, no) => {
    const child = spawn(join(bin, name + '.exe'), args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); no(new Error(name + ' timed out')); }, 60000);
    child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('error', e => { clearTimeout(timer); no(e); });
    // On Windows the server inherits pg_ctl's pipe handles, so its `close`
    // event waits for PostgreSQL shutdown. pg_ctl's own exit is the start proof.
    child.on(name === 'pg_ctl' ? 'exit' : 'close', code => { clearTimeout(timer); code === 0 ? yes(stdout.trim()) : no(new Error(stderr.trim() || stdout.trim())); });
    child.stdin.end(input);
  });
}
const sql = text => run('psql', ['-X', '-q', '-t', '-A', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '-'], text);
const lit = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = async text => JSON.parse(await sql(text));
const checks = [];
const admin = '11111111-1111-4111-8111-111111111111';
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
const migrations = [
  '20260902090000_add_crm_media_library.sql', '20260908110000_media_publication.sql',
  '20260913120000_media_completion_references.sql', '20261105120000_media_position_unpublish.sql',
];
let started = false;
try {
  await run('initdb', ['-D', data, '-U', user, '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  await run('pg_ctl', ['-D', data, '-l', join(out, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start']);
  started = true;
  assert.equal(resolve(await sql("select current_setting('data_directory')")).toLowerCase(), resolve(data).toLowerCase());
  await sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE TABLE public.admin_users(id uuid PRIMARY KEY); INSERT INTO admin_users VALUES (' + lit(admin) + ');');
  for (const file of migrations) await sql(await readFile(resolve(repo, 'supabase/migrations', file), 'utf8'));
  const slot = await sql("SELECT id FROM media_gallery_slots WHERE topic_key='carpet' AND slot_code='BA01'");
  const videoSlot = await sql("SELECT id FROM media_gallery_slots WHERE topic_key='carpet' AND slot_code='VIDEO01'");
  const ids = Array.from({ length: 4 }, () => randomUUID());
  for (let i = 0; i < ids.length; i++) await sql("INSERT INTO media_assets(id,media_type,status,original_filename,original_content_type,original_size_bytes,r2_key,delivery_url,title,alt_text,category,before_after) VALUES(" + lit(ids[i]) + ",'image','ready','TEST-ONLY.jpg','image/jpeg',100," + lit(ids[i]) + ",'https://example.invalid/image/{width}/test.jpg','TEST ONLY','Synthetic photo','carpet'," + lit(i % 2 ? 'after' : 'before') + ');');
  const pair = n => [{ assetId: ids[n + 1], role: 'after' }, { assetId: ids[n], role: 'before' }];
  const publishSQL = (target, next, expected) => 'SELECT publish_media_position(\'gallery\',' + lit(target) + ',' + lit(JSON.stringify(next)) + '::jsonb,' + lit(JSON.stringify(expected)) + '::jsonb,' + lit(admin) + ')';
  const publish = (target, next, expected) => sql(publishSQL(target, next, expected));
  const assignments = () => json('SELECT coalesce(json_agg(json_build_object(\'assetId\',asset_id,\'role\',media_role) ORDER BY media_role),\'[]\') FROM media_assignments WHERE gallery_slot_id=' + lit(slot));
  const removeSQL = expected => 'SELECT unpublish_media_position(\'gallery\',' + lit(slot) + ',' + lit(JSON.stringify(expected)) + '::jsonb,' + lit(admin) + ')';

  await check('Four migrations execute; complete pair is shared with gallery and service pages', async () => {
    await publish(slot, pair(0), []);
    const pages = await json('SELECT json_agg(DISTINCT page_key) FROM public_media_references()');
    assert(pages.includes('gallery-carpet')); assert(pages.includes('carpet-main-results'));
    assert.deepEqual(await assignments(), pair(0));
  });
  await check('Incomplete pair is rejected without changing current publication', async () => {
    await assert.rejects(() => publish(slot, pair(2).slice(0, 1), pair(0)), /assignment|selection|Choose|media/i);
    assert.deepEqual(await assignments(), pair(0));
  });
  await check('Replacement is atomic; stale reviewed selection cannot overwrite it', async () => {
    await publish(slot, pair(2), pair(0));
    await assert.rejects(() => publish(slot, pair(0), pair(0)), /Position changed/);
    assert.deepEqual(await assignments(), pair(2));
  });
  await check('Previous assignment is retained and can be restored', async () => {
    const history = await json('SELECT previous_assignments FROM media_publication_history WHERE target_id=' + lit(slot) + ' ORDER BY created_at DESC LIMIT 1');
    assert.deepEqual(history, pair(0)); await publish(slot, history, pair(2));
    assert.deepEqual(await assignments(), pair(0));
  });
  await check('Archive refuses a published image; unused images archive and restore', async () => {
    await assert.rejects(() => sql('SELECT archive_media_asset(' + lit(ids[0]) + ',' + lit(admin) + ',false)'), /Replace its published/);
    await sql('SELECT archive_media_asset(' + lit(ids[2]) + ',' + lit(admin) + ',false)');
    assert.equal(await sql('SELECT status FROM media_assets WHERE id=' + lit(ids[2])), 'archived');
    await sql('SELECT archive_media_asset(' + lit(ids[2]) + ',' + lit(admin) + ',true)');
  });
  await check('Anonymous public reads omit private keys and deny publishing/removal', async () => {
    const rows = await json('SET ROLE anon; SELECT json_agg(r) FROM public_media_references() r');
    assert(rows.length > 0); assert(rows.every(r => !('r2_key' in r) && !('original_filename' in r)));
    await assert.rejects(() => sql('SET ROLE anon; ' + publishSQL(slot, pair(2), pair(0))), /permission denied/);
    for (const role of ['anon', 'authenticated']) await assert.rejects(() => sql('SET ROLE ' + role + ';' + removeSQL(pair(0))), /permission denied/);
  });
  await check('Concurrent unpublish creates one removal; original files are retained', async () => {
    const results = await Promise.all([json(removeSQL(pair(0))), json(removeSQL(pair(0)))]);
    assert.equal(results.filter(r => r.unchanged).length, 1);
    assert.deepEqual(await assignments(), []);
    assert.equal(Number(await sql('SELECT count(*) FROM media_assets WHERE id IN (' + ids.map(lit).join(',') + ')')), 4);
    assert.equal(Number(await sql('SELECT count(*) FROM media_publication_history WHERE target_id=' + lit(slot) + " AND published_assignments='[]'::jsonb")), 1);
  });
  await check('Unpublished pair restores via normal transaction; repeated stale publish is refused', async () => {
    await publish(slot, pair(0), []); assert.deepEqual(await assignments(), pair(0));
    await assert.rejects(() => publish(slot, pair(2), []), /Position changed/);
  });
  await check('History write failure rolls back unpublish', async () => {
    await sql("CREATE FUNCTION fail_test_history() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic failure'; END$$; CREATE TRIGGER fail_test_history BEFORE INSERT ON media_publication_history FOR EACH ROW EXECUTE FUNCTION fail_test_history();");
    try { await assert.rejects(() => sql(removeSQL(pair(0))), /Synthetic failure/); }
    finally { await sql('DROP TRIGGER fail_test_history ON media_publication_history; DROP FUNCTION fail_test_history();'); }
    assert.deepEqual(await assignments(), pair(0));
  });
  await check('Video placement accepts only ready video with playback reference', async () => {
    const id = randomUUID();
    await sql("INSERT INTO media_assets(id,media_type,status,original_filename,original_content_type,original_size_bytes,r2_key,title,alt_text,category) VALUES(" + lit(id) + ",'video','processing','TEST-ONLY.mp4','video/mp4',100," + lit(id) + ",'TEST ONLY','Synthetic video','carpet');");
    const next = [{ assetId: id, role: 'primary' }];
    await assert.rejects(() => publish(videoSlot, next, []), /ready media/);
    await sql("UPDATE media_assets SET status='ready' WHERE id=" + lit(id));
    await assert.rejects(() => publish(videoSlot, next, []), /Wrong media type/);
    await sql("UPDATE media_assets SET mux_playback_id='SYNTHETIC-NOT-A-REAL-PLAYBACK-ID' WHERE id=" + lit(id));
    await publish(videoSlot, next, []);
    assert.equal(Number(await sql('SELECT count(*) FROM media_assignments WHERE gallery_slot_id=' + lit(videoSlot))), 1);
    await assert.rejects(() => publish(videoSlot, [{ assetId: ids[2], role: 'primary' }], next), /Wrong media type/);
  });
  const evidence = { testId: 'VVE-LOCAL-MEDIA-LIFECYCLE-20261117', passed: checks.length, failed: 0, engine: 'Isolated PostgreSQL 18', migrations, checks, externalProviderCalls: 0, limitations: 'SQL transaction proof only; no R2/Mux/browser playback or cloud publishing proof.' };
  await writeFile(join(out, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, evidencePath: join(out, 'result.json') }, null, 2));
} finally {
  if (started) await run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
}
