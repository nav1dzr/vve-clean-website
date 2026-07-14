import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../api/dashboard-summary.js');

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

function makeChainable(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gt: () => builder,
    not: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

// Dashboard-summary.js issues 7 `.from('bookings')` calls, in a fixed
// literal order, inside one Promise.all — a FIFO queue lines canned
// responses up against that order.
function makeQueuedClient(results) {
  let i = 0;
  return { from: () => makeChainable(results[i++]) };
}

const cardRow = {
  id: '1', booking_ref: 'REF1', full_name: 'A', phone: '07', postcode: 'N1', service: 'window',
  preferred_date: null, preferred_time: null, service_date: null, status: 'new', payment_status: 'paid',
  total_price: null, created_at: '2026-07-01T00:00:00.000Z',
};

describe('GET /api/dashboard-summary', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-GET methods', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns the auth failure status when not an authorised admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(403);
  });

  it('returns honest counts and marks balance data unavailable when no rows have a balance_status yet', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@example.com', displayName: 'Sam' } });

    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: [], error: null, count: 0 },        // today
      { data: [], error: null, count: 0 },        // upcoming
      { data: [cardRow], error: null, count: 1 }, // recent
      { data: null, error: null, count: 3 },      // depositsPaid
      { data: null, error: null, count: 0 },      // outstanding
      { data: null, error: null, count: 0 },      // trackedBalance — no row has balance_status set
      { data: null, error: null, count: 5 },      // unscheduled
    ]));

    const res = makeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' } }, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.today).toEqual({ count: 0, bookings: [] });
    expect(body.recent.count).toBe(1);
    expect(body.recent.bookings[0].bookingRef).toBe('REF1');
    expect(body.depositsPaid).toEqual({ count: 3 });
    expect(body.outstandingBalances).toEqual({ count: 0, dataAvailable: false });
    expect(body.unscheduledCount).toBe(5);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('marks balance data available once at least one row has a balance_status', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@example.com', displayName: 'Sam' } });
    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: [], error: null, count: 0 },
      { data: [], error: null, count: 0 },
      { data: [], error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 2 },
      { data: null, error: null, count: 10 },
      { data: null, error: null, count: 0 },
    ]));

    const res = makeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' } }, res);

    const body = JSON.parse(res.body);
    expect(body.outstandingBalances).toEqual({ count: 2, dataAvailable: true });
  });

  it('returns a generic 500 and never leaks query error detail when a query fails', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'a', email: 'a@example.com', displayName: 'Sam' } });
    getServiceClientMock.mockReturnValue(makeQueuedClient([
      { data: null, error: { code: '500', message: 'db exploded with secret detail' }, count: 0 },
      { data: [], error: null, count: 0 },
      { data: [], error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
    ]));

    const res = makeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret detail');
  });
});
