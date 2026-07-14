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

describe('stripe-webhook — HTML-escapes user-controlled booking data in emails (XSS)', () => {
  const IMG_PAYLOAD  = '<img src=x onerror=alert(1)>';
  const LINK_PAYLOAD = '<a href="https://evil.example/phish">Click to confirm your booking</a>';

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
  });

  function malicious(overrides = {}) {
    return makeEvent({
      fullName: IMG_PAYLOAD,
      address:  LINK_PAYLOAD,
      postcode: '<script>alert(2)</script>',
      date:     '<b>2026-08-01</b>',
      time:     '<i>Flexible</i>',
      service:  '<u>Carpet clean</u>',
      booking_ref: '<svg onload=alert(3)>REF01',
      ...overrides,
    });
  }

  it('renders an <img onerror> payload in the full name as inert text, not a live tag, in both emails', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');

    for (const html of [customerCall[0].html, businessCall[0].html]) {
      expect(html).not.toContain(IMG_PAYLOAD);
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    }
  });

  it('renders a spoofed <a href> payload in the address as inert text, not a real link', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');

    for (const html of [customerCall[0].html, businessCall[0].html]) {
      expect(html).not.toContain(LINK_PAYLOAD);
      expect(html).toContain('&lt;a href="https://evil.example/phish"&gt;Click to confirm your booking&lt;/a&gt;');
    }
  });

  it('escapes a <script> payload in the postcode (also used to build booking_ref)', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');

    for (const html of [customerCall[0].html, businessCall[0].html]) {
      expect(html).not.toContain('<script>alert(2)</script>');
    }
  });

  it('escapes HTML in preferred date and arrival window', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');

    for (const html of [customerCall[0].html, businessCall[0].html]) {
      expect(html).not.toContain('<b>2026-08-01</b>');
      expect(html).not.toContain('<i>Flexible</i>');
      expect(html).toContain('&lt;b&gt;2026-08-01&lt;/b&gt;');
      expect(html).toContain('&lt;i&gt;Flexible&lt;/i&gt;');
    }
  });

  it('escapes HTML in the customer notes/message field (business email Notes row)', async () => {
    constructEventMock.mockReturnValue(malicious({ message: '<img src=x onerror=alert(4)>urgent call me' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');
    expect(businessCall[0].html).not.toContain('<img src=x onerror=alert(4)>');
    expect(businessCall[0].html).toContain('&lt;img src=x onerror=alert(4)&gt;urgent call me');
  });

  it('escapes HTML in the service text (business email subtitle)', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');
    expect(businessCall[0].html).not.toContain('<u>Carpet clean</u>');
    expect(businessCall[0].html).toContain('&lt;u&gt;Carpet clean&lt;/u&gt;');
  });

  it('escapes HTML in the booking reference in both emails', async () => {
    constructEventMock.mockReturnValue(malicious());
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');

    for (const html of [customerCall[0].html, businessCall[0].html]) {
      expect(html).not.toContain('<svg onload=alert(3)>');
      expect(html).toContain('&lt;svg onload=alert(3)&gt;REF01');
    }
  });

  it('still renders the malicious full name as readable plain text once escaped (content is preserved, not stripped)', async () => {
    constructEventMock.mockReturnValue(malicious({ fullName: 'Jane "Bob" O\'Brien <VIP>' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    // escHtml only neutralises &, < and > (the characters that can break out of
    // an HTML text node here) — quotes/apostrophes are left as-is since none
    // of these values are ever placed inside an HTML attribute.
    expect(customerCall[0].html).toContain('Jane "Bob" O\'Brien &lt;VIP&gt;');
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

  it('lists the exact selected items, not just the broad category, when service_detail is present', async () => {
    constructEventMock.mockReturnValue(makeEvent({
      service: 'Carpet & upholstery · 2 items',
      service_detail: '1 × 3-seater sofa\n1 × Mattress (double/king)',
    }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const res = makeRes();
    await handler(makeReq(), res);

    const telegramCall = fetchMock.mock.calls.find(([url]) => String(url).includes('api.telegram.org'));
    const body = JSON.parse(telegramCall[1].body);
    expect(body.text).toMatch(/Service:<\/b>\n• 1 × 3-seater sofa\n• 1 × Mattress \(double\/king\)/);
  });

  it('falls back to the broad service category as a single bullet when service_detail is absent (legacy sessions)', async () => {
    constructEventMock.mockReturnValue(makeEvent({ service: 'End of tenancy' }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const res = makeRes();
    await handler(makeReq(), res);

    const telegramCall = fetchMock.mock.calls.find(([url]) => String(url).includes('api.telegram.org'));
    const body = JSON.parse(telegramCall[1].body);
    expect(body.text).toMatch(/Service:<\/b>\n• End of tenancy/);
  });
});

describe('stripe-webhook — itemised service detail in emails', () => {
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
  });

  it('shows each selected item on its own line in the business email Service row', async () => {
    constructEventMock.mockReturnValue(makeEvent({
      service: 'Carpet & upholstery · 2 items',
      service_detail: '1 × Rug\n1 × Armchair',
    }));
    const res = makeRes();
    await handler(makeReq(), res);

    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');
    expect(businessCall[0].html).toMatch(/1 × Rug<br>1 × Armchair/);
  });

  it('shows each selected item on its own line in the customer email Service row', async () => {
    constructEventMock.mockReturnValue(makeEvent({
      service: 'Carpet & upholstery · 2 items',
      service_detail: '1 × Rug\n1 × Armchair',
    }));
    const res = makeRes();
    await handler(makeReq(), res);

    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    expect(customerCall[0].html).toMatch(/1 × Rug<br>1 × Armchair/);
  });

  it('falls back to the broad service category in emails when service_detail is absent', async () => {
    constructEventMock.mockReturnValue(makeEvent({ service: 'End of tenancy' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const businessCall = sendMailMock.mock.calls.find((c) => c[0].to === 'business@example.com');
    expect(businessCall[0].html).toMatch(/End of tenancy/);
  });
});
