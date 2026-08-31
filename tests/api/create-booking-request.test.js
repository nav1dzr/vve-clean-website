import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectLikeMock = vi.fn();
const insertSingleMock = vi.fn();
const updateEqMock = vi.fn();
const sendMailMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ like: (...args) => selectLikeMock(...args) }),
      insert: (row) => ({ select: () => ({ single: () => insertSingleMock(row) }) }),
      update: (row) => ({ eq: (...args) => updateEqMock(row, ...args) }),
    }),
  })),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: (...args) => sendMailMock(...args) })) },
}));

const { default: handler } = await import('../../api/create-booking-request.js');

afterEach(() => {
  vi.unstubAllGlobals();
});

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 20);
  return date.toISOString().slice(0, 10);
}

function payload(overrides = {}) {
  return {
    service: 'Window cleaning',
    price: 1,
    quoteConfig: { service: 'window', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'no' },
    fullName: 'Jane Smith',
    address: '12 High Street',
    postcode: 'E8 1AA',
    phone: '07700900000',
    email: 'jane@example.com',
    date: futureDate(),
    time: 'Flexible',
    message: '',
    ...overrides,
  };
}

function req(body) {
  return { method: 'POST', headers: { origin: 'http://localhost:5173' }, body: JSON.stringify(body) };
}

function res() {
  return {
    statusCode: null,
    body: '',
    writeHead(status) { this.statusCode = status; },
    end(body) { this.body = body || ''; },
  };
}

describe('POST /api/create-booking-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SITE_URL = 'http://localhost:5173';
    delete process.env.GMAIL_SENDER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.BUSINESS_EMAIL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    selectLikeMock.mockResolvedValue({ data: [], error: null });
    insertSingleMock.mockResolvedValue({ data: { id: 'booking-1' }, error: null });
    updateEqMock.mockResolvedValue({ error: null });
  });

  it('saves a new manager-visible request without Stripe or a deposit', async () => {
    const response = res();
    await handler(req(payload()), response);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, bookingRef: expect.any(String) });
    const saved = insertSingleMock.mock.calls[0][0];
    expect(saved.payment_status).toBe('pending_payment');
    expect(saved.deposit_amount).toBe(0);
    expect(saved.status).toBe('new');
    expect(saved.balance_status).toBe('not_due');
    expect(saved.stripe_session_id).toBeNull();
    expect(saved.total_price).toBe(85);
  });

  it('uses the trusted server price rather than the browser price', async () => {
    const response = res();
    await handler(req(payload({ price: 9999 })), response);
    expect(insertSingleMock.mock.calls[0][0].total_price).toBe(85);
  });

  it('retries with a numbered reference when a simultaneous request wins the first reference', async () => {
    insertSingleMock
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate booking_ref' } })
      .mockResolvedValueOnce({ data: { id: 'booking-2' }, error: null });
    const response = res();

    await handler(req(payload()), response);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.bookingRef).toMatch(/-1$/);
    expect(insertSingleMock).toHaveBeenCalledTimes(2);
    expect(insertSingleMock.mock.calls[1][0].booking_ref).toBe(body.bookingRef);
  });

  it('rejects incomplete scheduling before writing', async () => {
    const response = res();
    await handler(req(payload({ time: '' })), response);
    expect(response.statusCode).toBe(400);
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it('rejects a rug-only request on the server', async () => {
    const response = res();
    await handler(req(payload({
      quoteConfig: {
        service: 'deep', deepService: 'carpet_upholstery', carpetCondition: 'normal',
        carpetCounts: { rug: 1 }, parkingAvailable: 'yes', congestionZone: 'no',
      },
    })), response);
    expect(response.statusCode).toBe(400);
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it('returns a safe error when the CRM database is unavailable', async () => {
    delete process.env.VITE_SUPABASE_URL;
    const response = res();
    await handler(req(payload()), response);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/temporarily unavailable/i);
  });

  it('sends multipart customer and manager emails when configured', async () => {
    process.env.GMAIL_SENDER = 'sender@example.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    process.env.BUSINESS_EMAIL = 'manager@example.com';
    sendMailMock.mockResolvedValue({ accepted: ['ok'] });
    const response = res();

    await handler(req(payload()), response);

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    for (const [message] of sendMailMock.mock.calls) {
      expect(message.text).toBeTruthy();
      expect(message.html).toBeTruthy();
      expect(message.text).not.toMatch(/£30 deposit|deposit link|Stripe/i);
      expect(message.html).not.toMatch(/£30 deposit|deposit link|Stripe/i);
    }
    expect(updateEqMock).toHaveBeenCalledWith(expect.objectContaining({
      email_customer_sent: true,
      email_business_sent: true,
    }), 'id', 'booking-1');
  });

  it('sends the manager Telegram notification using the existing bot settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
    const response = res();

    await handler(req(payload()), response);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/bottest-bot-token/sendMessage');
    const telegramBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(telegramBody.chat_id).toBe('test-chat-id');
    expect(telegramBody.text).toMatch(/New booking request/);
    expect(telegramBody.text).toMatch(/No online deposit required/);
    expect(telegramBody.text).not.toMatch(/£30 deposit|deposit link|Stripe/i);
    expect(updateEqMock).toHaveBeenCalledWith(expect.objectContaining({ telegram_sent: true }), 'id', 'booking-1');
  });
});
