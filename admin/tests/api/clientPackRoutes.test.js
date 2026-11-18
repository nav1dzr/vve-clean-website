import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
const mock=vi.hoisted(()=>({auth:vi.fn(),db:vi.fn(),view:vi.fn(),act:vi.fn(),isolation:vi.fn()}));
vi.mock('../../api/_lib/adminAuth.js',()=>({verifyAdminRequest:mock.auth}));
vi.mock('../../api/_lib/supabaseAdmin.js',()=>({getServiceClient:mock.db}));
vi.mock('../../api/_lib/previewIsolation.js',()=>({previewIsolation:mock.isolation}));
vi.mock('../../api/_lib/clientPacks.js',()=>({viewPack:mock.view,actOnPack:mock.act,adminFields:x=>x,getPack:vi.fn(),listPacks:vi.fn()}));
import admin from '../../api/_lib/clientPackRoute.js';
import viewer from '../../api/_lib/clientPackViewRoute.js';
import dispatcher from '../../api/customers/index.js';
function request(body={}){const r=Readable.from([JSON.stringify(body)]);r.method='POST';r.url='/api/customers?resource=client-pack-view';r.headers={};return r;}
function response(){return{writeHead:vi.fn(),end:vi.fn()};}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CLIENT_PACKS_ENABLED','true');mock.auth.mockResolvedValue({ok:true,admin:{id:'actor'}});mock.db.mockReturnValue({});mock.isolation.mockReturnValue({ok:true});mock.view.mockResolvedValue({title:'Safe title'});mock.act.mockResolvedValue({pack:{id:'test'}});});
afterEach(()=>vi.unstubAllEnvs());
describe('client pack HTTP boundaries',()=>{
 it('dispatches public viewing without relaxing normal customer/admin auth',async()=>{
  mock.auth.mockResolvedValue({ok:false,status:401,error:'Sign in'});
  const publicRes=response();await dispatcher(request({token:'A'.repeat(43)}),publicRes);expect(publicRes.writeHead.mock.calls[0][0]).toBe(200);expect(mock.auth).not.toHaveBeenCalled();
  for(const url of ['/api/customers','/api/customers?resource=client-packs']){const req=request({action:'create'});req.url=url;const r=response();await dispatcher(req,r);expect(r.writeHead.mock.calls[0][0]).toBe(401);}
  expect(mock.act).not.toHaveBeenCalled();
 });
 it('keeps the public feature gate through the existing dispatcher',async()=>{vi.stubEnv('CLIENT_PACKS_ENABLED','');const r=response();await dispatcher(request({token:'A'.repeat(43)}),r);expect(r.writeHead.mock.calls[0][0]).toBe(503);expect(mock.view).not.toHaveBeenCalled();});
 it('requires admin authentication',async()=>{mock.auth.mockResolvedValue({ok:false,status:401,error:'Sign in'});const r=response();await admin(request({action:'create'}),r);expect(r.writeHead.mock.calls[0][0]).toBe(401);expect(mock.act).not.toHaveBeenCalled();});
 it('defaults both endpoints off',async()=>{vi.stubEnv('CLIENT_PACKS_ENABLED','');for(const handler of [admin,viewer]){const r=response();await handler(request(),r);expect(r.writeHead.mock.calls[0][0]).toBe(503);}expect(mock.view).not.toHaveBeenCalled();expect(mock.act).not.toHaveBeenCalled();});
 it('blocks unsafe preview on customer endpoint',async()=>{mock.isolation.mockReturnValue({ok:false,error:'Preview blocked'});const r=response();await viewer(request({token:'secret'}),r);expect(r.writeHead.mock.calls[0][0]).toBe(403);expect(mock.db).not.toHaveBeenCalled();});
 it('never accepts GET query tokens',async()=>{const req=request();req.method='GET';req.url='/api/customers?resource=client-pack-view&token=secret';const r=response();await viewer(req,r);expect(r.writeHead.mock.calls[0][0]).toBe(405);expect(mock.view).not.toHaveBeenCalled();});
 it('prevents response caching/referrer leakage',async()=>{const r=response();await viewer(request({token:'A'.repeat(43)}),r);expect(r.writeHead.mock.calls[0][0]).toBe(200);expect(r.writeHead.mock.calls[0][1]).toMatchObject({'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});expect(r.end.mock.calls[0][0]).toBe('{"title":"Safe title"}');});
});
