// Local disposable PostgreSQL only. No database URLs, credentials or external APIs.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
if (!process.argv.includes('--run')) { console.log('Skipped: pass --run for the disposable localhost database.'); process.exit(0); }
const psql = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const args = ['-X','-q','-t','-A','-h','127.0.0.1','-p','55469','-U','vve_allocation_test','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'];
async function sql(text) {
  return new Promise((yes,no) => {
    const child=spawn(psql,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{child.kill();no(new Error('Local SQL test timed out'));},30000);
    child.stdout.on('data',c=>{out+=c;});child.stderr.on('data',c=>{err+=c;});
    child.on('error',e=>{clearTimeout(timer);no(e);});
    child.on('close',code=>{clearTimeout(timer);code===0?yes(out.trim()):no(new Error(err.trim()));});
    child.stdin.end(text);
  });
}
const lit = v => "'"+String(v).replaceAll("'","''")+"'";
const json = async (query) => {
  const result = await sql(query);
  return result === '' ? null : JSON.parse(result);
};
const admin='11111111-1111-4111-8111-111111111111';
const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
const clusterDirectory=process.argv[process.argv.indexOf('--cluster-directory')+1];
if(!process.argv.includes('--cluster-directory')||!clusterDirectory) throw new Error('Supply the disposable cluster directory.');
const connectedDirectory=await sql("select current_setting('data_directory')");
if(resolve(connectedDirectory).toLowerCase()!==resolve(clusterDirectory).toLowerCase()) throw new Error('Refusing to use a different PostgreSQL cluster.');
const database='vve_media_'+Date.now();
await sql('create database '+database);
args[args.indexOf('-d')+1]=database;

await sql("do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end$$;");
await sql("create table public.admin_users(id uuid primary key); insert into admin_users values(" + lit(admin) + ");");
for (const path of [
  'supabase/migrations/20260902090000_add_crm_media_library.sql',
  'supabase/migrations/20260908110000_media_publication.sql',
  'supabase/migrations/20261105120000_media_position_unpublish.sql',
]) await sql(await readFile(resolve(path), 'utf8'));

async function fixture() {
  const slot = randomUUID(), secondSlot = randomUUID(), asset = randomUUID(), other = randomUUID();
  // Use a website slot so each test gets a unique position without gallery
  // code limits. Two references prove a shared asset remains published elsewhere.
  for (const id of [slot, secondSlot]) {
    await sql("insert into media_website_slots(id,slot_key,page_label,purpose_label) values(" + lit(id) + "," + lit(id) + ",'Sample page','Sample photo');" +
      "insert into media_page_references(reference_key,page_key,page_label,component_label,website_slot_id) values(" +
      lit(id) + "," + lit(id) + ",'Sample page','Sample photo'," + lit(id) + ");");
  }
  for (const id of [asset, other]) await sql(
    "insert into media_assets(id,media_type,status,original_filename,original_content_type,original_size_bytes,r2_key,title,alt_text,category,delivery_url) values(" +
    lit(id) + ",'image','ready','sample.jpg','image/jpeg',100," + lit(id) + ",'Sample photo','Sample description','carpet','https://example.invalid/sample.jpg');");
  const assignments = [{assetId: asset, role: 'primary'}];
  for (const id of [slot, secondSlot]) await sql("select publish_media_position('website'," + lit(id) + "," + lit(JSON.stringify(assignments)) + "::jsonb,'[]'::jsonb," + lit(admin) + ")");
  return {slot, secondSlot, asset, other, assignments};
}
const removeSQL = (f, expected = f.assignments) =>
  "select unpublish_media_position('website'," + lit(f.slot) + "," + lit(JSON.stringify(expected)) + "::jsonb," + lit(admin) + ")";
const remove = (f, expected) => json(removeSQL(f, expected));
await check('Anonymous and authenticated roles cannot remove a published position', async () => {
  const f = await fixture();
  for (const role of ['anon','authenticated']) await assert.rejects(() => sql('set role ' + role + ';' + removeSQL(f)), /permission denied/);
});
await check('Unpublish removes only the target reference, retaining files and other uses', async () => {
  const f = await fixture();
  assert.equal((await remove(f)).unpublished, true);
  assert.equal(await json("select count(*) from public_media_references() where page_key=" + lit(f.slot)), 0);
  assert.equal(await json("select count(*) from public_media_references() where page_key=" + lit(f.secondSlot)), 1);
  assert.equal(await json("select count(*) from media_assets where id=" + lit(f.asset)), 1);
  const history = await json("select previous_assignments from media_publication_history where target_id=" + lit(f.slot) + " and published_assignments='[]'::jsonb");
  assert.deepEqual(history, f.assignments);
});
await check('Lost-response retry and real concurrent removals create one removal history entry', async () => {
  const f = await fixture();
  const results = await Promise.all([remove(f), remove(f)]);
  assert.equal(results.filter((r) => r.unchanged === true).length, 1);
  assert.equal((await remove(f)).unchanged, true);
  assert.equal(await json("select count(*) from media_publication_history where target_id=" + lit(f.slot) + " and published_assignments='[]'::jsonb"), 1);
});
await check('A stale reviewed selection cannot remove a replacement', async () => {
  const f = await fixture();
  const next = [{assetId:f.other,role:'primary'}];
  await sql("select publish_media_position('website'," + lit(f.slot) + "," + lit(JSON.stringify(next)) + "::jsonb," +
    lit(JSON.stringify(f.assignments)) + "::jsonb," + lit(admin) + ")");
  await assert.rejects(() => remove(f), /Position changed/);
  assert.equal(await json("select count(*) from public_media_references() where page_key=" + lit(f.slot)), 1);
});
await check('History failure rolls back removal and keeps its public reference', async () => {
  const f = await fixture();
  await sql("create function synthetic_history_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic history failure';end$$; create trigger fail_history before insert on media_publication_history for each row execute function synthetic_history_failure();");
  try { await assert.rejects(() => remove(f), /Synthetic history failure/); }
  finally { await sql('drop trigger fail_history on media_publication_history; drop function synthetic_history_failure();'); }
  assert.equal(await json("select count(*) from public_media_references() where page_key=" + lit(f.slot)), 1);
});
await check('Previous media can be restored through the existing publication transaction', async () => {
  const f = await fixture();
  await remove(f);
  await sql("select publish_media_position('website'," + lit(f.slot) + "," + lit(JSON.stringify(f.assignments)) + "::jsonb,'[]'::jsonb," + lit(admin) + ")");
  assert.equal(await json("select count(*) from public_media_references() where page_key=" + lit(f.slot)), 1);
});
console.log(JSON.stringify({passed:checks.length,failed:0,engine:'Isolated PostgreSQL 18, independent localhost sessions',checks},null,2));
