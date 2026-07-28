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
        or: () => builder,
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

  describe('superseded-booking detection', () => {
    // Base fixture mirrors the actual motivating example (two "Natalie
    // Ashton" rows, both NW3 7AJ, both 2026-07-17 Morning, differing only
    // in item count) — see markSupersededPendingBookings' own comment in
    // admin/api/bookings/index.js for the full signal list this proves.
    function pendingListRow(overrides = {}) {
      return {
        id: 'b-pending', booking_ref: 'REF1', full_name: 'Natalie Ashton', phone: '07700900000', postcode: 'NW3 7AJ',
        service: 'Carpet & upholstery · 1 item', preferred_date: '2026-07-17', preferred_time: 'Morning',
        service_date: null, status: 'new', payment_status: 'pending_payment', total_price: 50,
        created_at: '2026-07-17T09:00:00.000Z',
        ...overrides,
      };
    }

    function pendingDetail(overrides = {}) {
      return {
        id: 'b-pending', phone: '07700900000', email: null, postcode: 'NW3 7AJ',
        preferred_date: '2026-07-17', service: 'Carpet & upholstery · 1 item',
        created_at: '2026-07-17T09:00:00.000Z',
        ...overrides,
      };
    }

    function paidDetail(overrides = {}) {
      return {
        id: 'b-paid', phone: '07700900000', email: null, postcode: 'NW3 7AJ',
        preferred_date: '2026-07-17', service: 'Carpet & upholstery · 2 items',
        created_at: '2026-07-17T09:30:00.000Z',
        ...overrides,
      };
    }

    async function runSupersededCheck(pendingDetailRow, paidCandidates) {
      verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
      getServiceClientMock.mockReturnValue(makeQueuedClient([
        { data: [pendingListRow()], error: null, count: 1 },
        { data: [pendingDetailRow], error: null },
        { data: paidCandidates, error: null },
      ]));
      const res = makeRes();
      await handler(makeReq('/api/bookings'), res);
      return JSON.parse(res.body).results[0].superseded;
    }

    it('hides an abandoned quote attempt followed by a successful retry (the real Natalie Ashton example — different item count, same property/date/phone)', async () => {
      const superseded = await runSupersededCheck(pendingDetail(), [paidDetail()]);
      expect(superseded).toBe(true);
    });

    it('does NOT hide a pending booking when the paid sibling is for a different property (postcode)', async () => {
      const superseded = await runSupersededCheck(pendingDetail(), [paidDetail({ postcode: 'E8 1AA' })]);
      expect(superseded).toBe(false);
    });

    it('does NOT hide a pending booking when the paid sibling is for a different service date', async () => {
      const superseded = await runSupersededCheck(pendingDetail(), [paidDetail({ preferred_date: '2026-07-20' })]);
      expect(superseded).toBe(false);
    });

    it('does NOT hide a pending booking when the paid sibling is a different service category (not just a different item count)', async () => {
      const superseded = await runSupersededCheck(pendingDetail(), [paidDetail({ service: 'Window Cleaning' })]);
      expect(superseded).toBe(false);
    });

    it('does NOT hide a pending booking with no matching paid sibling at all', async () => {
      const superseded = await runSupersededCheck(pendingDetail(), []);
      expect(superseded).toBe(false);
    });

    it('does NOT hide a pending booking when the "paid sibling" actually happened before it (two real same-day bookings, unrelated order)', async () => {
      const superseded = await runSupersededCheck(
        pendingDetail({ created_at: '2026-07-17T12:00:00.000Z' }),
        [paidDetail({ created_at: '2026-07-17T09:00:00.000Z' })],
      );
      expect(superseded).toBe(false);
    });

    it('does NOT hide a pending booking when the matching paid sibling is more than 24h later', async () => {
      const superseded = await runSupersededCheck(
        pendingDetail({ created_at: '2026-07-01T10:00:00.000Z' }),
        [paidDetail({ created_at: '2026-07-17T10:00:00.000Z' })],
      );
      expect(superseded).toBe(false);
    });

    it('matches on email when phone differs but email is the same', async () => {
      const superseded = await runSupersededCheck(
        pendingDetail({ phone: '07700900000', email: 'jane@example.com' }),
        [paidDetail({ phone: '07999888777', email: 'JANE@example.com' })],
      );
      expect(superseded).toBe(true);
    });
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
