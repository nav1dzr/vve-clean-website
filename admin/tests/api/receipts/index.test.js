import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/receipts/index.js');

function makeRes() {
  const res = {
    statusCode: null, headers: null, body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}
function makeReq({ url, headers = { authorization: 'Bearer t' }, method = 'GET' } = {}) {
  return { method, url, headers, on(event, cb) { if (event === 'end') cb(); } };
}

const ADMIN = { ok: true, admin: { id: 'admin-1' } };

describe('GET /api/receipts', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-GET methods (no POST — receipts are never created directly)', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts', method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('lists receipts', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const supabase = createFakeSupabase({
      receipts: [{ id: 'r-1', receipt_number: 'REC-2026-000001', customer_name: 'Jane', total_paid: 100, payment_date: '2026-07-16', created_at: '2026-07-16T00:00:00Z' }],
    });
    getServiceClientMock.mockReturnValue(supabase);
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts' }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results).toHaveLength(1);
  });

  it('rejects an invalid invoiceId filter', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts?invoiceId=not-a-uuid' }), res);
    expect(res.statusCode).toBe(400);
  });
});
