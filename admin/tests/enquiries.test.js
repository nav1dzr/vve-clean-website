import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), deliver: vi.fn(), db: { from: vi.fn() } }));
vi.mock('../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: mocks.auth }));
vi.mock('../api/_lib/body.js', () => ({ readJsonBody: mocks.read }));
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: () => mocks.db }));
vi.mock('../api/_lib/enquiryNotifications.js', () => ({ deliverEnquiry: mocks.deliver }));
import { enquiriesHandler } from '../api/_lib/enquiries.js';
const id = '6155fbfb-7db7-4c5a-b7bb-9b8c67edb8d8';
const body = { id, action: 'update', status: 'contacted', notes: 'Agreed to call tomorrow.', expectedUpdatedAt: '2026-09-08T10:00:00.000Z' };
let query;
const response = () => ({ status: 0, body: null, writeHead(status) { this.status = status; }, end(raw) { this.body = raw ? JSON.parse(raw) : null; } });
async function request(method = 'POST', url = '/api/search?resource=enquiries') { const res = response(); await enquiriesHandler({ method, url, headers: {} }, res); return res; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ ok: true }); mocks.read.mockResolvedValue(body);
  query = { select: vi.fn(), update: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id } }), single: vi.fn().mockResolvedValue({ data: { id, delivery: { customerEmail: { status: 'failed' } } } }), then: resolve => resolve({ data: [], count: 0 }) };
  for (const key of ['select','update','eq','order','range']) query[key].mockReturnValue(query);
  mocks.db.from.mockReturnValue(query); mocks.deliver.mockResolvedValue({ customerEmail: { status: 'sent' } });
});
describe('private CRM enquiry actions', () => {
  it('requires staff authentication before reading any enquiry', async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorised' });
    expect((await request('GET')).status).toBe(401); expect(mocks.db.from).not.toHaveBeenCalled();
  });
  it('rejects a missing revision rather than overwriting another staff member', async () => {
    mocks.read.mockResolvedValue({ ...body, expectedUpdatedAt: undefined });
    expect((await request()).status).toBe(400); expect(query.update).not.toHaveBeenCalled();
  });
  it('uses the displayed revision and reports a stale edit as a conflict', async () => {
    query.maybeSingle.mockResolvedValue({ data: null });
    const res = await request(); expect(res.status).toBe(409); expect(res.body.error).toContain('changed');
    expect(query.eq).toHaveBeenCalledWith('updated_at', body.expectedUpdatedAt);
  });
  it('saves a current revision without changing notification state', async () => {
    expect((await request()).status).toBe(200);
    expect(query.update.mock.calls[0][0]).toMatchObject({ status: 'contacted', notes: body.notes });
    expect(query.update.mock.calls[0][0]).not.toHaveProperty('delivery');
  });
  it('requires checking destinations before an uncertain retry', async () => {
    mocks.read.mockResolvedValue({ id, action: 'retry' });
    expect((await request()).status).toBe(409); expect(mocks.deliver).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({ id, action: 'retry', confirmRetry: true });
    expect((await request()).status).toBe(200);
    expect(mocks.deliver).toHaveBeenCalledWith(mocks.db, expect.objectContaining({ id }), { retryUnconfirmed: true });
  });
  it('limits list pagination to whole rows and returns revision metadata', async () => {
    expect((await request('GET', '/api/search?resource=enquiries&offset=1.9')).status).toBe(200);
    expect(query.range).toHaveBeenCalledWith(1, 30);
    expect(query.select.mock.calls[0][0]).toContain('updated_at');
  });
});
