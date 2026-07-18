import { describe, it, expect, vi, beforeEach } from 'vitest';

const sessionsSearchMock = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { search: (...args) => sessionsSearchMock(...args) } },
  })),
}));

const upsertMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({ upsert: (...args) => upsertMock(...args) }) })),
}));

const { default: handler } = await import('../../api/backfill-paid-booking.js');

function makeRes() {
  const res = {
    statusCode: null,
    body: '',
    writeHead(status) { res.statusCode = status; },
    end(body) { res.body = body || ''; },
  };
  return res;
}

function makeReq(bodyObj, { auth = 'Bearer test-backfill-secret' } = {}) {
  const raw = JSON.stringify(bodyObj);
  return {
    method: 'POST',
    headers: { authorization: auth },
    on(event, cb) {
      if (event === 'data') cb(raw);
      if (event === 'end') cb();
    },
  };
}

function makePaidSession(overrides = {}) {
  return {
    id: 'cs_test_abc',
    payment_intent: 'pi_test_abc',
    payment_status: 'paid',
    currency: 'gbp',
    amount_total: 3000,
    metadata: { booking_ref: 'N152NG160726', fullName: 'Jane Doe' },
    ...overrides,
  };
}

describe('POST /api/backfill-paid-booking — booking_ref collision handling', () => {
  beforeEach(() => {
    sessionsSearchMock.mockReset();
    upsertMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.BACKFILL_SECRET = 'test-backfill-secret';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('persists on the first attempt when there is no collision', async () => {
    sessionsSearchMock.mockResolvedValue({ data: [makePaidSession()] });
    upsertMock.mockResolvedValueOnce({ error: null });

    const res = makeRes();
    await handler(makeReq({ ref: 'N152NG160726', dry_run: false }), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.booking_ref).toBe('N152NG160726');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('retries with a tie-breaking suffix on a booking_ref collision, using the same helper as the live webhook', async () => {
    sessionsSearchMock.mockResolvedValue({ data: [makePaidSession()] });
    upsertMock
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      .mockResolvedValueOnce({ error: null });

    const res = makeRes();
    await handler(makeReq({ ref: 'N152NG160726', dry_run: false }), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Persisted ref differs from the requested Stripe-metadata ref — the
    // response must say so explicitly rather than silently reporting the
    // ref the operator asked for, which is not what actually got stored.
    expect(body.booking_ref).toBe('N152NG160726-1');
    expect(body.note).toMatch(/collided/i);
    expect(body.note).toMatch(/N152NG160726-1/);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a non-collision DB error as before (no infinite retry)', async () => {
    sessionsSearchMock.mockResolvedValue({ data: [makePaidSession()] });
    upsertMock.mockResolvedValueOnce({ error: { code: '57P03', message: 'cannot connect now' } });

    const res = makeRes();
    await handler(makeReq({ ref: 'N152NG160726', dry_run: false }), res);

    expect(res.statusCode).toBe(500);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('does not write to the DB in dry-run mode, even when a collision would occur', async () => {
    sessionsSearchMock.mockResolvedValue({ data: [makePaidSession()] });

    const res = makeRes();
    await handler(makeReq({ ref: 'N152NG160726', dry_run: true }), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.dry_run).toBe(true);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('rejects without the correct bearer secret', async () => {
    sessionsSearchMock.mockResolvedValue({ data: [makePaidSession()] });
    const res = makeRes();
    await handler(makeReq({ ref: 'N152NG160726' }, { auth: 'Bearer wrong' }), res);
    expect(res.statusCode).toBe(403);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
