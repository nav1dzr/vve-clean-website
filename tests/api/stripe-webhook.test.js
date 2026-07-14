import { describe, it, expect, vi, beforeEach } from 'vitest';

const constructEventMock = vi.fn();
const sendMailMock       = vi.fn().mockResolvedValue({});
const verifyMock         = vi.fn().mockResolvedValue(true);

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: (...args) => constructEventMock(...args) },
  })),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      verify:  (...args) => verifyMock(...args),
      sendMail: (...args) => sendMailMock(...args),
    }),
  },
}));

function makeSupabaseTable() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => makeSupabaseTable() })),
}));

const { default: handler } = await import('../../api/stripe-webhook.js');

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

function makeReq() {
  return {
    method: 'POST',
    headers: { 'stripe-signature': 'test-sig' },
    on(event, cb) {
      if (event === 'data') cb(Buffer.from('{}'));
      if (event === 'end') cb();
    },
  };
}

const BASE_META = {
  fullName: 'Jane Smith',
  email:    'jane@example.com',
  phone:    '07700900000',
  service:  'End of tenancy',
  price:    '249',
  date:     '2026-08-01',
  time:     'Flexible',
  booking_ref: 'E81AA010826',
};

function makeEvent(metaOverrides = {}) {
  return {
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc',
        payment_intent: 'pi_test_abc',
        payment_status: 'paid',
        metadata: { ...BASE_META, ...metaOverrides },
      },
    },
  };
}

describe('stripe-webhook — customer/business notification wording', () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    verifyMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    process.env.STRIPE_SECRET_KEY    = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.GMAIL_SENDER          = 'sender@example.com';
    process.env.GMAIL_APP_PASSWORD    = 'app-password';
    process.env.BUSINESS_EMAIL        = 'business@example.com';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    constructEventMock.mockReturnValue(makeEvent());
  });

  it('never claims the appointment is confirmed in the customer email subject', async () => {
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    expect(customerCall).toBeDefined();
    expect(customerCall[0].subject).not.toMatch(/confirmed/i);
    expect(customerCall[0].subject).toMatch(/booking request/i);
  });

  it('uses the required "we have received your deposit and request" wording, including date/time', async () => {
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    expect(customerCall[0].html).toMatch(
      /we have received your £30 deposit and your request for 2026-08-01 during Flexible\. We will confirm availability within one business hour\./i,
    );
  });

  it('never says the appointment/slot is confirmed, secured, or guaranteed in the customer email', async () => {
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const html = customerCall[0].html;
    expect(html).not.toMatch(/booking confirmed/i);
    expect(html).not.toMatch(/slot is held/i);
    expect(html).not.toMatch(/no one else can take your slot/i);
  });

  it('falls back to generic "your booking request" wording when no date was provided', async () => {
    constructEventMock.mockReturnValue(makeEvent({ date: '', time: '' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    expect(customerCall[0].html).toMatch(/we have received your £30 deposit and your booking request\./i);
  });

  it('does not send a customer email when no email address is on file', async () => {
    constructEventMock.mockReturnValue(makeEvent({ email: '' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c.to === 'jane@example.com');
    expect(customerCall).toBeUndefined();
  });

  it('still sends the business alert with a "Requested date / time" row, not a confirmed claim', async () => {
    const res = makeRes();
    await handler(makeReq(), res);

    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');
    expect(businessCall).toBeDefined();
    expect(businessCall[0].html).toMatch(/Requested date \/ time/);
  });
});

describe('stripe-webhook — Telegram notification wording', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY    = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.TELEGRAM_BOT_TOKEN    = 'test-token';
    process.env.TELEGRAM_CHAT_ID      = 'test-chat';
    delete process.env.GMAIL_SENDER;
    delete process.env.VITE_SUPABASE_URL;
    constructEventMock.mockReturnValue(makeEvent());
  });

  it('labels the date/time field as "Requested date/time"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const res = makeRes();
    await handler(makeReq(), res);

    const telegramCall = fetchMock.mock.calls.find(([url]) => String(url).includes('api.telegram.org'));
    expect(telegramCall).toBeDefined();
    const body = JSON.parse(telegramCall[1].body);
    expect(body.text).toMatch(/Requested date\/time/);
    expect(body.text).not.toMatch(/no one else can take your slot/i);
  });
});
