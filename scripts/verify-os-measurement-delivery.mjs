// VVE OS + Google's validation-only endpoint. No attributed conversions.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const creds=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.equal(creds.url,'https://spbrstpxrimuuorkbsbo.supabase.co');
const jwt=JSON.parse(Buffer.from(creds.key.split('.')[1],'base64url'));assert.equal(jwt.ref,'spbrstpxrimuuorkbsbo');
const google=JSON.parse(await readFile(process.argv[3],'utf8'));
assert.equal(google.project_id,'booming-tooling-508817-n7');assert.equal(google.scope,'https://www.googleapis.com/auth/datamanager');
Object.assign(process.env,{BOOKING_MEASUREMENT_MODE:'validate',GOOGLE_ADS_CUSTOMER_ID:'5569099303',GOOGLE_ADS_BOOKING_REQUEST_SUBMITTED_CONVERSION_ACTION_ID:'7793322917',GOOGLE_ADS_BOOKING_REQUEST_QUALIFIED_CONVERSION_ACTION_ID:'7793447502',GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID:'7793447505',GOOGLE_ADS_BOOKING_CONFIRMED_CONVERSION_ACTION_ID:'7793447508',GOOGLE_DATA_MANAGER_CLIENT_ID:google.client_id,GOOGLE_DATA_MANAGER_CLIENT_SECRET:google.client_secret,GOOGLE_DATA_MANAGER_REFRESH_TOKEN:google.refresh_token});
const db=createClient(creds.url,creds.key,{auth:{persistSession:false}});
const {createGoogleDataManagerAdapter,deliverBookingMeasurements}=await import('../api/_lib/depositMeasurement.js');
const report={test_label:'VVE-MEAS-OS-GOOGLE-20260927',validate_only:true,synthetic:true,production_records_read:0,conversions_uploaded:0,checks:[],events:[]};
const check=async(name,fn)=>{await fn();report.checks.push({name,status:'PASS'});console.log(`PASS ${name}`);};
const id=randomUUID(),now=new Date().toISOString();
const guardFetch=async(url,options)=>{
  const u=new URL(url);assert.ok(['oauth2.googleapis.com','datamanager.googleapis.com'].includes(u.hostname));
  if(u.hostname==='datamanager.googleapis.com'&&options?.method==='POST')assert.equal(JSON.parse(options.body).validateOnly,true);
  return fetch(url,options);
};
try{
  // Synthetic eligible fixture tests the production eligibility/delivery path.
  // It is deliberately NOT an actual preview request; those stay suppressed.
  let r=await db.from('bookings').insert({id,booking_ref:`TEST-VALIDATE-${id.slice(0,8)}`,request_key:randomUUID(),request_fingerprint:'synthetic-provider-validation',full_name:'TEST ONLY DO NOT ATTEND',email:'measurement-test@example.invalid',phone:'07700900000',address:'Synthetic test address',postcode:'E8 1AA',service:'Synthetic provider validation',preferred_date:'2099-01-01',preferred_time:'Flexible',payment_status:'pending_payment',deposit_amount:0,status:'new',total_price:85,email_customer_sent:true,email_business_sent:true,telegram_sent:true,measurement_is_test:false,measurement_advertising_consent:true,measurement_consent_version:'synthetic-validation-only',measurement_consent_recorded_at:now,attribution_first_touch_at:now,gclid:'VVE_SYNTHETIC_VALIDATION_ONLY_20260927',landing_page:'/synthetic-validation-only'});assert.equal(r.error,null);
  r=await db.from('booking_journeys').insert({booking_id:id});assert.equal(r.error,null);
  r=await db.rpc('apply_booking_journey',{p_booking_id:id,p_revision:0,p_actor:'synthetic-test',p_event:'synthetic_qualified',p_patch:{state:'offered'}});assert.equal(r.error,null);
  r=await db.rpc('apply_booking_journey',{p_booking_id:id,p_revision:1,p_actor:'synthetic-test',p_event:'synthetic_paid',p_patch:{state:'confirmed',paid_pence:4700},p_payment:{external_id:`cs_test_VVE_VALIDATE_${id.replaceAll('-','')}`,kind:'deposit',amount_pence:4700,occurred_at:now}});assert.equal(r.error,null);
  const real=createGoogleDataManagerAdapter({validateOnly:true,fetchFn:guardFetch});
  let first=true,realSends=0;
  const adapter={...real,async send(row){if(first&&row.event_name==='booking_request_submitted'){first=false;throw Object.assign(new Error('synthetic_temporary_failure'),{code:'synthetic_temporary_failure'});}realSends++;return real.send(row);}};
  const adapters={google_data_manager:adapter};
  await check('durable worker records temporary failure while other Google validations complete',async()=>{const result=await deliverBookingMeasurements(db,{adapters});assert.equal(result.failed,1);assert.equal(result.validated,3);});
  await check('retry validates failed event with same identity and actual GBP amount',async()=>{const reset=await db.from('booking_measurement_outbox').update({next_attempt_at:now}).eq('booking_id',id).eq('status','failed');assert.equal(reset.error,null);const result=await deliverBookingMeasurements(db,{adapters});assert.equal(result.validated,1);assert.equal(result.failed,0);});
  await check('repeated worker run does not resend validated milestones',async()=>{const result=await deliverBookingMeasurements(db,{adapters});assert.equal(result.processed,0);assert.equal(realSends,4);});
  const ev=await db.from('booking_measurement_outbox').select('booking_id,event_name,event_key,occurred_at,payment_external_id,amount_pence,currency,status,attempts,provider_acknowledgement').eq('booking_id',id);assert.equal(ev.error,null);assert.equal(ev.data.length,4);
  await check('four provider receipts saved once; nonstandard test deposit remains 4700 pence',async()=>{for(const row of ev.data){assert.equal(row.status,'validated');const receipt=JSON.parse(row.provider_acknowledgement);assert.equal(receipt.validateOnly,true);assert.equal(receipt.fieldWarningCount,0);}assert.equal(ev.data.find(r=>r.event_name==='deposit_paid').amount_pence,4700);});
  report.events=ev.data.map(r=>({...r,provider_acknowledgement:JSON.parse(r.provider_acknowledgement),count_in_google:0}));report.status='PASS';
}catch(e){report.status='FAIL';report.failure=String(e.message).slice(0,300);process.exitCode=1;console.log('FAIL',report.failure);}
finally{report.finished_at=new Date().toISOString();await writeFile(new URL('../docs/BOOKING-MEASUREMENT-OS-GOOGLE-2026-09-27.json',import.meta.url),JSON.stringify(report,null,2));}
