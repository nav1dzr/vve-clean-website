import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/invoices/index.js');

function makeRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}

function makeReq({ url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'GET' } = {}) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    method,
    url,
    headers,
    on(event, cb) {
      if (event === 'data' && raw) cb(Buffer.from(raw));
      if (event === 'end') cb();
    },
  };
}

const ADMIN = { ok: true, admin: { id: 'admin-1' } };

describe('GET /api/invoices', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid sort value', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices?sort=bogus' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid documentStatus filter', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices?documentStatus=archived' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('lists invoices with pagination metadata', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const supabase = createFakeSupabase({
      invoices: [
        { id: 'inv-1', invoice_number: 'INV-2026-000001', customer_name: 'A', total: 100, amount_due: 0, document_status: 'issued', payment_status: 'paid', due_date: '2026-08-01', issue_date: '2026-07-01', created_at: '2026-07-01T00:00:00Z' },
        { id: 'inv-2', invoice_number: null, customer_name: 'B', total: 50, amount_due: 50, document_status: 'draft', payment_status: 'unpaid', due_date: null, issue_date: null, created_at: '2026-07-02T00:00:00Z' },
      ],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices' }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results).toHaveLength(2);
    expect(body.totalCount).toBe(2);
  });
});

describe('POST /api/invoices', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('creates a draft invoice and returns 201 with the created document', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: '/api/invoices',
      method: 'POST',
      bodyObj: {
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }],
      },
    }), res);

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.documentStatus).toBe('draft');
    expect(body.total).toBe(100);
  });

  it('rejects a bogus bookingId', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({
      url: '/api/invoices',
      method: 'POST',
      bodyObj: { bookingId: 'not-a-uuid', customer: { name: 'X', email: 'x@example.com' }, items: [] },
    }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when the lifecycle layer rejects the input (e.g. no items)', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: '/api/invoices',
      method: 'POST',
      bodyObj: { customer: { name: 'Jane', email: 'jane@example.com' }, items: [] },
    }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-GET/POST methods', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices', method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });
});
