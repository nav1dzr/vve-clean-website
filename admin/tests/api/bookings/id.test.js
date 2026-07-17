import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

// The file under test is named [id].js (Vercel's dynamic-route convention).
// Importing it by its literal path works fine as an ES module specifier —
// only the test file itself avoids brackets, to sidestep any glob-pattern
// ambiguity in file discovery tooling.
const { default: handler } = await import('../../../api/bookings/[id].js');

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

function makeMaybeSingleClient(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
  };
  return { from: () => builder };
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

describe('GET /api/bookings/:id', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-GET methods', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, query: { id: VALID_UUID } }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns the auth failure status when not an authorised admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: { id: VALID_UUID } }, res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects a non-UUID id, such as a human booking reference, with 400', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: { id: 'N15NJ180726' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when no booking matches a well-formed UUID', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    getServiceClientMock.mockReturnValue(makeMaybeSingleClient({ data: null, error: null }));
    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: { id: VALID_UUID } }, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns the full detail shape for a matching booking, and excludes confirmation_token', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    getServiceClientMock.mockReturnValue(makeMaybeSingleClient({
      data: {
        id: VALID_UUID, booking_ref: 'N15NJ180726', full_name: 'Jasmine Carter',
        phone: '07123456789', email: 'j@example.com', address: '14 Elm Road', postcode: 'N15 5NJ',
        service: 'end_of_tenancy', quote_config: null, preferred_date: '2026-07-18', preferred_time: '10:00',
        service_date: '2026-07-18', notes: 'Parking round back', total_price: 249, deposit_amount: 30,
        payment_status: 'paid', balance_status: 'outstanding', balance_paid_at: null, balance_payment_method: null,
        status: 'confirmed', stripe_session_id: 'cs_live_abc', stripe_payment_intent_id: 'pi_abc',
        offer_code: null, discount_percent: null, standard_total: null, discount_amount: null,
        final_total_after_discount: null, first_source: 'google', last_source: 'google', landing_page: '/',
        utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, gclid: null,
        email_customer_sent: true, email_business_sent: true, telegram_sent: true, sheets_sent: true,
        created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
        confirmation_token: 'super-secret-token',
      },
      error: null,
    }));

    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: { id: VALID_UUID } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toMatch(/confirmation_token|super-secret-token/i);
    const body = JSON.parse(res.body);
    expect(body.bookingRef).toBe('N15NJ180726');
    expect(body.balance).toBe(219);
    expect(body.stripe).toEqual({ sessionId: 'cs_live_abc', paymentIntentId: 'pi_abc' });
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: {} });
    getServiceClientMock.mockReturnValue(
      makeMaybeSingleClient({ data: null, error: { code: '500', message: 'internal detail' } }),
    );
    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: { id: VALID_UUID } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});

// Folded in from the former, separate admin/api/bookings/[id]/status.js —
// see [id].js's own header comment for why (freeing a function slot for
// the customers routing fix). Dispatched via `?action=status` on the same
// file as the GET detail route above, not a `/status` path segment.
describe('PATCH /api/bookings/:id?action=status', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects non-PATCH methods', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 for a missing token', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status` }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a non-admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status` }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects an invalid booking UUID', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: '/api/bookings/not-a-uuid?action=status', bodyObj: { status: 'confirmed' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid status value', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status: 'archived' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects payment-status values leaking into the operational-status whitelist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status: 'deposit_paid' } }), res);
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
      await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status } }), res);
      expect(res.statusCode).toBe(200);
    }
  });

  it('returns 404 when the booking does not exist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const { client } = makeUpdateClient({ data: null, error: null });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status: 'confirmed' } }), res);
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
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status: 'confirmed' } }), res);

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
    await handler(makeReq({ url: `/api/bookings/${VALID_UUID}?action=status`, bodyObj: { status: 'confirmed' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
