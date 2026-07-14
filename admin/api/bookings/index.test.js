import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('./index.js');

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

function makeChainableClient(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    range: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return { from: () => builder };
}

function makeReq(url, headers = { authorization: 'Bearer t' }) {
  return { method: 'GET', url, headers };
}

describe('GET /api/bookings', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-GET methods', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, url: '/api/bookings' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns the auth failure status when unauthenticated', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq('/api/bookings'), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid sort value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?sort=most_expensive'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid booking status value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?status=archived'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid payment status value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?paymentStatus=refunded'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a malformed dateFrom', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?dateFrom=18-07-2026'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a malformed dateTo', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?dateTo=not-a-date'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a filter value containing control characters', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler(makeReq('/api/bookings?service=' + encodeURIComponent('window\x00')), res);
    expect(res.statusCode).toBe(400);
  });

  it('caps pageSize at the maximum regardless of what is requested', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    getServiceClientMock.mockReturnValue(makeChainableClient({ data: [], error: null, count: 0 }));

    const res = makeRes();
    await handler(makeReq('/api/bookings?pageSize=500'), res);

    const body = JSON.parse(res.body);
    expect(body.pageSize).toBe(50);
  });

  it('returns mapped results with pagination metadata', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const row = {
      id: '1', booking_ref: 'REF1', full_name: 'A', phone: '07', postcode: 'N1', service: 'window',
      preferred_date: null, preferred_time: null, service_date: null, status: 'new', payment_status: 'paid',
      total_price: null, created_at: '2026-07-01T00:00:00.000Z',
    };
    getServiceClientMock.mockReturnValue(makeChainableClient({ data: [row], error: null, count: 25 }));

    const res = makeRes();
    await handler(makeReq('/api/bookings?page=1&pageSize=20'), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].bookingRef).toBe('REF1');
    expect(body.totalCount).toBe(25);
    expect(body.hasMore).toBe(true);
  });

  it('accepts every whitelisted sort value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    for (const sort of ['newest', 'oldest', 'service_date', 'highest_value']) {
      getServiceClientMock.mockReturnValue(makeChainableClient({ data: [], error: null, count: 0 }));
      const res = makeRes();
      await handler(makeReq(`/api/bookings?sort=${sort}`), res);
      expect(res.statusCode).toBe(200);
    }
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    getServiceClientMock.mockReturnValue(
      makeChainableClient({ data: null, error: { code: '500', message: 'internal detail' }, count: 0 }),
    );

    const res = makeRes();
    await handler(makeReq('/api/bookings'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
