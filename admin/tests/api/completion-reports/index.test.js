import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const auth=vi.fn(),service=vi.fn(),act=vi.fn(),get=vi.fn(),pdf=vi.fn(),photo=vi.fn();
vi.mock('../../../api/_lib/adminAuth.js',()=>({verifyAdminRequest:(...a)=>auth(...a)}));
vi.mock('../../../api/_lib/supabaseAdmin.js',()=>({getServiceClient:()=>service()}));
vi.mock('../../../api/_lib/completionReports.js',()=>({actOnReport:(...a)=>act(...a),getReport:(...a)=>get(...a),reportPdf:(...a)=>pdf(...a),reportPhoto:(...a)=>photo(...a),reportDefaults:vi.fn(),requireId:x=>{if(!/^[a-f0-9-]{36}$/.test(x))throw Object.assign(Error('Invalid reference'),{status:400});return x;}}));
const{default:handler}=await import('../../../api/_lib/completionReportRoute.js');
function req(method='GET',url='/api/completion-reports',body){const raw=body?JSON.stringify(body):'';return{method,url,headers:{authorization:'Bearer test'},on:(event,cb)=>{if(event==='data'&&raw)cb(Buffer.from(raw));if(event==='end')cb();},destroy:vi.fn()};}
function res(){return{statusCode:0,headers:{},body:null,writeHead(n,h){this.statusCode=n;this.headers=h;},end(b){this.body=b;}};}
const id='11111111-1111-4111-8111-111111111111';
describe('completion report API access',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('COMPLETION_REPORTS_ENABLED','true');auth.mockResolvedValue({ok:true,admin:{id:'staff'}});service.mockReturnValue({});get.mockResolvedValue({id,status:'draft'});});afterEach(()=>vi.unstubAllEnvs());
 it('rejects unauthenticated reads and sends',async()=>{auth.mockResolvedValue({ok:false,status:401,error:'Sign in'});for(const method of ['GET','POST']){const r=res();await handler(req(method),r);expect(r.statusCode).toBe(401);}expect(service).not.toHaveBeenCalled();expect(act).not.toHaveBeenCalled();});
 it('rejects signed-in users outside the admin allow-list',async()=>{auth.mockResolvedValue({ok:false,status:403,error:'Not authorised'});const r=res();await handler(req('GET'),r);expect(r.statusCode).toBe(403);expect(get).not.toHaveBeenCalled();});
 it('fails closed until the explicit feature flag is enabled',async()=>{vi.stubEnv('COMPLETION_REPORTS_ENABLED','false');const r=res();await handler(req('POST','/api/completion-reports',{action:'send'}),r);expect(r.statusCode).toBe(503);expect(act).not.toHaveBeenCalled();});
 it('rejects unsupported HTTP methods',async()=>{const r=res();await handler(req('DELETE'),r);expect(r.statusCode).toBe(405);expect(act).not.toHaveBeenCalled();});
 it('returns no-store authenticated PDF bytes',async()=>{pdf.mockResolvedValue(Buffer.from('PDF'));const r=res();await handler(req('GET','/api/completion-reports?action=pdf&id='+id),r);expect(r.statusCode).toBe(200);expect(r.headers['Cache-Control']).toBe('no-store');expect(r.headers['Content-Type']).toBe('application/pdf');expect(r.body).toEqual(Buffer.from('PDF'));});
 it('passes original-image access through report ownership lookup',async()=>{photo.mockResolvedValue({bytes:Buffer.from('photo'),mime:'image/png'});const r=res();await handler(req('GET','/api/completion-reports?action=photo&id='+id+'&photoId='+id+'&original=true'),r);expect(get).toHaveBeenCalledWith({},id);expect(photo).toHaveBeenCalledWith({},{id,status:'draft'},id,true);expect(r.headers['Content-Type']).toBe('image/png');});
 it('passes staff identity for audit rather than trusting body actor',async()=>{act.mockResolvedValue({report:{id}});const r=res();await handler(req('POST','/api/completion-reports',{action:'create',actor:'attacker'}),r);expect(act.mock.calls[0][1]).toBe('staff');expect(r.statusCode).toBe(200);});
 it('hides internal errors and tokens',async()=>{act.mockRejectedValue(Error('secret database password'));const r=res();await handler(req('POST','/api/completion-reports',{action:'create'}),r);expect(String(r.body)).not.toContain('secret');});
 it('rejects invalid pagination',async()=>{const r=res();await handler(req('GET','/api/completion-reports?page=-1'),r);expect(r.statusCode).toBe(400);});
});
