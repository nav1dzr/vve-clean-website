import { describe, it, expect, vi, beforeEach } from 'vitest';

const retrieveMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { retrieve: (...args) => retrieveMock(...args) } },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => maybeSingleMock() }),
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
    }),
  })),
}));

const { default: handler } = await import('../../api/confirmation-details.js');

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

const VALID_TOKEN = 'a'.repeat(64);

function makeReq(qs) {
  return { method: 'GET', url: `/api/confirmation-details${qs}` };
}

describe('GET /api/confirmation-details — requested arrival window and status', () => {
  beforeEach(() => {
    retrieveMock.mockReset();
    maybeSingleMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns the requested arrival window (preferred_time) alongside the date', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        full_name: 'Jane Smith', email: 'jane@example.com', service: 'End of tenancy',
        preferred_date: '2026-08-01', preferred_time: 'Flexible',
        payment_status: 'paid', status: 'new', stripe_session_id: 'cs_test_abc',
      },
      error: null,
    });
    retrieveMock.mockResolvedValue({ payment_status: 'paid', metadata: { price: '249' } });

    const res = makeRes();
    await handler(makeReq(`?ref=E81AA010826&token=${VALID_TOKEN}`), res);

    const body = JSON.parse(res.body);
    expect(body.time).toBe('Flexible');
    expect(body.date).toBe('2026-08-01');
  });

  it('returns the operational booking status so the confirmation page can gate wording on it', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        full_name: 'Jane Smith', email: '', service: 'End of tenancy',
        preferred_date: '2026-08-01', preferred_time: 'Flexible',
        payment_status: 'paid', status: 'confirmed', stripe_session_id: 'cs_test_abc',
      },
      error: null,
    });
    retrieveMock.mockResolvedValue({ payment_status: 'paid', metadata: {} });

    const res = makeRes();
    await handler(makeReq(`?ref=E81AA010826&token=${VALID_TOKEN}`), res);

    expect(JSON.parse(res.body).status).toBe('confirmed');
  });

  it('defaults status to an empty (not-confirmed) value when the row has no status set', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        full_name: 'Jane Smith', email: '', service: 'End of tenancy',
        preferred_date: '2026-08-01', preferred_time: 'Flexible',
        payment_status: 'paid', status: null, stripe_session_id: 'cs_test_abc',
      },
      error: null,
    });
    retrieveMock.mockResolvedValue({ payment_status: 'paid', metadata: {} });

    const res = makeRes();
    await handler(makeReq(`?ref=E81AA010826&token=${VALID_TOKEN}`), res);

    expect(JSON.parse(res.body).status).toBe('');
  });

  it('never returns the confirmation_token itself', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        full_name: 'Jane Smith', email: '', service: 'End of tenancy',
        preferred_date: '2026-08-01', preferred_time: 'Flexible',
        payment_status: 'paid', status: 'new', stripe_session_id: 'cs_test_abc',
      },
      error: null,
    });
    retrieveMock.mockResolvedValue({ payment_status: 'paid', metadata: {} });

    const res = makeRes();
    await handler(makeReq(`?ref=E81AA010826&token=${VALID_TOKEN}`), res);

    expect(res.body).not.toMatch(/confirmation_token/i);
    expect(res.body).not.toMatch(new RegExp(VALID_TOKEN));
  });
});
