import { describe, it, expect, vi, beforeEach } from 'vitest';

const sessionsCreateMock = vi.fn();
const supabaseInsertMock = vi.fn().mockResolvedValue({ error: null });
const supabaseSelectMock = vi.fn().mockResolvedValue({ data: [] });

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: (...args) => sessionsCreateMock(...args) } },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table) => ({
      select: () => ({ like: () => supabaseSelectMock() }),
      insert: (row) => supabaseInsertMock(table, row),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  })),
}));

const { default: handler } = await import('../../api/create-checkout-session.js');

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

const VALID_QUOTE_CONFIG = { service: 'window', windowSize: 'medium' };

function basePayload(overrides = {}) {
  return {
    service: 'Window Cleaning',
    price: 90,
    quoteConfig: VALID_QUOTE_CONFIG,
    fullName: 'Jane Smith',
    address: '12 High Street',
    postcode: 'E8 1AA',
    phone: '07700900000',
    email: 'jane@example.com',
    date: '2026-08-01',
    time: 'Flexible',
    message: '',
    termsAccepted: true,
    termsAcceptedAt: '2026-07-14T10:00:00.000Z',
    termsVersion: '2026-07-14',
    cancellationPolicyVersion: '2026-07-14',
    ...overrides,
  };
}

function makeReq(payload) {
  return {
    method: 'POST',
    headers: { origin: 'http://localhost:5173', host: 'localhost:5173' },
    body: JSON.stringify(payload),
  };
}

describe('POST /api/create-checkout-session — terms and scheduling requirements', () => {
  beforeEach(() => {
    sessionsCreateMock.mockReset();
    supabaseInsertMock.mockClear();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.SITE_URL = 'http://localhost:5173';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    sessionsCreateMock.mockResolvedValue({
      id: 'cs_test_abc',
      url: 'https://checkout.stripe.com/test',
    });
  });

  it('rejects a request with no preferred date', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({ date: '' })), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/preferred date/i);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('rejects a request for a date that has already passed (D11 — server-side enforcement)', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({ date: '2020-01-01' })), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/already passed/i);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('accepts today\'s date', async () => {
    const res = makeRes();
    const today = new Date().toISOString().slice(0, 10);
    await handler(makeReq(basePayload({ date: today })), res);
    expect(res.statusCode).toBe(200);
  });

  it('rejects a request with no preferred arrival window', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({ time: '' })), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/arrival window/i);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('rejects a request where termsAccepted is not true, before creating a Stripe session', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({ termsAccepted: false })), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/terms/i);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('rejects a request where termsAccepted is missing entirely', async () => {
    const payload = basePayload();
    delete payload.termsAccepted;
    const res = makeRes();
    await handler(makeReq(payload), res);
    expect(res.statusCode).toBe(400);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('accepts a fully valid request and creates a Stripe session', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload()), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).checkoutUrl).toBe('https://checkout.stripe.com/test');
    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
  });

  it('passes the preferred date and arrival window through to Stripe metadata', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({ date: '2026-09-15', time: 'Morning (8am–12pm)' })), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.metadata.date).toBe('2026-09-15');
    expect(call.metadata.time).toBe('Morning (8am–12pm)');
  });

  it('passes terms acceptance fields through to Stripe metadata', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload()), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.metadata.terms_accepted).toBe('true');
    expect(call.metadata.terms_accepted_at).toBe('2026-07-14T10:00:00.000Z');
    expect(call.metadata.terms_version).toBe('2026-07-14');
    expect(call.metadata.cancellation_policy_version).toBe('2026-07-14');
  });

  it('never uses "Secures your slot" wording in the Stripe line-item description', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload()), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    const description = call.line_items[0].price_data.product_data.description;
    expect(description).not.toMatch(/secures your slot/i);
  });

  it('does not trust the client-supplied price — uses the server-computed price instead', async () => {
    const res = makeRes();
    // Client claims £5, but the server's computePrice for window/medium must win.
    await handler(makeReq(basePayload({ price: 5 })), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.metadata.price).not.toBe('5');
  });

  it('stores an itemised service_detail in Stripe metadata, built from quoteConfig', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({
      service: 'Carpet & upholstery · 2 items',
      price: 120,
      quoteConfig: {
        service: 'deep',
        deepService: 'carpet_upholstery',
        carpetCounts: { mattress_double: 1, sofa_3: 1 },
      },
    })), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.metadata.service_detail).toBe('1 × 3-seater sofa\n1 × Mattress (double/king)');
  });

  it('falls back to the broad service category in service_detail when quoteConfig has no item-level detail', async () => {
    const res = makeRes();
    await handler(makeReq(basePayload({
      service: 'Carpet & upholstery · 0 items',
      quoteConfig: {
        service: 'deep',
        deepService: 'carpet_upholstery',
        carpetCondition: 'delicate',
        carpetCounts: {},
      },
    })), res);

    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.metadata.service_detail).toBe('Carpet & upholstery · 0 items');
  });

  it('persists preferred date/time and terms acceptance to Supabase when configured', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const res = makeRes();
    await handler(makeReq(basePayload({ date: '2026-09-15', time: 'Flexible' })), res);

    expect(res.statusCode).toBe(200);
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
    const [table, row] = supabaseInsertMock.mock.calls[0];
    expect(table).toBe('bookings');
    expect(row.preferred_date).toBe('2026-09-15');
    expect(row.preferred_time).toBe('Flexible');
    expect(row.terms_accepted).toBe(true);
    expect(row.terms_accepted_at).toBe('2026-07-14T10:00:00.000Z');
    expect(row.terms_version).toBe('2026-07-14');
    expect(row.cancellation_policy_version).toBe('2026-07-14');
  });

  it('persists the server-computed total_price and the raw quoteConfig to Supabase (D1 — previously never written)', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const res = makeRes();
    // Client claims £5 again — the persisted total_price must be the
    // server-computed price, exactly like what's sent to Stripe.
    await handler(makeReq(basePayload({ price: 5 })), res);

    expect(res.statusCode).toBe(200);
    const [, row] = supabaseInsertMock.mock.calls[0];
    expect(row.total_price).not.toBe(5);
    expect(typeof row.total_price).toBe('number');
    expect(row.quote_config).toEqual(VALID_QUOTE_CONFIG);
  });

  it('never touches the customers table — a pending_payment booking must never auto-create/link a customer (Task 1)', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const res = makeRes();
    await handler(makeReq(basePayload()), res);

    expect(res.statusCode).toBe(200);
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
    const [table] = supabaseInsertMock.mock.calls[0];
    expect(table).toBe('bookings');
    expect(supabaseInsertMock.mock.calls.some(([t]) => t === 'customers')).toBe(false);
  });
});
