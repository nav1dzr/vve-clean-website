import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/bookings/index.js');

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

// For tests that need the superseded-booking lookup's second query (to
// bookings again, for paid siblings) to return something different from
// the first (main list) query — makeChainableClient's single shared
// result can't express that. Returns each queued result in call order.
function makeQueuedClient(results) {
  const queue = [...results];
  return {
    from: () => {
      // Each call to .from() starts a new query chain — resolve it to the
      // next queued result (repeating the last one once the queue is
      // empty, so an unexpected extra call doesn't crash the test).
      const result = queue.length > 1 ? queue.shift() : queue[0];
      const builder = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        gte: () => builder,
        lte: () => builder,
        in: () => builder,
        order: () => builder,
        range: () => builder,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
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

  it('marks a pending booking as superseded when a same-phone paid booking exists within 24h', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const pendingRow = {
      id: 'b-pending', booking_ref: 'REF1', full_name: 'Natalie Ashton', phone: '07700900000', postcode: 'NW3',
      service: 'carpet', preferred_date: null, preferred_time: null, service_date: null, status: 'new',
      payment_status: 'pending_payment', total_price: 50, created_at: '2026-07-17T10:00:00.000Z',
    };
    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: [pendingRow], error: null, count: 1 },
      { data: [{ phone: '07700900000', created_at: '2026-07-17T10:30:00.000Z' }], error: null },
    ]));

    const res = makeRes();
    await handler(makeReq('/api/bookings'), res);

    const body = JSON.parse(res.body);
    expect(body.results[0].superseded).toBe(true);
  });

  it('does not mark a pending booking as superseded when no same-phone paid sibling exists', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const pendingRow = {
      id: 'b-pending', booking_ref: 'REF1', full_name: 'Natalie Ashton', phone: '07700900000', postcode: 'NW3',
      service: 'carpet', preferred_date: null, preferred_time: null, service_date: null, status: 'new',
      payment_status: 'pending_payment', total_price: 50, created_at: '2026-07-17T10:00:00.000Z',
    };
    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: [pendingRow], error: null, count: 1 },
      { data: [], error: null },
    ]));

    const res = makeRes();
    await handler(makeReq('/api/bookings'), res);

    const body = JSON.parse(res.body);
    expect(body.results[0].superseded).toBe(false);
  });

  it('does not mark a pending booking as superseded when the same-phone paid sibling is more than 24h away', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const pendingRow = {
      id: 'b-pending', booking_ref: 'REF1', full_name: 'Natalie Ashton', phone: '07700900000', postcode: 'NW3',
      service: 'carpet', preferred_date: null, preferred_time: null, service_date: null, status: 'new',
      payment_status: 'pending_payment', total_price: 50, created_at: '2026-07-01T10:00:00.000Z',
    };
    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: [pendingRow], error: null, count: 1 },
      { data: [{ phone: '07700900000', created_at: '2026-07-17T10:00:00.000Z' }], error: null },
    ]));

    const res = makeRes();
    await handler(makeReq('/api/bookings'), res);

    const body = JSON.parse(res.body);
    expect(body.results[0].superseded).toBe(false);
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
