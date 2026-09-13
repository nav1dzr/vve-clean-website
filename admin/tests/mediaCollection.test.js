import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './api/_lib/fakeSupabase.js';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), config: vi.fn(), upload: vi.fn() }));
vi.mock('../api/_lib/adminAuth.js', () => ({ verifyMediaAdminRequest: mocks.auth }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getMediaServiceClient: mocks.client }));
vi.mock('../api/_lib/mediaConfig.js', () => ({ getMediaConfig: mocks.config, createUploadUrl: mocks.upload, createR2Key: (id) => `originals/${id}/source.jpg` }));
import { mediaCollectionHandler } from '../api/_lib/mediaCollectionActions.js';
let db;
const id = number => `11111111-2222-3333-4444-${String(number).padStart(12,'0')}`;
async function call(method='GET', body={}, query={}) {
  const raw=JSON.stringify(body);
  const req={method,headers:{},query,on(event,cb){if(event==='data')cb(Buffer.from(raw));if(event==='end')cb();}};
  const res={statusCode:0,body:null,writeHead(status){this.statusCode=status;},end(raw){this.body=JSON.parse(raw);}};
  await mediaCollectionHandler(req,res);return res;
}
beforeEach(()=>{
  vi.clearAllMocks();mocks.auth.mockResolvedValue({ok:true,admin:{id:id(100)}});mocks.config.mockReturnValue({});mocks.upload.mockResolvedValue('https://upload.example/signed');
  db=createFakeSupabase({media_assets:Array.from({length:35},(_,i)=>({id:id(i),media_type:'image',category:'carpet',status:'ready',created_at:'2026-09-08',delivery_url:'https://media.example/{width}/asset.jpg'})),media_assignments:[{asset_id:id(34),gallery_slot_id:id(50),media_role:'primary'}]});mocks.client.mockReturnValue(db);
});
describe('media library listing and upload plans',()=>{
  it('paginates the library and supplies older assets still used by positions',async()=>{
    const first=await call('GET',{}, {category:'carpet'});expect(first.statusCode).toBe(200);expect(first.body.assets).toHaveLength(30);expect(first.body.nextPage).toBe(1);expect(first.body.assignedAssets[0].id).toBe(id(34));
    const second=await call('GET',{}, {category:'carpet',page:'1'});expect(second.body.assets).toHaveLength(5);expect(second.body.nextPage).toBeNull();
  });
  it('rejects invalid files before creating records or signed URLs',async()=>{expect((await call('POST',{filename:'script.svg',contentType:'image/svg+xml',size:100})).statusCode).toBe(400);expect(db._tables.media_assets).toHaveLength(35);expect(mocks.upload).not.toHaveBeenCalled();});
  it('creates only a private draft and checks the selected provider',async()=>{
    expect((await call('POST',{filename:'photo.jpg',contentType:'image/jpeg',size:123,category:'carpet',websiteVisible:true})).statusCode).toBe(201);
    expect(mocks.config).toHaveBeenCalledWith('image');expect(db._tables.media_assets.at(-1).website_visible).toBe(false);expect(db._tables.media_assets.at(-1).requested_slot_key).toBeNull();
  });
  it('denies an unauthorised upload before accessing hosting',async()=>{mocks.auth.mockResolvedValue({ok:false,status:403,error:'Forbidden'});expect((await call('POST',{filename:'photo.jpg'})).statusCode).toBe(403);expect(mocks.config).not.toHaveBeenCalled();});
});
