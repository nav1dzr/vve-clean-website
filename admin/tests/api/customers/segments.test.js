import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/customers/[[...segments]].js');

function makeRes() {
  const res = {
    statusCode: null, headers: null, body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}
function makeReq({ url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'GET' } = {}) {
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

const ADMIN = { ok: true, admin: { id: 'admin-1' } };
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

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
});

describe('/api/customers/:id (detail/update/history/manual booking)', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
  });

  it('rejects an invalid customer id', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/customers/not-a-uuid' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for a missing customer', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/customers/${VALID_UUID}` }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns customer detail with history and balances', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' }],
      invoices: [{ id: 'inv-1', invoice_number: 'INV-2026-000001', customer_name: 'Jane', total: 100, amount_due: 20, document_status: 'issued', payment_status: 'partially_paid', due_date: null, issue_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', billing_customer_id: VALID_UUID, service_customer_id: null }],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/customers/${VALID_UUID}` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Jane Doe');
    expect(body.invoices).toHaveLength(1);
    expect(body.outstandingBalance).toBe(20);
  });

  it('never exposes normalised_email/normalised_phone (internal dedup keys)', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com', phone: '07700900123', postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z', normalised_email: 'jane@example.com', normalised_phone: '07700900123' }],
    });
    getServiceClientMock.mockReturnValue(supabase);
    const res = makeRes();
    await handler(makeReq({ url: `/api/customers/${VALID_UUID}` }), res);
    const body = JSON.parse(res.body);
    expect(body.normalisedEmail).toBeUndefined();
    expect(body.normalised_email).toBeUndefined();
  });

  it('updates a customer', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' }],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/customers/${VALID_UUID}`, method: 'PATCH',
      bodyObj: { name: 'Jane Updated', email: 'jane@example.com', customerType: 'business', source: 'referral' },
    }), res);
    expect(res.statusCode).toBe(200);

    const row = supabase._tables.customers.find((c) => c.id === VALID_UUID);
    expect(row.name).toBe('Jane Updated');
    expect(row.customer_type).toBe('business');
  });

  it('creates a manual booking for the customer', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com', phone: '07700900123', address: '1 Test St', postcode: 'N15 2NG' }],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/customers/${VALID_UUID}/bookings`, method: 'POST',
      bodyObj: { service: 'Deep clean', serviceDate: '2026-08-01', totalPrice: 150 },
    }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.bookingId).toBeTruthy();
    expect(body.bookingRef).toMatch(/^N152NG/);

    const booking = supabase._tables.bookings.find((b) => b.id === body.bookingId);
    expect(booking.deposit_amount).toBe(0);
    expect(booking.first_source).toBe('admin_manual');
  });

  it('rejects a manual booking with no service', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com' }],
    });
    getServiceClientMock.mockReturnValue(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/customers/${VALID_UUID}/bookings`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns customer event history', async () => {
    const supabase = createFakeSupabase({
      customers: [{ id: VALID_UUID, name: 'Jane Doe', email: 'jane@example.com', phone: null, postcode: null, customer_type: 'individual', source: 'other', created_at: '2026-01-01T00:00:00Z' }],
    });
    getServiceClientMock.mockReturnValue(supabase);
    await handler(makeReq({
      url: `/api/customers/${VALID_UUID}`, method: 'PATCH',
      bodyObj: { name: 'Jane Doe', email: 'jane@example.com' },
    }), makeRes());

    const res = makeRes();
    await handler(makeReq({ url: `/api/customers/${VALID_UUID}/events` }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results.map((e) => e.eventType)).toEqual(['updated']);
  });
});
