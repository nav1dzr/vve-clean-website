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
const database='vve_allocation_'+Date.now();
await sql('create database '+database);
args[args.indexOf('-d')+1]=database;
await sql("do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end$$; create table public.bookings(id uuid primary key default gen_random_uuid(), measurement_is_test boolean not null default false); create table public.admin_users(id uuid primary key); insert into admin_users values("+lit(admin)+"); create schema storage; create table storage.buckets(id text primary key,name text,public boolean);");
for(const path of [
  'supabase/migrations/20260722000000_create_invoice_receipt_tables.sql',
  'supabase/migrations/20260723000000_add_customers_and_payment_options.sql',
  'supabase/migrations/20260724000001_switch_to_vve_invoice_series.sql',
  'admin/migrations/20260728000000_add_invoice_revision_links.sql',
  'supabase/migrations/20260806000000_widen_invoice_correction_events.sql',
  'supabase/migrations/20260806090000_add_standalone_receipts.sql',
  'supabase/migrations/20260908100000_booking_journey.sql',
  'supabase/migrations/20260913100000_invoice_financial_integrity.sql',
  'supabase/migrations/20261103120000_booking_invoice_payment_allocations.sql',
]) await sql(await readFile(resolve(path),'utf8'));
async function fixture({deposit=3000,balance=12000}={}) {
  const booking=randomUUID(),invoice=randomUUID(),total=(deposit+balance)/100;
  const source='fixture-balance:'+booking;
  await sql("insert into bookings(id) values("+lit(booking)+");"+
    "insert into booking_journeys(booking_id,state,revision,paid_pence,snapshot) values("+lit(booking)+",'completed',7,"+(deposit+balance)+",jsonb_build_object('totalPence',"+(deposit+balance)+"));"+
    (deposit?"insert into booking_journey_payments(external_id,booking_id,kind,amount_pence,currency) values("+lit('fixture-deposit:'+booking)+","+lit(booking)+",'manual_deposit',"+deposit+",'gbp');":"")+
    "insert into booking_journey_payments(external_id,booking_id,kind,amount_pence,currency) values("+lit(source)+","+lit(booking)+",'manual_balance',"+balance+",'gbp');"+
    "insert into invoices(id,booking_id,customer_name,customer_email,subtotal,total,deposit_applied,amount_due) values("+lit(invoice)+","+lit(booking)+",'Synthetic fixture','fixture@example.invalid',"+total+","+total+","+deposit/100+","+balance/100+");"+
    "insert into invoice_items(invoice_id,description,quantity,unit_price,line_total) values("+lit(invoice)+",'Synthetic clean',1,"+total+","+total+");"+
    "select invoice_financial_mutation('issue',"+lit(invoice)+",'{}'::jsonb || jsonb_build_object('expected_updated_at',(select updated_at from invoices where id="+lit(invoice)+"),'business_snapshot','{}'::jsonb,'payment_instructions_snapshot','{}'::jsonb),"+lit(admin)+");");
  const version=await json("select jsonb_build_object('updated',(select updated_at from invoices where id="+lit(invoice)+"),'date',current_date)");
  return {booking,invoice,source,operation:randomUUID(),updated:version.updated,date:version.date,revision:7,depositReviewed:true,method:'bank_transfer',reason:'Reviewed existing booking payment'};
}
function applySQL(x,changes={}) {
  const p={...x,...changes};
  return "select apply_booking_invoice_allocation("+[p.invoice,p.source,p.operation,p.updated,p.revision,p.depositReviewed,p.method,p.date,p.reason,admin].map((v,i)=>i===4||i===5?String(v):lit(v)).join(',')+")";
}
const apply=(x,c)=>json(applySQL(x,c));
const state=x=>json("select jsonb_build_object('invoice',(select jsonb_build_object('paid',amount_paid,'due',amount_due,'status',payment_status) from invoices where id="+lit(x.invoice)+"),'payments',(select count(*) from invoice_payments where invoice_id="+lit(x.invoice)+"),'allocations',(select count(*) from invoice_booking_payment_allocations where invoice_id="+lit(x.invoice)+"),'receipts',(select count(*) from receipts where invoice_id="+lit(x.invoice)+"),'bookingPaid',(select paid_pence from booking_journeys where booking_id="+lit(x.booking)+"),'bookingMessages',(select count(*) from booking_journey_messages where booking_id="+lit(x.booking)+"))");
await check('Anonymous and authenticated roles cannot read allocation history or execute allocation functions',async()=>{
  const x=await fixture();
  for(const role of ['anon','authenticated']){
    await assert.rejects(()=>sql('set role '+role+';'+applySQL(x)),/permission denied/);
    await assert.rejects(()=>sql('set role '+role+';select * from invoice_booking_payment_allocations'),/permission denied/);
    await assert.rejects(()=>sql('set role '+role+';select booking_invoice_allocation_snapshot('+lit(x.invoice)+','+lit(admin)+')'),/permission denied/);
  }
});
await check('A complete allocation credits the invoice once and preserves booking funds and issued document',async()=>{
  const x=await fixture(); const before=await json('select to_jsonb(i) from invoices i where id='+lit(x.invoice));
  const result=await apply(x);const after=await state(x);
  assert.equal(result.amountDue,0);assert.ok(result.receiptId);assert.equal(after.payments,1);assert.equal(after.allocations,1);assert.equal(after.receipts,1);assert.equal(after.bookingPaid,15000);assert.equal(after.bookingMessages,0);
  const inv=await json('select to_jsonb(i) from invoices i where id='+lit(x.invoice));
  for(const key of ['invoice_number','total','deposit_applied','business_snapshot','document_version','pdf_storage_path'])assert.deepEqual(inv[key],before[key]);
  const receipt=await json('select to_jsonb(r) from receipts r where id='+lit(result.receiptId));
  assert.equal(Number(receipt.invoice_total)-30-Number(receipt.total_paid),0);
});
await check('Identical retries, including a lost response, return the same allocation/payment/receipt',async()=>{
  const x=await fixture();const first=await apply(x),replay=await apply(x);
  assert.equal(replay.replayed,true);for(const key of ['allocationId','paymentId','receiptId'])assert.equal(replay[key],first[key]);
  assert.equal((await state(x)).payments,1);
});
await check('Changed operation details cannot reuse a committed operation',async()=>{
  const x=await fixture();await apply(x);
  await assert.rejects(()=>apply(x,{reason:'Different reason'}),/allocation_operation_conflict/);
  await assert.rejects(()=>apply(x,{method:'cash'}),/allocation_operation_conflict/);
});
await check('Real concurrent sessions with one operation produce one allocation and one replay',async()=>{
  const x=await fixture();const results=await Promise.all([apply(x),apply(x)]);
  assert.equal(results.filter(r=>r.replayed).length,1);assert.equal((await state(x)).receipts,1);
});
await check('Real concurrent sessions with distinct operations cannot allocate one source twice',async()=>{
  const x=await fixture();const results=await Promise.allSettled([apply(x),apply(x,{operation:randomUUID()})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await state(x)).payments,1);
});
await check('Payment and allocation audit failure rolls back invoice, credit, allocation and receipt',async()=>{
  const x=await fixture();
  await sql("create function fail_allocation_audit() returns trigger language plpgsql as $$begin if new.metadata->>'kind'='booking_payment_allocated' then raise exception 'synthetic audit failure'; end if;return new;end$$;create trigger synthetic_allocation_audit before insert on invoice_events for each row execute function fail_allocation_audit();");
  try {await assert.rejects(()=>apply(x),/synthetic audit failure/);assert.equal((await state(x)).payments,0);assert.equal((await state(x)).invoice.due,120);assert.equal((await state(x)).allocations,0);}
  finally {await sql('drop trigger synthetic_allocation_audit on invoice_events;drop function fail_allocation_audit();');}
});
await check('Receipt failure rolls back the allocation and credit too',async()=>{
  const x=await fixture();
  await sql("create function fail_allocation_receipt() returns trigger language plpgsql as $$begin raise exception 'synthetic receipt failure';end$$;create trigger synthetic_allocation_receipt before insert on receipts for each row execute function fail_allocation_receipt();");
  try {await assert.rejects(()=>apply(x),/synthetic receipt failure/);const s=await state(x);assert.equal(s.payments,0);assert.equal(s.allocations,0);assert.equal(s.invoice.due,120);assert.equal(s.bookingPaid,15000);}
  finally {await sql('drop trigger synthetic_allocation_receipt on receipts;drop function fail_allocation_receipt();');}
});
await check('No-deposit bookings allocate their existing balance',async()=>{
  const x=await fixture({deposit:0,balance:8500});const r=await apply(x,{depositReviewed:false});assert.equal(r.amountDue,0);assert.equal((await state(x)).bookingPaid,8500);
});
await check('Partial source payments are held and create no credit or receipt',async()=>{
  const x=await fixture();
  await sql("update booking_journey_payments set amount_pence=6000 where external_id="+lit(x.source)+";update booking_journeys set paid_pence=9000 where booking_id="+lit(x.booking));
  await assert.rejects(()=>apply(x),/allocation_source_invalid/);const s=await state(x);assert.equal(s.invoice.due,120);assert.equal(s.payments,0);assert.equal(s.receipts,0);
});
await check('Stale invoice or booking versions make no credit',async()=>{
  const x=await fixture();await assert.rejects(()=>apply(x,{revision:6}),/allocation_stale/);
  await assert.rejects(()=>apply(x,{updated:'2020-01-01T00:00:00Z'}),/allocation_stale/);assert.equal((await state(x)).payments,0);
});
await check('Refunds, incomplete source totals and cross-booking source IDs are held',async()=>{
  const x=await fixture();await sql('update booking_journeys set refunded_pence=1 where booking_id='+lit(x.booking));
  await assert.rejects(()=>apply(x),/allocation_refund_review/);
  const y=await fixture();await sql('update booking_journeys set paid_pence=14999 where booking_id='+lit(y.booking));
  await assert.rejects(()=>apply(y),/allocation_source_totals_invalid/);
  const z=await fixture(),other=await fixture();await assert.rejects(()=>apply(z,{source:other.source}),/allocation_source_invalid/);
});
await check('Applied deposit needs an explicit review even when amounts agree',async()=>{
  const x=await fixture();await assert.rejects(()=>apply(x,{depositReviewed:false}),/allocation_deposit_review/);assert.equal((await state(x)).allocations,0);
});
await check('Multiple active invoices, non-completed bookings and existing invoice activity are held',async()=>{
  const x=await fixture();await sql("insert into invoices(booking_id,customer_name) values("+lit(x.booking)+",'Synthetic competing draft')");
  await assert.rejects(()=>apply(x),/allocation_multiple_invoices/);
  const y=await fixture();await sql("update booking_journeys set state='confirmed' where booking_id="+lit(y.booking));await assert.rejects(()=>apply(y),/allocation_completed_booking_required/);
  const z=await fixture();await sql("select invoice_financial_mutation('record_payment',"+lit(z.invoice)+",jsonb_build_object('operation_id',"+lit(randomUUID())+",'amount',1,'method','cash','payment_date',current_date),"+lit(admin)+")");
  await assert.rejects(()=>apply(z),/allocation_stale|allocation_totals_invalid/);assert.equal((await state(z)).allocations,0);
});
await check('Oversized sources, currency mismatch and invalid payment dates are held',async()=>{
  const x=await fixture();await sql("update booking_journey_payments set amount_pence=13000 where external_id="+lit(x.source)+";update booking_journeys set paid_pence=16000 where booking_id="+lit(x.booking));await assert.rejects(()=>apply(x),/allocation_source_invalid/);
  const y=await fixture();await sql("update invoices set currency='USD' where id="+lit(y.invoice));await assert.rejects(()=>apply(y),/allocation_currency_invalid/);
  const z=await fixture();await assert.rejects(()=>apply(z,{date:'2099-01-01'}),/allocation_input_invalid/);
});
await check('Allocation audit, source payment and credited invoice payment cannot be rewritten or reversed',async()=>{
  const x=await fixture(),r=await apply(x);
  await assert.rejects(()=>sql("update invoice_booking_payment_allocations set review_reason='rewrite' where id="+lit(r.allocationId)),/allocation_history_immutable/);
  await assert.rejects(()=>sql('delete from booking_journey_payments where external_id='+lit(x.source)),/allocation_source_immutable/);
  await assert.rejects(()=>sql("select invoice_financial_mutation('reverse_payment',"+lit(x.invoice)+",jsonb_build_object('payment_id',"+lit(r.paymentId)+",'reason','Synthetic wrong link'),"+lit(admin)+")"),/allocation_correction_requires_review/);
  assert.equal((await state(x)).invoice.due,0);
});
await check('Read-only snapshot omits customer data and marks capped histories incomplete',async()=>{
  const x=await fixture();let snapshot=await json("select booking_invoice_allocation_snapshot("+lit(x.invoice)+","+lit(admin)+")");
  assert.equal(snapshot.complete.payments,true);assert.equal(snapshot.payments.length,2);assert.equal(JSON.stringify(snapshot).includes('fixture@example.invalid'),false);assert.equal('customer_name' in snapshot.invoice,false);
  await sql("insert into booking_journey_payments(external_id,booking_id,kind,amount_pence,currency) select 'synthetic-extra:'||"+lit(x.booking)+"||':'||n,"+lit(x.booking)+",'manual_balance',1,'gbp' from generate_series(1,501)n");
  snapshot=await json("select booking_invoice_allocation_snapshot("+lit(x.invoice)+","+lit(admin)+")");assert.equal(snapshot.complete.payments,false);await assert.rejects(()=>apply(x),/allocation_source_history_invalid/);
});
await check('Saved operation lookup is read-only and scoped to the invoice and operator',async()=>{
  const x=await fixture(), result=await apply(x);
  const lookup=(invoice, actor)=>json("select booking_invoice_allocation_snapshot("+lit(invoice)+","+lit(actor)+","+lit(x.operation)+")");
  assert.equal((await lookup(x.invoice,admin)).allocationId,result.allocationId);
  assert.equal(await lookup(randomUUID(),admin),null);
  const other=randomUUID();await sql("insert into admin_users(id) values("+lit(other)+")");
  assert.equal(await lookup(x.invoice,other),null);
  assert.equal((await state(x)).allocations,1);
});
await check('Test jobs and Stripe method mismatches are held',async()=>{
  const x=await fixture();await sql('update bookings set measurement_is_test=true where id='+lit(x.booking));
  await assert.rejects(()=>apply(x),/allocation_test_booking/);
  const y=await fixture();await sql("update booking_journey_payments set kind='balance' where external_id="+lit(y.source));
  await assert.rejects(()=>apply(y),/allocation_source_invalid/);
  assert.ok((await apply(y,{method:'stripe'})).receiptId);
});
await check('A previously issued receipt linked to the booking blocks a second document',async()=>{
  const x=await fixture();
  await sql("insert into receipts(booking_id,customer_name,source,service_description,total_paid) values("+lit(x.booking)+",'Synthetic fixture','standalone','Synthetic clean',150)");
  await assert.rejects(()=>apply(x),/allocation_existing_activity/);
});
await check('A voided invoice with an earlier payment blocks another credit for the booking', async () => {
  const x = await fixture();
  const historical = randomUUID();
  await sql(
    "insert into invoices(id,booking_id,customer_name,document_status) values(" +
    lit(historical) + "," + lit(x.booking) + ",'Historical fixture','void');" +
    "insert into invoice_payments(invoice_id,amount,method,payment_date) values(" +
    lit(historical) + ",120,'bank_transfer',current_date);"
  );
  const snapshot = await json("select booking_invoice_allocation_snapshot(" + lit(x.invoice) + "," + lit(admin) + ")");
  assert.equal(snapshot.invoicePayments.length, 1);
  await assert.rejects(() => apply(x), /allocation_existing_activity/);
  assert.equal((await state(x)).payments, 0);
});
await check('Allocation and ordinary payment cannot both settle the invoice concurrently',async()=>{
  const x=await fixture();
  const manual="select invoice_financial_mutation('record_payment',"+lit(x.invoice)+",jsonb_build_object('operation_id',"+lit(randomUUID())+",'amount',120,'method','bank_transfer','payment_date',current_date),"+lit(admin)+")";
  const results=await Promise.allSettled([apply(x),sql(manual)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await state(x)).payments,1);
});
console.log(JSON.stringify({passed:checks.length,failed:0,engine:'PostgreSQL 18, isolated localhost port 55469; real independent sessions',checks},null,2));
