// Real request/journey/webhook code against VVE OS only. Never charges money,
// sends customer messages, or uploads conversions. Credentials stay outside Git.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const credentials = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.equal(credentials.url, 'https://spbrstpxrimuuorkbsbo.supabase.co');
const claims=JSON.parse(Buffer.from(credentials.key.split('.')[1], 'base64url'));
assert.equal(claims.ref,'spbrstpxrimuuorkbsbo'); assert.equal(claims.role,'service_role');
for(const key of Object.keys(process.env)) if(/^(GMAIL_|TELEGRAM_|GOOGLE_|STRIPE_|BOOKING_|SUPABASE_|VITE_SUPABASE_)/.test(key)) delete process.env[key];
Object.assign(process.env, {
  VERCEL:'1', VERCEL_ENV:'preview', VVE_PREVIEW_ISOLATION_APPROVED:'true',
  VVE_PREVIEW_ALLOW_VVE_OS:'true', VVE_PREVIEW_SUPABASE_PROJECT_REF:claims.ref,
  VVE_PREVIEW_TEST_EMAIL:'measurement-test@example.invalid',
  VITE_SUPABASE_URL:credentials.url, SUPABASE_SERVICE_ROLE_KEY:credentials.key,
  BOOKING_JOURNEY_ENABLED:'true', BOOKING_JOURNEY_MODE:'test',
  BOOKING_JOURNEY_TOKEN_SECRET:randomBytes(32).toString('hex'),
  BOOKING_JOURNEY_SITE_URL:'http://127.0.0.1:8840', SITE_URL:'http://127.0.0.1:8840',
  STRIPE_SECRET_KEY:'sk_test_synthetic_signature_only', STRIPE_WEBHOOK_SECRET:randomBytes(32).toString('hex'),
  BOOKING_MEASUREMENT_MODE:'disabled', WEBSITE_PRICEBOOK_ENABLED:'false',
});
const db=createClient(credentials.url,credentials.key,{auth:{persistSession:false}});
const {default:requestHandler}=await import('../api/create-booking-request.js');
const {default:webhookHandler}=await import('../api/stripe-webhook.js');
const {performAdminAction,loadJourney}=await import('../admin/api/_lib/bookingJourney.js');
const server=createServer((req,res)=>{
  const handler=req.url==='/api/create-booking-request'?requestHandler:req.url==='/api/stripe-webhook'?webhookHandler:null;
  if(!handler){res.writeHead(404);return res.end();}
  Promise.resolve(handler(req,res)).catch(()=>{res.writeHead(500);res.end('test_handler_error');});
});
await new Promise(r=>server.listen(8840,'127.0.0.1',r));
const checks=[];
const report={test_label:'VVE-MEAS-OS-E2E-20260927',environment:'VVE OS',synthetic:true,production_records_read:0,production_records_written:0,real_provider_payment:false,conversions_uploaded:0,provider_notifications_sent:0,checks,events:[]};
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'}); console.log(`PASS ${name}`);};
const rows=async(table,id)=>{const r=await db.from(table).select('*').eq('booking_id',id);assert.equal(r.error,null);return r.data;};
const post=async(path,body,headers={})=>{const r=await fetch(`http://127.0.0.1:8840${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:8840',...headers},body:typeof body==='string'?body:JSON.stringify(body)}); const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={text};}return {status:r.status,data};};
const date=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
const payload={service:'Window cleaning',quoteConfig:{service:'window',windowSize:'medium',parkingAvailable:'yes',congestionZone:'no'},fullName:'VVE TEST ONLY DO NOT ATTEND',address:'Synthetic test address',postcode:'E8 1AA',phone:'07700900000',email:'measurement-test@example.invalid',date,time:'Flexible',message:report.test_label,requestKey:randomUUID(),measurement_consent:{advertising:true,version:'2026-07-14',recorded_at:new Date().toISOString()},first_touch_at:new Date().toISOString(),gclid:'VVE_SYNTHETIC_VALIDATION_ONLY_20260927',utm_source:'google',utm_medium:'cpc',utm_campaign:'synthetic-test',landing_page:'/carpet-cleaning-london',first_source:'google',last_source:'google'};
let id,j,event;
try {
  await check('invalid request rejected before database save',async()=>{assert.equal((await post('/api/create-booking-request',{...payload,email:'bad'})).status,400);});
  await check('real HTTP request saved to OS with one submission event and three notification jobs',async()=>{
    const r=await post('/api/create-booking-request',payload);assert.equal(r.status,201);id=r.data.requestId;assert.ok(id);
    assert.equal((await rows('booking_measurement_outbox',id)).length,1);
    assert.equal((await rows('booking_request_notification_outbox',id)).length,3);
  });
  await check('duplicate HTTP request returns same ID without duplicate event/jobs',async()=>{
    const r=await post('/api/create-booking-request',payload);assert.equal(r.status,200);assert.equal(r.data.requestId,id);assert.equal(r.data.replayed,true);
    assert.equal((await rows('booking_measurement_outbox',id)).length,1);assert.equal((await rows('booking_request_notification_outbox',id)).length,3);
  });
  await check('preview record is test-marked and consented first-touch attribution persists',async()=>{
    const {data,error}=await db.from('bookings').select('measurement_is_test,measurement_advertising_consent,gclid,landing_page,attribution_first_touch_at').eq('id',id).single();assert.equal(error,null);assert.equal(data.measurement_is_test,true);assert.equal(data.measurement_advertising_consent,true);assert.equal(data.gclid,payload.gclid);assert.equal(data.landing_page,payload.landing_page);assert.equal(Date.parse(data.attribution_first_touch_at),Date.parse(payload.first_touch_at));
  });
  await check('CRM agreement creates one qualification milestone and no confirmation before payment',async()=>{
    j=(await loadJourney(db,id,true)).journey;
    j=(await performAdminAction(db,id,{operation:'draft',revision:j.revision,agreement:{service:'Window cleaning',items:'Synthetic agreed cleaning list',scope:'Test only',address:payload.address,postcode:payload.postcode,date,time:'09:00-11:00',totalPence:8500,changeReason:'Synthetic release verification',paymentPlan:'deposit_after_agreement',paymentWindowHours:48}},'synthetic-release-test')).journey;
    j=(await performAdminAction(db,id,{operation:'send',revision:j.revision,availabilityConfirmed:true},'synthetic-release-test')).journey;
    assert.equal(j.state,'offered');assert.deepEqual((await rows('booking_measurement_outbox',id)).map(r=>r.event_name).sort(),['booking_request_qualified','booking_request_submitted']);
  });
  const sessionId=`cs_test_VVE_E2E_${randomUUID().replaceAll('-','')}`;
  const setSession=await db.from('booking_journeys').update({checkout_id:sessionId,checkout_kind:'deposit'}).eq('booking_id',id);assert.equal(setSession.error,null);
  event={id:`evt_test_${randomUUID()}`,object:'event',type:'checkout.session.completed',created:Math.floor(Date.now()/1000),livemode:false,data:{object:{id:sessionId,object:'checkout.session',currency:'gbp',amount_total:3000,payment_status:'paid',metadata:{journey:'v1',booking_id:id,offer_version:String(j.offer_version),amount_pence:'3000',payment_kind:'deposit'}}}};
  const signedPost=async(e,signature)=>{const body=JSON.stringify(e);const sig=signature??Stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});return post('/api/stripe-webhook',body,{'stripe-signature':sig});};
  await check('invalid webhook signature rejected with no payment/confirmation event',async()=>{assert.equal((await signedPost(event,'invalid')).status,400);assert.equal((await rows('booking_journey_payments',id)).length,0);assert.equal((await rows('booking_measurement_outbox',id)).length,2);});
  await check('signed unpaid checkout does not count as deposit or confirm booking',async()=>{const unpaid=structuredClone(event);unpaid.data.object.payment_status='unpaid';assert.equal((await signedPost(unpaid)).status,200);assert.equal((await rows('booking_journey_payments',id)).length,0);});
  await check('signed synthetic paid webhook atomically records deposit and confirmation',async()=>{assert.equal((await signedPost(event)).status,200);j=(await loadJourney(db,id)).journey;assert.equal(j.state,'confirmed');assert.equal(j.paid_pence,3000);assert.equal((await rows('booking_journey_payments',id)).length,1);assert.equal((await rows('booking_measurement_outbox',id)).length,4);});
  await check('webhook replay and repeated confirmation update create no duplicate milestones',async()=>{assert.equal((await signedPost(event)).status,200);const r=await db.from('booking_journeys').update({state:'confirmed'}).eq('booking_id',id);assert.equal(r.error,null);assert.equal((await rows('booking_journey_payments',id)).length,1);assert.equal((await rows('booking_measurement_outbox',id)).length,4);});
  await check('test conversions suppressed; value and original attribution retained on all milestones',async()=>{
    const ev=await rows('booking_measurement_outbox',id);for(const r of ev){assert.equal(r.status,'suppressed');assert.equal(r.is_test,true);assert.equal(r.attribution.gclid,payload.gclid);assert.equal(r.attribution.landing_page,payload.landing_page);}
    assert.equal(ev.find(r=>r.event_name==='deposit_paid').amount_pence,3000);
    report.events=ev.map(r=>({booking_id:id,event:r.event_name,occurred_at:r.occurred_at,event_key:r.event_key,payment_transaction:r.payment_external_id,status:r.status,attempts:r.attempts,count_in_database:1,count_in_google:0,consent:r.consent.advertising,synthetic_attribution_present:Boolean(r.attribution.gclid),amount_pence:r.amount_pence}));
  });
  await check('denied consent removes identifiers and matching data',async()=>{const r=await post('/api/create-booking-request',{...payload,requestKey:randomUUID(),measurement_consent:{advertising:false,version:'2026-07-14',recorded_at:new Date().toISOString()}});assert.equal(r.status,201);const {data,error}=await db.from('bookings').select('gclid,landing_page,measurement_email_sha256,measurement_phone_sha256,measurement_advertising_consent').eq('id',r.data.requestId).single();assert.equal(error,null);for(const k of ['gclid','landing_page','measurement_email_sha256','measurement_phone_sha256'])assert.equal(data[k],null);assert.equal(data.measurement_advertising_consent,false);});
  report.status='PASS';
} catch(error){report.status='FAIL';report.failure=String(error.message).slice(0,300);process.exitCode=1;console.log('FAIL',report.failure);}
finally{server.close();report.finished_at=new Date().toISOString();await writeFile(new URL('../docs/BOOKING-MEASUREMENT-OS-E2E-2026-09-27.json',import.meta.url),JSON.stringify(report,null,2));}
