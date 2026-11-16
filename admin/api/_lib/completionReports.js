import { randomUUID, createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import {bookingContent} from '../../shared/bookingPresentation.js';
import { buildCustomerEmail, validateCustomerEmail } from './customerEmailTemplate.js';
import { getBusinessSettings } from './businessSettings.js';
import { sendMail, isMailerConfigured } from './mailer.js';
import { generateCompletionReportPdf } from './completionReportPdf.js';

export const REPORT_BUCKET = 'cleaning-reports-private';
export const MAX_ORIGINAL = 2 * 1024 * 1024;
export const MAX_DISPLAY = 300 * 1024;
const TEMPLATES = ['carpet','upholstery','end_of_tenancy','hospitality','commercial','communal','after_builders'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function reportError(message,status=400){const e=new Error(message);e.status=status;return e;}
export function requireId(value){if(typeof value!=='string'||!UUID.test(value))throw reportError('A valid record reference is required.');return value;}
function str(value,max){if(value==null)return '';if(typeof value!=='string'||value.length>max)throw reportError('A report field is too long or invalid.');return value.trim();}
export function validateReportPayload(input,final=false){
 if(!input||typeof input!=='object'||!TEMPLATES.includes(input.template))throw reportError('Choose a report template.');
 const p={template:input.template};
 for(const [key,max] of Object.entries({customerName:200,customerEmail:254,propertyAddress:1000,serviceDate:10,jobReference:100,summary:6000,observations:6000,exclusions:6000,aftercare:6000,internalNotes:6000,followUp:4000}))p[key]=str(input[key],max);
 if(p.serviceDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.serviceDate)||Number.isNaN(Date.parse(p.serviceDate))||new Date(p.serviceDate).toISOString().slice(0,10)!==p.serviceDate))throw reportError('Enter a valid service date.');
 if(!Array.isArray(input.tasks)||input.tasks.length>80)throw reportError('Use up to 80 checklist items.');
 p.tasks=input.tasks.map((t,i)=>{if(!t||typeof t.completed!=='boolean')throw reportError('Choose completed work explicitly.');return{id:str(t.id||String(i),100),text:str(t.text,500),completed:t.completed};});
 if(p.tasks.some(t=>!t.text))throw reportError('Checklist items need a description.');
 if(!Array.isArray(input.photos)||input.photos.length>12)throw reportError('Use up to 12 report photographs.');
 p.photos=input.photos.map(photo=>{if(!['before','after','area'].includes(photo.stage))throw reportError('Choose a photo label.');return{id:requireId(photo.id),objectKey:str(photo.objectKey,300),caption:str(photo.caption,500),stage:photo.stage,pairId:str(photo.pairId,100)};});
 if(new Set(p.photos.map(x=>x.id)).size!==p.photos.length)throw reportError('A photograph can appear only once.');
 const groups=new Map();for(const photo of p.photos){if(!photo.pairId)continue;if(photo.stage==='area')throw reportError('An area photo cannot be paired.');const stages=groups.get(photo.pairId)||new Set();if(stages.has(photo.stage))throw reportError('Each pair can contain one before and one after photograph.');stages.add(photo.stage);groups.set(photo.pairId,stages);}
 if(final){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(!p.customerName||!p.propertyAddress||!p.serviceDate||p.serviceDate>today)throw reportError('Check the client, property and actual service date before finalising.');if(!p.summary&&!p.tasks.some(t=>t.completed))throw reportError('Record the actual completed work before finalising.');}
 return p;
}
export function imageInfo(base64,mime,max=MAX_ORIGINAL){
 if(typeof base64!=='string'||base64.length>Math.ceil(max/3)*4+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw reportError('Choose a valid JPEG or PNG within the upload limit.');
 const bytes=Buffer.from(base64,'base64');if(!bytes.length||bytes.length>max||bytes.toString('base64')!==base64)throw reportError('The photo exceeds the upload limit or is invalid.');
 let width=0,height=0;
 if(mime==='image/png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
 else if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let at=2;while(at+8<bytes.length){if(bytes[at]!==255)break;const marker=bytes[at+1];if(marker===217||marker===218)break;const n=bytes.readUInt16BE(at+2);if(n<2||at+2+n>bytes.length)break;if([192,193,194].includes(marker)){height=bytes.readUInt16BE(at+5);width=bytes.readUInt16BE(at+7);break;}at+=n+2;}}
 if(!width||!height||width>16000||height>16000||width*height>45000000)throw reportError('Unsupported or damaged image, or image dimensions are too large.');
 if(max===MAX_DISPLAY&&(width>1600||height>1600))throw reportError('The report copy must be resized to 1600 pixels or less.');
 try{const image=new PDFDocument({autoFirstPage:false}).openImage(bytes);if(image.width!==width||image.height!==height)throw Error('Invalid dimensions');}catch{throw reportError('The photograph could not be decoded. Choose another JPEG or PNG.');}
 return{bytes,width,height,sha256:hash(bytes)};
}
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function write(db,action,id,actor,revision,data){const result=await db.rpc('cleaning_report_write',{p_action:action,p_id:id,p_actor:actor,p_revision:revision??null,p_data:data});if(result.error)throw reportError('This report could not be updated. Reload and check its status before trying again.',409);return result.data;}
export async function getReport(db,id){requireId(id);const {data,error}=await db.from('cleaning_completion_reports').select('*').eq('id',id).maybeSingle();if(error)throw reportError('Completion report storage is not ready.',503);if(!data)throw reportError('Report not found.',404);return data;}
async function photosFor(db,report){const {data,error}=await db.from('cleaning_report_photos').select('*').eq('report_id',report.id);if(error)throw reportError('Photo storage is unavailable.',503);return data||[];}
async function verifyPhotos(db,report,payload){const rows=await photosFor(db,report);const selected=[];for(const photo of payload.photos){const row=rows.find(x=>x.id===photo.id);if(!row||row.object_key!==photo.objectKey)throw reportError('A photo does not belong to this report.');selected.push(row);}return selected;}
async function download(db,key,expectedHash){const r=await db.storage.from(REPORT_BUCKET).download(key);if(r.error||!r.data)throw reportError('The private report file is unavailable. Nothing has been sent.',503);const bytes=Buffer.from(await r.data.arrayBuffer());if(expectedHash&&hash(bytes)!==expectedHash)throw reportError('The stored file did not pass its integrity check.',409);return bytes;}
export async function reportPdf(db,report,render=generateCompletionReportPdf){
 if(report.status==='final')return download(db,report.pdf_key,report.pdf_sha256);
 const rows=await verifyPhotos(db,report,report.payload);const buffers=new Map();for(const row of rows)buffers.set(row.id,await download(db,row.object_key,row.sha256));
 return render(report,{photoBuffers:buffers});
}
export async function reportPhoto(db,report,photoId,original=false){const row=(await photosFor(db,report)).find(p=>p.id===requireId(photoId));if(!row)throw reportError('Photo not found.',404);return{bytes:await download(db,original?row.original_key:row.object_key,original?row.original_sha256:row.sha256),mime:original?row.original_mime_type:row.mime_type};}
export async function reportDefaults(db,{bookingId,customerId}){
 let booking=null,customer=null,agreement=null;
 if(bookingId){requireId(bookingId);const result=await db.from('bookings').select('id,booking_ref,full_name,email,address,postcode,service,service_date,preferred_date').eq('id',bookingId).maybeSingle();if(result.error||!result.data)throw reportError('Booking not found.',404);booking=result.data;const journey=await db.from('booking_journeys').select('snapshot').eq('booking_id',bookingId).maybeSingle();if(journey.error)throw reportError('Agreed booking details could not be checked. Please try again.',503);agreement=journey.data?.snapshot||null;}
 if(customerId){requireId(customerId);const result=await db.from('customers').select('id,name,email,address,postcode').eq('id',customerId).maybeSingle();if(result.error||!result.data)throw reportError('Customer not found.',404);customer=result.data;}
 const planned=bookingContent(agreement||{items:booking?.service||''}).cleaning;
 const s=String(agreement?.service||booking?.service||'').toLowerCase();const template=s.includes('tenancy')?'end_of_tenancy':s.includes('upholstery')||s.includes('sofa')?'upholstery':s.includes('builder')?'after_builders':'carpet';
 return{bookingId:booking?.id||null,customerId:customer?.id||null,payload:{template,customerName:customer?.name||booking?.full_name||'',customerEmail:customer?.email||booking?.email||'',propertyAddress:agreement?.address|| (booking?[booking.address,booking.postcode].filter(Boolean).join(', '):''),serviceDate:agreement?.date||booking?.service_date||'',jobReference:booking?.booking_ref||'',summary:'',tasks:planned.slice(0,80).map((text,i)=>({id:'booked-'+i,text:text.slice(0,500),completed:false})),photos:[],observations:'',exclusions:'',aftercare:'',internalNotes:'',followUp:''}};
}
export async function actOnReport(db,actor,input,deps={}){
 const action=input.action;const id=requireId(input.id);
 if(action==='create'){
  const payload=validateReportPayload(input.payload);await reportDefaults(db,{bookingId:input.bookingId,customerId:input.customerId});
  if(payload.photos.length)throw reportError('Upload photographs after saving the new report.');
  return{report:await write(db,'create',id,actor,null,{payload,bookingId:input.bookingId||null,customerId:input.customerId||null})};
 }
 const report=await getReport(db,id);
 if(action==='duplicate'){
  const payload={...report.payload,tasks:report.payload.tasks.map(t=>({...t,completed:false})),photos:[],summary:'',observations:'',exclusions:'',internalNotes:'',serviceDate:'',jobReference:''};
  return{report:await write(db,'create',requireId(input.newId),actor,null,{payload,bookingId:null,customerId:report.customer_id})};
 }
 if(action==='save'){
  const payload=validateReportPayload(input.payload);await verifyPhotos(db,report,payload);
  return{report:await write(db,'save',id,actor,input.revision,{payload})};
 }
 if(action==='upload'){
  if(report.status!=='draft'||report.revision!==input.revision)throw reportError('Reload the editable draft before uploading.',409);
  if((await photosFor(db,report)).length>=30)throw reportError('This draft has reached its upload limit. Create a new draft for more photographs.');
  const original=imageInfo(input.dataBase64,input.mimeType);
  const display=input.derivativeBase64?imageInfo(input.derivativeBase64,input.derivativeMimeType,MAX_DISPLAY):imageInfo(input.dataBase64,input.mimeType,MAX_DISPLAY);
  const photoId=randomUUID();const originalKey=id+'/originals/'+photoId;const objectKey=id+'/display/'+photoId;
  for(const [key,bytes,mime] of [[originalKey,original.bytes,input.mimeType],[objectKey,display.bytes,input.derivativeBase64?input.derivativeMimeType:input.mimeType]]){
   const result=await db.storage.from(REPORT_BUCKET).upload(key,bytes,{contentType:mime,upsert:false});if(result.error)throw reportError('Photo upload failed. Your existing report is unchanged.',503);
  }
  const fresh=await write(db,'upload',id,actor,input.revision,{id:photoId,objectKey,originalKey,mimeType:input.derivativeBase64?input.derivativeMimeType:input.mimeType,originalMimeType:input.mimeType,sha256:display.sha256,originalSha256:original.sha256,sizeBytes:display.bytes.length,originalSizeBytes:original.bytes.length});
  return{report:fresh,photo:{id:photoId,objectKey,caption:'',stage:'area',pairId:''}};
 }
 if(action==='finalise'){
  if(input.confirmed!==true)throw reportError('Review and approve the report before finalising.');
  if(report.status!=='draft'||report.revision!==input.revision)throw reportError('Reload the latest draft before finalising.',409);
  validateReportPayload(report.payload,true);
  const rows=await verifyPhotos(db,report,report.payload);const buffers=new Map();for(const row of rows)buffers.set(row.id,await download(db,row.object_key,row.sha256));
  const bytes=await(deps.render||generateCompletionReportPdf)({...report,status:'final',finalised_at:new Date().toISOString()},{photoBuffers:buffers});
  if(bytes.length>4*1024*1024)throw reportError('The report PDF is too large. Reduce the number of photographs.');
  const pdfKey=id+'/final/'+randomUUID()+'.pdf';const uploaded=await db.storage.from(REPORT_BUCKET).upload(pdfKey,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw reportError('Final PDF could not be stored. The report remains a draft.',503);
  return{report:await write(db,'finalise',id,actor,input.revision,{pdfKey,pdfSha256:hash(bytes)})};
 }
 if(action==='acknowledge'){
  if(typeof input.acknowledged!=='boolean')throw reportError('Choose whether receipt has been acknowledged.');
  return{report:await write(db,'acknowledge',id,actor,input.revision,{acknowledged:input.acknowledged,note:str(input.note,1000)})};
 }
 if(action==='resolve_send'){
  if(input.confirmed!==true||!['accepted','not_sent'].includes(input.outcome))throw reportError('Confirm the delivery check and its observed result.');
  const note=str(input.note,1000);if(note.length<10)throw reportError('Record how you verified delivery before resolving it.');
  return{send:await write(db,'resolve_send',id,actor,null,{operationId:requireId(input.operationId),outcome:input.outcome,note})};
 }
 if(action==='send'){
  if(input.confirmed!==true)throw reportError('Explicit send approval is required.');requireId(input.operationId);
  const message={recipient:input.recipient,subject:'Your cleaning completion report',body:'Please find your cleaning completion report attached. It records the work completed, observations and any exclusions. If you have any questions, please reply to this email.\n\nThank you,\nVVE Clean',style:'branded'};
  const validated=validateCustomerEmail(message);if(!validated.ok)throw reportError(validated.error);
  if(report.status!=='final')throw reportError('Finalise the report before sending.');
  if(!(deps.isConfigured||isMailerConfigured)())throw reportError('Email sending is not configured. The report is saved.',503);
  const bytes=await reportPdf(db,report);const rendered=buildCustomerEmail(validated.value,getBusinessSettings());
  const claim=await write(db,'claim_send',id,actor,null,{operationId:input.operationId,recipient:validated.value.recipient,resendConfirmed:input.resendConfirmed===true});
  if(!claim.claimed)return{send:claim.send,duplicatePrevented:true};
  let result;try{result=await(deps.send||sendMail)({to:validated.value.recipient,...rendered,fromName:'VVE Clean',messageId:'<vve-report-'+input.operationId+'@vveclean.co.uk>',attachments:[{filename:'VVE-Clean-Completion-Report.pdf',content:bytes,contentType:'application/pdf'}]});}catch{result={ok:false};}
  const status=result.ok?'accepted':'uncertain';
  try{return{send:await write(db,'finish_send',id,actor,null,{operationId:input.operationId,status,messageId:result.messageId||null})};}
  catch{return{send:{...claim.send,status:'uncertain'},warning:'Sending was attempted, but its final status could not be saved. Check Sent mail before any resend.'};}
 }
 throw reportError('Unsupported report action.');
}
