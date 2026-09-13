// Explicit, disposable PostgreSQL validation. Never accepts a database URL.
// node scripts/validate-invoice-financial-db.mjs --run --pglite <local module>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.argv.includes('--run')) { console.log('Skipped: pass --run to create a disposable in-memory database.'); process.exit(0); }
const option=process.argv.indexOf('--pglite');
const modulePath=option<0 ? '@electric-sql/pglite' : pathToFileURL(resolve(process.argv[option+1])).href;
const { PGlite }=await import(modulePath);
const db=new PGlite();
const admin='11111111-1111-4111-8111-111111111111';
const op=(n)=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
const checks=[];
const read=async(id)=>(await db.query('select *,updated_at::text as exact_updated_at from invoices where id=$1',[id])).rows[0];
const mutate=async(action,id,payload)=>(await db.query('select invoice_financial_mutation($1,$2,$3,$4) result',[action,id,JSON.stringify(payload),admin])).rows[0].result;
const header=(price)=>({customer_name:'Synthetic fixture',customer_email:'audit@example.invalid',subtotal:price,document_discount:0,tax_total:0,total:price,deposit_applied:0,amount_due:price,payment_option:'bank_transfer'});
const items=(price)=>[{description:'Synthetic line',quantity:1,unit_price:price,line_discount:0,line_total:price,sort_order:0}];
async function draft(price=100,source=null){
  const row=(await db.query('insert into invoices(customer_name,customer_email,subtotal,total,amount_due,revised_from_invoice_id,revision_source_updated_at) values($1,$2,$3,$3,$3,$4,$5) returning id',
    ['Synthetic fixture','audit@example.invalid',price,source?.id||null,source?.exact_updated_at||null])).rows[0];
  await db.query('insert into invoice_items(invoice_id,description,quantity,unit_price,line_total,sort_order) values($1,$2,1,$3,$3,0)',[row.id,'Synthetic line',price]);
  return row.id;
}
async function issue(id){const inv=await read(id);return mutate('issue',id,{expected_updated_at:inv.exact_updated_at,business_snapshot:{},payment_instructions_snapshot:{}});}
const payment=(id,amount,n)=>mutate('record_payment',id,{operation_id:op(n),amount,payment_date:'2026-09-13',method:'cash',reference:null,notes:null});
async function check(name,fn){await fn();checks.push(name);}
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create table public.bookings(id uuid primary key); create table public.admin_users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    insert into admin_users values('${admin}');`);
  for (const name of ['supabase/migrations/20260722000000_create_invoice_receipt_tables.sql','supabase/migrations/20260723000000_add_customers_and_payment_options.sql',
    'supabase/migrations/20260724000001_switch_to_vve_invoice_series.sql','admin/migrations/20260728000000_add_invoice_revision_links.sql',
    'supabase/migrations/20260806000000_widen_invoice_correction_events.sql','supabase/migrations/20260913100000_invoice_financial_integrity.sql']) {
    await db.exec(await readFile(resolve(name),'utf8'));
  }
  await check('New mutation is denied to anonymous and authenticated roles',async()=>{
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(()=>mutate('record_payment',op(999),{}),/permission denied/i);
      await db.exec('reset role');
    }
  });
  await check('Missing revision and stale draft saves make no changes',async()=>{
    const id=await draft();const inv=await read(id);
    await assert.rejects(()=>mutate('replace_draft',id,{header:header(200),items:items(200)}),/Reload/i);
    await mutate('replace_draft',id,{expected_updated_at:inv.exact_updated_at,header:header(200),items:items(200)});
    await assert.rejects(()=>mutate('replace_draft',id,{expected_updated_at:inv.exact_updated_at,header:header(300),items:items(300)}),/changed/i);
    assert.equal(Number((await read(id)).total),200);
  });
  await check('Item insertion failure rolls back both header and deleted items',async()=>{
    const id=await draft();const inv=await read(id);
    await db.exec(`create function fail_item() returns trigger language plpgsql as $$begin if new.description='FAIL' then raise exception 'synthetic item failure'; end if; return new; end$$;
      create trigger synthetic_item_failure before insert on invoice_items for each row execute function fail_item();`);
    await assert.rejects(()=>mutate('replace_draft',id,{expected_updated_at:inv.exact_updated_at,header:header(200),items:[{...items(200)[0],description:'FAIL'}]}),/synthetic item failure/);
    assert.equal(Number((await read(id)).total),100);
    assert.equal(Number((await db.query('select line_total from invoice_items where invoice_id=$1',[id])).rows[0].line_total),100);
    await db.exec('drop trigger synthetic_item_failure on invoice_items; drop function fail_item();');
  });
  await check('Issued items cannot be replaced, inserted, updated or deleted',async()=>{
    const id=await draft();const old=await read(id);await issue(id);
    await assert.rejects(()=>mutate('replace_draft',id,{expected_updated_at:old.exact_updated_at,header:header(200),items:items(200)}),/draft/i);
    for(const sql of ['update invoice_items set line_total=200 where invoice_id=$1','delete from invoice_items where invoice_id=$1',"insert into invoice_items(invoice_id,description,quantity,unit_price,line_total) values($1,'x',1,1,1)"]){
      await assert.rejects(()=>db.query(sql,[id]),/Issued invoice items/);
    }
    assert.equal(Number((await read(id)).total),100);
  });
  await check('Competing payments cannot overpay and retry records only once',async()=>{
    const id=await draft();await issue(id);
    const outcomes=await Promise.allSettled([payment(id,60,1),payment(id,60,2)]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    const inv=await read(id);assert.equal(Number(inv.amount_paid),60);assert.equal(Number(inv.amount_due),40);
    const replay=await payment(id,60,1);assert.equal(replay.replayed,true);
    assert.equal((await db.query('select count(*)::int n from invoice_payments where invoice_id=$1',[id])).rows[0].n,1);
    await assert.rejects(()=>payment(id,40,1),/already used/i);
  });
  await check('Payment audit failure rolls back payment and aggregate',async()=>{
    const id=await draft();await issue(id);
    await db.exec(`create function fail_audit() returns trigger language plpgsql as $$begin if new.event_type in ('payment_recorded','payment_reversed','superseded') then raise exception 'synthetic audit failure'; end if; return new; end$$;
      create trigger synthetic_audit_failure before insert on invoice_events for each row execute function fail_audit();`);
    await assert.rejects(()=>payment(id,100,3),/synthetic audit failure/);
    assert.equal(Number((await read(id)).amount_paid),0);
    assert.equal((await db.query('select count(*)::int n from invoice_payments where invoice_id=$1',[id])).rows[0].n,0);
    await db.exec('drop trigger synthetic_audit_failure on invoice_events;');
  });
  await check('Reversal is atomic and same payment/reason retry is idempotent',async()=>{
    const id=await draft();await issue(id);const paid=await payment(id,100,4);
    await db.exec('create trigger synthetic_audit_failure before insert on invoice_events for each row execute function fail_audit();');
    const payload={payment_id:paid.paymentId,reason:'Synthetic correction'};
    await assert.rejects(()=>mutate('reverse_payment',id,payload),/synthetic audit failure/);
    assert.equal(Number((await read(id)).amount_due),0);
    assert.equal((await db.query('select reversed_at from invoice_payments where id=$1',[paid.paymentId])).rows[0].reversed_at,null);
    await db.exec('drop trigger synthetic_audit_failure on invoice_events;');
    await mutate('reverse_payment',id,payload);const replay=await mutate('reverse_payment',id,payload);
    assert.equal(replay.replayed,true);assert.equal(Number((await read(id)).amount_due),100);
    assert.equal((await db.query("select count(*)::int n from invoice_events where document_id=$1 and event_type='payment_reversed'",[id])).rows[0].n,1);
    await assert.rejects(()=>payment(id,100,4),/reversed/i);
  });
  await check('Void invoice permits audited reversal without reopening or accepting new payments',async()=>{
    const id=await draft();await issue(id);const paid=await payment(id,100,91);
    await db.query("update invoices set document_status='void',void_reason='Synthetic duplicate document' where id=$1",[id]);
    await assert.rejects(()=>payment(id,1,92),/active issued invoice/);
    const payload={payment_id:paid.paymentId,reason:'Synthetic ledger correction'};
    await mutate('reverse_payment',id,payload);
    let inv=await read(id);assert.equal(inv.document_status,'void');assert.equal(Number(inv.amount_paid),0);assert.equal(Number(inv.amount_due),100);assert.equal(inv.payment_status,'unpaid');
    assert.equal((await mutate('reverse_payment',id,payload)).replayed,true);
    inv=await read(id);assert.equal(inv.document_status,'void');assert.equal(Number(inv.amount_due),100);
    assert.equal((await db.query("select count(*)::int n from invoice_events where document_id=$1 and event_type='payment_reversed'",[id])).rows[0].n,1);
  });
  await check('Paid original rejects a previously drafted revision before numbering',async()=>{
    const id=await draft();await issue(id);const revision=await draft(100,await read(id));await payment(id,100,5);
    await assert.rejects(()=>issue(revision),/original invoice changed/i);
    assert.equal((await read(revision)).invoice_number,null);assert.equal((await read(revision)).document_status,'draft');
    assert.equal((await read(id)).superseded_by_invoice_id,null);
  });
  await check('Unpaid revision issue and superseding roll back together',async()=>{
    const id=await draft();await issue(id);const revision=await draft(120,await read(id));
    await db.exec('create trigger synthetic_audit_failure before insert on invoice_events for each row execute function fail_audit();');
    await assert.rejects(()=>issue(revision),/synthetic audit failure/);
    assert.equal((await read(revision)).invoice_number,null);assert.equal((await read(id)).superseded_by_invoice_id,null);
    await db.exec('drop trigger synthetic_audit_failure on invoice_events;');
    await issue(revision);assert.equal((await read(id)).superseded_by_invoice_id,revision);
    await assert.rejects(()=>payment(id,100,6),/active issued invoice/);
  });
  await check('Deposit and existing number format remain unchanged',async()=>{
    const id=await draft(130);await db.query('update invoices set deposit_applied=30,amount_due=100 where id=$1',[id]);
    await issue(id);await payment(id,100,7);const inv=await read(id);
    assert.equal(Number(inv.deposit_applied),30);assert.equal(Number(inv.total),130);assert.equal(Number(inv.amount_due),0);
    assert.match(inv.invoice_number,/^VVE-INV-\d{4}-\d{6}$/);
  });
  console.log(JSON.stringify({ok:true,checks,limits:'In-memory PostgreSQL, one connection; validates transaction rollback and serialized outcomes, not a multi-connection production load test.'},null,2));
} finally { await db.close(); }
