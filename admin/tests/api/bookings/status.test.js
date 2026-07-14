import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/bookings/[id]/status.js');

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

function makeReq({ url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'PATCH' } = {}) {
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

function makeUpdateClient(result) {
  const updateCall = { payload: null };
  const client = {
    from: () => ({
      update: (payload) => {
        updateCall.payload = payload;
        return {
          eq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve(result),
            }),
          }),
        };
      },
    }),
  };
  return { client, updateCall };
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('PATCH /api/bookings/:id/status', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-PATCH methods', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 for a missing token', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status` }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a non-admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status` }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects an invalid booking UUID', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: '/api/bookings/not-a-uuid/status', bodyObj: { status: 'confirmed' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid status value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status: 'archived' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects payment-status values leaking into the operational-status whitelist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status: 'deposit_paid' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('accepts every whitelisted status value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const values = ['new', 'confirmed', 'scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled', 'no_show'];
    for (const status of values) {
      const { client } = makeUpdateClient({
        data: { id: VALID_UUID, status, updated_at: '2026-07-13T00:00:00.000Z' },
        error: null,
      });
      getServiceClientMock.mockReturnValue(client);
      const res = makeRes();
      await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status } }), res);
      expect(res.statusCode).toBe(200);
    }
  });

  it('returns 404 when the booking does not exist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client } = makeUpdateClient({ data: null, error: null });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status: 'confirmed' } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('updates only status and updated_at — never payment_status', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client, updateCall } = makeUpdateClient({
      data: { id: VALID_UUID, status: 'confirmed', updated_at: '2026-07-13T00:00:00.000Z' },
      error: null,
    });
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status: 'confirmed' } }), res);

    expect(res.statusCode).toBe(200);
    expect(Object.keys(updateCall.payload).sort()).toEqual(['status', 'updated_at']);
    expect(updateCall.payload).not.toHaveProperty('payment_status');

    const body = JSON.parse(res.body);
    expect(body).toEqual({ id: VALID_UUID, status: 'confirmed', updatedAt: '2026-07-13T00:00:00.000Z' });
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client } = makeUpdateClient({ data: null, error: { code: '500', message: 'internal detail' } });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/status`, bodyObj: { status: 'confirmed' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
