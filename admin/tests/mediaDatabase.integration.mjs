process.on("uncaughtException", error => { console.error(error.message, error.position || "", error.where || ""); process.exit(1); });
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.admin_users(id uuid PRIMARY KEY);');
const root = new URL('../../', import.meta.url);
for(const name of ['20260902090000_add_crm_media_library.sql','20260908110000_media_publication.sql']) {
 await db.exec(readFileSync(new URL('supabase/migrations/'+name, root),'utf8'));
 console.log('Applied locally:', name);
}
const admin = '11111111-1111-1111-1111-111111111111';
await db.query('INSERT INTO admin_users(id) VALUES($1)',[admin]);
const slot = (await db.query("SELECT id FROM media_gallery_slots WHERE topic_key='carpet' AND slot_code='BA01'")).rows[0].id;
const ids = ['11111111-2222-3333-4444-555555555555','22222222-2222-3333-4444-555555555555','33333333-2222-3333-4444-555555555555','44444444-2222-3333-4444-555555555555'];
for(let i=0;i<ids.length;i++) await db.query("INSERT INTO media_assets(id,media_type,status,original_filename,original_content_type,original_size_bytes,r2_key,delivery_url,title,alt_text,category,before_after) VALUES($1::uuid,'image','ready','photo.jpg','image/jpeg',100,$1::text,'https://image.example/{width}/photo.jpg','Carpet clean','Carpet cleaning result','carpet',$2)",[ids[i], i%2 ? 'after' : 'before']);
const pair = (start) => [{assetId:ids[start+1],role:'after'},{assetId:ids[start],role:'before'}];
const publish = (next,expected) => db.query('SELECT publish_media_position($1,$2,$3::jsonb,$4::jsonb,$5)', ['gallery',slot,JSON.stringify(next),JSON.stringify(expected),admin]);
await publish(pair(0),[]);
const first = await db.query('SELECT * FROM public_media_references()');
if(first.rows.length !== 4) throw new Error('Gallery and service page did not both get complete pair');
await publish(pair(2),pair(0));
let stale=false;
try {await publish(pair(0),pair(0));}catch(error){stale=error.message.includes('Position changed');}
if(!stale)throw new Error('Stale position was not rejected');
const rows=(await db.query('SELECT previous_assignments FROM media_publication_history ORDER BY created_at DESC LIMIT 1')).rows;
await publish(rows[0].previous_assignments,pair(2));
const final=(await db.query('SELECT asset_id FROM media_assignments WHERE gallery_slot_id=$1',[slot])).rows;
if(!final.every(row=>ids.slice(0,2).includes(row.asset_id)))throw new Error('Rollback failed');
let archiveBlocked=false;
try{await db.query('SELECT archive_media_asset($1,$2,false)',[ids[0],admin]);}catch(error){archiveBlocked=error.message.includes('Replace its published');}
if(!archiveBlocked)throw new Error('In-use archive not blocked');
await db.query('SELECT archive_media_asset($1,$2,false)',[ids[2],admin]);
await db.query('SELECT archive_media_asset($1,$2,true)',[ids[2],admin]);
await db.exec('SET ROLE anon');
let forbidden=false;try{await publish(pair(2),pair(0));}catch(error){forbidden=error.message.includes('permission denied');}
if(!forbidden)throw new Error('Anonymous publication was not denied');
const publicRows=await db.query('SELECT * FROM public_media_references()');
if(publicRows.rows.length!==4 || 'r2_key' in publicRows.rows[0])throw new Error('Public read boundary failed');
console.log('PASS: migration execution, complete pair publication, shared references, stale guard, rollback, archive/restore, anon write denial and public-safe reads.');
await db.close();

