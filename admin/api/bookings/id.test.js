import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

// The file under test is named [id].js (Vercel's dynamic-route convention).
// Importing it by its literal path works fine as an ES module specifier —
// only the test file itself avoids brackets, to sidestep any glob-pattern
// ambiguity in file discovery tooling.
const { default: handler } = await import('./[id].js');

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
