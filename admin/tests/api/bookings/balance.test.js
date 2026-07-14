import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/bookings/[id]/balance.js');

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

describe('PATCH /api/bookings/:id/balance', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-PATCH methods', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 for a missing token', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance` }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid booking UUID', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: '/api/bookings/not-a-uuid/balance', bodyObj: { balanceStatus: 'paid' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid balanceStatus value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'refunded' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid balancePaymentMethod value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(
      makeReq({
        url: `/api/bookings/${VALID_UUID}/balance`,
        bodyObj: { balanceStatus: 'paid', balancePaymentMethod: 'crypto' },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('accepts every whitelisted balance status', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    for (const balanceStatus of ['not_due', 'outstanding', 'paid', 'waived']) {
      const { client } = makeUpdateClient({
        data: {
          id: VALID_UUID, balance_status: balanceStatus,
          balance_paid_at: balanceStatus === 'paid' ? '2026-07-13T00:00:00.000Z' : null,
          balance_payment_method: null, updated_at: '2026-07-13T00:00:00.000Z',
        },
        error: null,
      });
      getServiceClientMock.mockReturnValue(client);
      const res = makeRes();
      await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus } }), res);
      expect(res.statusCode).toBe(200);
    }
  });

  it('auto-sets balance_paid_at when balanceStatus becomes paid with no explicit timestamp', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client, updateCall } = makeUpdateClient({
      data: { id: VALID_UUID, balance_status: 'paid', balance_paid_at: '2026-07-13T00:00:00.000Z', balance_payment_method: 'cash', updated_at: '2026-07-13T00:00:00.000Z' },
      error: null,
    });
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(
      makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'paid', balancePaymentMethod: 'cash' } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(updateCall.payload.balance_paid_at).not.toBeNull();
    expect(updateCall.payload.balance_payment_method).toBe('cash');
  });

  it('clears balance_paid_at and balance_payment_method when moving away from paid', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client, updateCall } = makeUpdateClient({
      data: { id: VALID_UUID, balance_status: 'outstanding', balance_paid_at: null, balance_payment_method: null, updated_at: '2026-07-13T00:00:00.000Z' },
      error: null,
    });
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(
      makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'outstanding' } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(updateCall.payload.balance_paid_at).toBeNull();
    expect(updateCall.payload.balance_payment_method).toBeNull();
  });

  it('never touches payment_status, deposit_amount, or total_price', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client, updateCall } = makeUpdateClient({
      data: { id: VALID_UUID, balance_status: 'paid', balance_paid_at: '2026-07-13T00:00:00.000Z', balance_payment_method: 'card', updated_at: '2026-07-13T00:00:00.000Z' },
      error: null,
    });
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(
      makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'paid', balancePaymentMethod: 'card' } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(updateCall.payload).not.toHaveProperty('payment_status');
    expect(updateCall.payload).not.toHaveProperty('deposit_amount');
    expect(updateCall.payload).not.toHaveProperty('total_price');
  });

  it('never imports or calls Stripe (this route has no stripe dependency at all)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve(process.cwd(), 'api/bookings/[id]/balance.js'), 'utf8');
    expect(source).not.toMatch(/from ['"]stripe['"]/);
    expect(source).not.toMatch(/require\(['"]stripe['"]\)/);
  });

  it('returns 404 when the booking does not exist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client } = makeUpdateClient({ data: null, error: null });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'paid' } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client } = makeUpdateClient({ data: null, error: { code: '500', message: 'internal detail' } });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}/balance`, bodyObj: { balanceStatus: 'paid' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
