import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('./_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('./_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('./search.js');

function makeRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers;
    },
    end(body) {
      res.body = body || '';
    },
  };
  return res;
}

function makeBodyReq(bodyObj, headers = { authorization: 'Bearer t' }) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    method: 'POST',
    headers,
    on(event, cb) {
      if (event === 'data' && raw) cb(Buffer.from(raw));
      if (event === 'end') cb();
    },
  };
}

describe('POST /api/search', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    rpcMock.mockReset();
  });

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns the auth failure status for an unauthenticated caller, before touching the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeBodyReq({ q: 'Jasmine' }), res);
    expect(res.statusCode).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects an empty query before ever calling the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@x.com', displayName: 'Sam' } });
    const res = makeRes();
    await handler(makeBodyReq({ q: '' }), res);
    expect(res.statusCode).toBe(400);
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('rejects an overly long query', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@x.com', displayName: 'Sam' } });
    const res = makeRes();
    await handler(makeBodyReq({ q: 'a'.repeat(500) }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-string q', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@x.com', displayName: 'Sam' } });
    const res = makeRes();
    await handler(makeBodyReq({ q: 12345 }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns mapped, safe result cards for a valid query', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@x.com', displayName: 'Sam' } });
    getServiceClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: [{
        id: '1', booking_ref: 'N15NJ180726', full_name: 'Jasmine Carter', phone: '07123456789',
        postcode: 'N15 5NJ', service: 'end_of_tenancy', preferred_date: '2026-07-18', preferred_time: '10:00',
        service_date: '2026-07-18', status: 'confirmed', payment_status: 'paid', total_price: 249,
        created_at: '2026-07-01T00:00:00.000Z',
      }],
      error: null,
    });

    const res = makeRes();
    await handler(makeBodyReq({ q: 'Jasmine' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('search_bookings', { search_query: 'Jasmine', result_limit: 50 });
    const body = JSON.parse(res.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].bookingRef).toBe('N15NJ180726');
    expect(JSON.stringify(body)).not.toMatch(/confirmation_token/i);
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@x.com', displayName: 'Sam' } });
    getServiceClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'internal detail' } });

    const res = makeRes();
    await handler(makeBodyReq({ q: 'Jasmine' }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
