import { verifyAdminRequest } from './adminAuth.js';
import { corsHeaders } from './cors.js';
import { getServiceClient } from './supabaseAdmin.js';
import { readJsonBody } from './body.js';
import { actOnReport, getReport, reportDefaults, reportPdf, reportPhoto, requireId } from './completionReports.js';
export const config={api:{bodyParser:false},maxDuration:60};
export default async function handler(req,res){
 const headers={...corsHeaders(req.headers.origin||''),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json'};
 const reply=(status,value)=>{res.writeHead(status,headers);res.end(JSON.stringify(value));};
 if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
 if(!['GET','POST'].includes(req.method))return reply(405,{error:'Method not allowed'});
 const auth=await verifyAdminRequest(req);if(!auth.ok)return reply(auth.status,{error:auth.error});
 if(process.env.COMPLETION_REPORTS_ENABLED!=='true')return reply(503,{error:'Completion reports are awaiting setup. Existing invoices and receipts are unchanged.'});
 const db=getServiceClient();if(!db)return reply(503,{error:'Report storage is unavailable.'});
 try{
  if(req.method==='POST')return reply(200,await actOnReport(db,auth.admin.id,await readJsonBody(req,3400000)));
  const q=new URL(req.url,'https://admin.vveclean.co.uk').searchParams;const action=q.get('action');const id=q.get('id');
  if(action==='defaults')return reply(200,await reportDefaults(db,{bookingId:q.get('bookingId'),customerId:q.get('customerId')}));
  if(id){const report=await getReport(db,id);
   if(action==='pdf'){const bytes=await reportPdf(db,report);res.writeHead(200,{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="VVE-Clean-Completion-Report.pdf"'});return res.end(bytes);}
   if(action==='photo'){const file=await reportPhoto(db,report,q.get('photoId'),q.get('original')==='true');res.writeHead(200,{...headers,'Content-Type':file.mime});return res.end(file.bytes);}
   const historyPage=Number(q.get('historyPage')||'1');if(!Number.isInteger(historyPage)||historyPage<1||historyPage>100000)return reply(400,{error:'Invalid history page.'});
   const events=await db.from('cleaning_report_events').select('id,event_type,actor_id,created_at,detail').eq('report_id',id).order('created_at',{ascending:false}).range((historyPage-1)*30,historyPage*30);
   const sends=await db.from('cleaning_report_sends').select('id,recipient,status,created_at,accepted_at').eq('report_id',id).order('created_at',{ascending:false}).range((historyPage-1)*30,historyPage*30);
   if(events.error||sends.error)return reply(503,{error:'Report history is unavailable.'});return reply(200,{report,events:(events.data||[]).slice(0,30),sends:(sends.data||[]).slice(0,30),historyPage,historyHasMore:(events.data||[]).length>30||(sends.data||[]).length>30});
  }
  const page=Number(q.get('page')||'1');if(!Number.isInteger(page)||page<1||page>100000)return reply(400,{error:'Invalid report page.'});const pageSize=30;
  let query=db.from('cleaning_completion_reports').select('id,booking_id,customer_id,status,revision,payload,created_at,updated_at,finalised_at,acknowledgement').order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize);
  for(const [param,column] of [['bookingId','booking_id'],['customerId','customer_id']])if(q.get(param))query=query.eq(column,requireId(q.get(param)));
  const result=await query;if(result.error)return reply(503,{error:'Completion report storage is not ready.'});return reply(200,{reports:(result.data||[]).slice(0,pageSize),page,hasMore:(result.data||[]).length>pageSize});
 }catch(err){return reply(err.status||400,{error:err.status?err.message:'The request could not be completed. Check the report before trying again.'});}
}
