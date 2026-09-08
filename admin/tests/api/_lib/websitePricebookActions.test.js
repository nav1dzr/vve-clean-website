import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), body: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: mocks.auth }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: mocks.db }));
vi.mock('../../../api/_lib/body.js', () => ({ readJsonBody: mocks.body }));
vi.mock('../../../api/_lib/websitePricebook.js', async importOriginal => ({ ...await importOriginal(), requestPricebookRefresh: mocks.refresh }));
import { websitePricebookHandler } from '../../../api/_lib/websitePricebookActions.js';

const savedId = '4a2cf53d-3394-43e7-a809-d081dd852ca1';
const adminId = '35a5a16a-2021-4236-9780-42bcf4a7612d';
function response() { return { writeHead: vi.fn(), end: vi.fn() }; }
function bodyOf(res) { return JSON.parse(res.end.mock.calls[0][0]); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, admin: { id: adminId } });
  vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED','true');
  vi.stubEnv('WEBSITE_PRICEBOOK_REFRESH_URL','https://example.test/refresh');
  mocks.refresh.mockResolvedValue({ status: 'requested', recorded: true });
});
describe('protected website pricebook publication', () => {
  it('rejects unauthorised writes before accessing the price tables', async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 403, error: 'Not authorised' });
    const res = response();
    await websitePricebookHandler({ method: 'POST', headers: {} }, res);
    expect(res.writeHead.mock.calls[0][0]).toBe(403);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('previews a draft without any database write', async () => {
    const db = { from: vi.fn(), rpc: vi.fn() }; mocks.db.mockReturnValue(db);
    mocks.body.mockResolvedValue({ action: 'preview', label: 'Review', overrides: { CARPET_ITEM_PRICES_P: { sofa_2: 9000 } } });
    const res = response(); await websitePricebookHandler({ method: 'POST', headers: {} }, res);
    expect(res.writeHead.mock.calls[0][0]).toBe(200);
    expect(bodyOf(res).examples[1].pence).toBe(9000);
    expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('blocks publication while the runtime feature is disabled', async () => {
    vi.stubEnv('WEBSITE_PRICEBOOK_ENABLED','false');
    const db = { from: vi.fn(), rpc: vi.fn() }; mocks.db.mockReturnValue(db);
    mocks.body.mockResolvedValue({ action: 'publish', versionId: savedId, expectedVersionId: 'bundled' });
    const res = response(); await websitePricebookHandler({ method: 'POST', headers: {} }, res);
    expect(res.writeHead.mock.calls[0][0]).toBe(409); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('publishes only the reviewed saved version with an optimistic concurrency check', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: savedId, label: 'Saved', overrides: {} } }) };
    const db = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: { id: savedId, publicationId: savedId } }) }; mocks.db.mockReturnValue(db);
    mocks.body.mockResolvedValue({ action: 'publish', versionId: savedId, expectedVersionId: 'bundled' });
    const res = response(); await websitePricebookHandler({ method: 'POST', headers: {} }, res);
    expect(db.rpc).toHaveBeenCalledWith('publish_website_pricebook', { p_version_id: savedId, p_expected_version_id: null, p_admin_id: adminId });
    expect(mocks.refresh).toHaveBeenCalledWith(savedId, db);
    expect(bodyOf(res).message).toMatch(/confirm the website build completes/i);
  });
  it('reports a competing publication and does not trigger another website refresh', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: savedId, label: 'Saved', overrides: {} } }) };
    const db = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ error: { message: 'PRICEBOOK_CONFLICT' } }) }; mocks.db.mockReturnValue(db);
    mocks.body.mockResolvedValue({ action: 'publish', versionId: savedId, expectedVersionId: 'bundled' });
    const res = response(); await websitePricebookHandler({ method: 'POST', headers: {} }, res);
    expect(res.writeHead.mock.calls[0][0]).toBe(409); expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
