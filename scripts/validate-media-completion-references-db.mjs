import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Uses an existing local PGlite module. No application credentials or network.
const option = process.argv.indexOf('--pglite');
if (option >= 0 && !process.argv[option+1]) throw new Error('--pglite requires a local module path');
const { PGlite } = await import(option >= 0 ? pathToFileURL(resolve(process.argv[option+1])).href : '@electric-sql/pglite');
process.on('uncaughtException',error=>{console.error(error.message);process.exit(1);});

const db = new PGlite();
const repo = fileURLToPath(new URL('../',import.meta.url));
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.admin_users(id uuid PRIMARY KEY)');
for (const file of ['20260902090000_add_crm_media_library.sql','20260908110000_media_publication.sql']) {
  await db.exec(readFileSync(repo+'supabase/migrations/'+file,'utf8'));
}
const admin='11111111-1111-4111-8111-111111111111';
await db.query('INSERT INTO admin_users(id) VALUES($1)',[admin]);
const before='22222222-2222-4222-8222-222222222222';
const after='33333333-3333-4333-8333-333333333333';
for (const [id,stage] of [[before,'before'],[after,'after']]) {
  await db.query("INSERT INTO media_assets(id,media_type,status,original_filename,original_content_type,original_size_bytes,r2_key,delivery_url,title,alt_text,category,before_after) VALUES($1::uuid,'image','ready','fixture.jpg','image/jpeg',100,$1::text,'https://example.test/image/{width}/fixture.jpg','Carpet comparison','Local SQL fixture','carpet',$2)",[id,stage]);
}
const slot=(await db.query("SELECT id FROM media_gallery_slots WHERE topic_key='carpet' AND slot_code='BA01'")).rows[0].id;
await db.query('SELECT publish_media_position($1,$2,$3::jsonb,$4::jsonb,$5)',['gallery',slot,JSON.stringify([{assetId:after,role:'after'},{assetId:before,role:'before'}]),'[]',admin]);
// An already configured alias has owner-controlled wording/order; preserve it.
await db.query("INSERT INTO media_page_references(reference_key,page_key,page_label,component_label,gallery_slot_id,sort_order) VALUES('existing-carpet-placement','carpet-main-results','Existing custom title','Existing component',$1,101)",[slot]);
const snapshot=async(table)=>(await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
const refsBefore=await snapshot('media_page_references');
const assetsBefore=await snapshot('media_assets');
const assignmentsBefore=await snapshot('media_assignments');
const sql=readFileSync(new URL('../supabase/migrations/20260913120000_media_completion_references.sql',import.meta.url),'utf8');
await db.exec('BEGIN;'+sql+'COMMIT;');
const refsAfter=await snapshot('media_page_references');
assert.equal(refsAfter.length-refsBefore.length,16);
for(const row of refsBefore) assert.deepEqual(refsAfter.find(next=>next.id===row.id),row);
assert.deepEqual(await snapshot('media_assets'),assetsBefore);
assert.deepEqual(await snapshot('media_assignments'),assignmentsBefore);
await db.exec(sql);
assert.deepEqual(await snapshot('media_page_references'),refsAfter);
const expected=new Map([['carpet-main-results',5],['sofa-main-results',5],['end-of-tenancy-main-results',5],['homepage-hero-image',1],['homepage-equipment-image',1]]);
for(const[key,count]of expected) assert.equal(refsAfter.filter(row=>row.page_key===key).length,count);
const publicRows=(await db.query('SELECT * FROM public_media_references()')).rows;
assert.equal(publicRows.filter(row=>row.page_key==='carpet-main-results').length,2);
assert.equal(publicRows.filter(row=>row.page_key==='gallery-carpet').length,2);
assert(publicRows.every(row=>!('r2_key'in row)&&!('original_filename'in row)));
await db.exec('SET ROLE anon');
assert.equal((await db.query('SELECT * FROM public_media_references()')).rows.length,6);
let denied=false;
try{await db.query("INSERT INTO media_page_references(reference_key,page_key,page_label,component_label,gallery_slot_id) VALUES('forbidden','forbidden','forbidden','forbidden',$1)",[slot]);}catch{denied=true;}
assert(denied);
await db.close();
console.log('PASS: 17 expected mappings; preserves existing reference/asset/assignment rows; idempotent; shared published pair appears at actual website key; public read contract unchanged; anonymous writes denied.');
