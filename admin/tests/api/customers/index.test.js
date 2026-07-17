import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/customers/index.js');

function makeRes() {
  const res = {
    statusCode: null, headers: null, body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}
function makeReq({ url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'GET', query } = {}) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    method,
    url,
    headers,
    query,
    on(event, cb) {
      if (event === 'data' && raw) cb(Buffer.from(raw));
      if (event === 'end') cb();
    },
  };
}

const ADMIN = { ok: true, admin: { id: 'admin-1' } };

// GET /api/customers and POST /api/customers — a plain literal file (no
// dynamic segment at all), the exact same proven-safe shape as
// admin/api/invoices/index.js. Was previously folded into
// admin/api/customers/[[...segments]].js's root-level optional catch-all,
// which turned out to 404 for exactly this zero-segment request on this
// Vercel deployment — see [id].js's header comment and
// admin/INVOICES_SETUP.md for the confirmed root cause.
describe('GET/POST /api/customers (list/create)', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
  });

  it('rejects unauthenticated requests', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('lists customers', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' }],
    }));
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers' }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results).toHaveLength(1);
  });

  it('rejects an invalid customerType filter', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers?customerType=wizard' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('creates a customer and returns duplicateWarnings', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: 'c-existing', name: 'Existing', email: 'dup@example.com', phone: null, postcode: null, normalised_email: 'dup@example.com', normalised_phone: null }],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: '/api/customers', method: 'POST',
      bodyObj: { name: 'New Landlord', email: 'dup@example.com', customerType: 'landlord', source: 'referral' },
    }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.customerType).toBe('landlord');
    expect(body.duplicateWarnings).toHaveLength(1);
    expect(body.duplicateWarnings[0].type).toBe('email');
  });

  it('rejects creating a customer with no name', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers', method: 'POST', bodyObj: { name: '' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects DELETE at the list root', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers', method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });

  // Exact Vercel-style shape for this route: a literal file has no
  // req.query.segments/id at all — req.query only ever carries genuine
  // query-string filters (page, sort, customerType, ...), confirming
  // filters are never mistaken for route segments (the specific failure
  // mode that broke the invoices catch-all for this exact kind of
  // request).
  it('handles the real Vercel req.query shape (query-string filters only, no route param)', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase({
      customers: [{ id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' }],
    }));
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers?page=1&sort=newest', query: { page: '1', sort: 'newest' } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results).toHaveLength(1);
  });
});
