import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPricingCatalogue } from "../../shared/pricingCatalogue.js";

const selectLikeMock = vi.fn();
const selectRequestMock = vi.fn();
const loadPricebookMock = vi.fn();
const insertSingleMock = vi.fn();
const updateEqMock = vi.fn();
const sendMailMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        like: (...args) => selectLikeMock(...args),
        eq: (...args) => ({ maybeSingle: () => selectRequestMock(...args) }),
      }),
      insert: (row) => ({
        select: () => ({ single: () => insertSingleMock(row) }),
      }),
      update: (row) => ({ eq: (...args) => updateEqMock(row, ...args) }),
    }),
  })),
}));

vi.mock("../../api/_lib/websitePricebook.js", () => ({
  loadWebsitePricebook: (...args) => loadPricebookMock(...args),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: (...args) => sendMailMock(...args),
    })),
  },
}));

const { default: handler } =
  await import("../../api/create-booking-request.js");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 20);
  return date.toISOString().slice(0, 10);
}

function payload(overrides = {}) {
  return {
    service: "Window cleaning",
    price: 1,
    quoteConfig: {
      service: "window",
      windowSize: "medium",
      parkingAvailable: "yes",
      congestionZone: "no",
    },
    fullName: "Jane Smith",
    address: "12 High Street",
    postcode: "E8 1AA",
    phone: "07700900000",
    email: "jane@example.com",
    date: futureDate(),
    time: "Flexible",
    message: "",
    ...overrides,
  };
}

function req(body) {
  return {
    method: "POST",
    headers: { origin: "http://localhost:5173" },
    body: JSON.stringify(body),
  };
}

function res() {
  return {
    statusCode: null,
    body: "",
    writeHead(status) {
      this.statusCode = status;
    },
    end(body) {
      this.body = body || "";
    },
  };
}

describe("POST /api/create-booking-request", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.SITE_URL = "http://localhost:5173";
    delete process.env.GMAIL_SENDER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.BUSINESS_EMAIL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.WEBSITE_PRICEBOOK_ENABLED;
    loadPricebookMock.mockResolvedValue({
      version: "pricebook-v1",
      catalogue: createPricingCatalogue(),
    });
    selectRequestMock.mockResolvedValue({ data: null, error: null });
    selectLikeMock.mockResolvedValue({ data: [], error: null });
    insertSingleMock.mockResolvedValue({
      data: { id: "booking-1" },
      error: null,
    });
    updateEqMock.mockResolvedValue({ error: null });
  });

  function configureEmails() {
    process.env.GMAIL_SENDER = "sender@example.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    process.env.BUSINESS_EMAIL = "manager@example.com";
    sendMailMock.mockResolvedValue({ accepted: ["ok"] });
  }

  it('sends approved preview acknowledgements only to the test inbox, with no inherited Telegram message', async () => {
    configureEmails();
    for (const [key, value] of Object.entries({ VERCEL_ENV: 'preview', VVE_PREVIEW_ISOLATION_APPROVED: 'true', VVE_PREVIEW_SUPABASE_PROJECT_REF: 'stageisolatedproject', VITE_SUPABASE_URL: 'https://stageisolatedproject.supabase.co', SUPABASE_URL: '', VVE_PREVIEW_TEST_EMAIL: 'preview@example.com', STRIPE_SECRET_KEY: '', BOOKING_JOURNEY_MODE: 'test', TELEGRAM_BOT_TOKEN: 'synthetic', TELEGRAM_CHAT_ID: 'synthetic' })) vi.stubEnv(key, value);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const response = res(); await handler(req(payload()), response);
    expect(response.statusCode).toBe(201); expect(sendMailMock).toHaveBeenCalledTimes(2);
    for (const [mail] of sendMailMock.mock.calls) { expect(mail.to).toBe('preview@example.com'); expect(mail.replyTo).toBe('preview@example.com'); expect(mail.subject).toMatch(/^\[TEST\]/); }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  function nextPricebook() {
    const defaults = createPricingCatalogue();
    return {
      version: "pricebook-v2",
      catalogue: createPricingCatalogue({
        WINDOW_QUICK_PRICES_P: {
          ...defaults.WINDOW_QUICK_PRICES_P,
          medium: 9500,
        },
      }),
    };
  }

  const requestKey = "ac4e6421-0e54-4086-944e-3b08e5a4ce67";

  it("replays a saved request and its saved total after a pricebook change without another insert or email", async () => {
    process.env.WEBSITE_PRICEBOOK_ENABLED = "true";
    configureEmails();
    const original = payload({
      requestKey,
      price: 85,
      pricebookVersion: "pricebook-v1",
    });
    const first = res();
    await handler(req(original), first);
    expect(first.statusCode).toBe(201);
    const saved = { ...insertSingleMock.mock.calls[0][0], id: "booking-1" };
    selectRequestMock.mockResolvedValue({ data: saved, error: null });
    loadPricebookMock.mockResolvedValue(nextPricebook());
    const retry = res();
    // Semantically identical JSON can have a different property order.
    const quoteConfig = Object.fromEntries(
      Object.entries(original.quoteConfig).reverse(),
    );
    await handler(req({ ...original, quoteConfig }), retry);

    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body)).toEqual({
      ...JSON.parse(first.body),
      replayed: true,
    });
    expect(JSON.parse(retry.body).total).toBe(85);
    expect(loadPricebookMock).toHaveBeenCalledTimes(1);
    expect(insertSingleMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a changed payload using an already saved request key", async () => {
    const original = payload({ requestKey });
    await handler(req(original), res());
    selectRequestMock.mockResolvedValue({
      data: { ...insertSingleMock.mock.calls[0][0], id: "booking-1" },
      error: null,
    });
    const response = res();
    await handler(req({ ...original, time: "Morning (8am–12pm)" }), response);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toMatch(/request changed/i);
    expect(loadPricebookMock).toHaveBeenCalledTimes(1);
    expect(insertSingleMock).toHaveBeenCalledTimes(1);
  });

  it("requires review of a stale pricebook for a new request", async () => {
    process.env.WEBSITE_PRICEBOOK_ENABLED = "true";
    loadPricebookMock.mockResolvedValue(nextPricebook());
    const response = res();
    await handler(
      req(payload({ requestKey, price: 85, pricebookVersion: "pricebook-v1" })),
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({
      code: "price_changed",
      currentTotal: 95,
    });
    expect(insertSingleMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("requires review when a new request uses the current version with an outdated browser estimate", async () => {
    process.env.WEBSITE_PRICEBOOK_ENABLED = "true";
    loadPricebookMock.mockResolvedValue(nextPricebook());
    const response = res();
    await handler(
      req(payload({ requestKey, price: 85, pricebookVersion: "pricebook-v2" })),
      response,
    );
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).currentTotal).toBe(95);
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it("resolves concurrent duplicate-key submissions to one saved request and one pair of emails", async () => {
    configureEmails();
    let saved = null;
    let lookups = 0;
    selectRequestMock.mockImplementation(async () => ({
      data: ++lookups <= 2 ? null : saved,
      error: null,
    }));
    insertSingleMock.mockImplementation(async (row) => {
      if (saved)
        return {
          data: null,
          error: { code: "23505", message: "duplicate request_key" },
        };
      saved = { ...row, id: "booking-concurrent" };
      return { data: { id: saved.id }, error: null };
    });
    const first = res();
    const second = res();
    await Promise.all([
      handler(req(payload({ requestKey })), first),
      handler(req(payload({ requestKey })), second),
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 201]);
    expect(JSON.parse(first.body).requestId).toBe("booking-concurrent");
    expect(JSON.parse(second.body).requestId).toBe("booking-concurrent");
    expect(insertSingleMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a concurrent conflicting duplicate key instead of replaying someone else’s changed request", async () => {
    let saved = null;
    let lookups = 0;
    selectRequestMock.mockImplementation(async () => ({
      data: ++lookups <= 2 ? null : saved,
      error: null,
    }));
    insertSingleMock.mockImplementation(async (row) => {
      if (saved)
        return {
          data: null,
          error: { code: "23505", message: "duplicate request_key" },
        };
      saved = { ...row, id: "booking-concurrent" };
      return { data: { id: saved.id }, error: null };
    });
    const responses = [res(), res()];
    await Promise.all(
      responses.map((response, i) =>
        handler(req(payload({ requestKey, message: `Notes ${i}` })), response),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(insertSingleMock).toHaveBeenCalledTimes(2);
  });

  it("saves a new manager-visible request without Stripe or a deposit", async () => {
    const response = res();
    await handler(req(payload()), response);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      bookingRef: expect.any(String),
    });
    const saved = insertSingleMock.mock.calls[0][0];
    expect(saved.payment_status).toBe("pending_payment");
    expect(saved.deposit_amount).toBe(0);
    expect(saved.status).toBe("new");
    expect(saved.balance_status).toBe("not_due");
    expect(saved.stripe_session_id).toBeNull();
    expect(saved.total_price).toBe(85);
  });

  it("uses the trusted server price rather than the browser price", async () => {
    const response = res();
    await handler(req(payload({ price: 9999 })), response);
    expect(insertSingleMock.mock.calls[0][0].total_price).toBe(85);
  });

  it("retries with a numbered reference when a simultaneous request wins the first reference", async () => {
    insertSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate booking_ref" },
      })
      .mockResolvedValueOnce({ data: { id: "booking-2" }, error: null });
    const response = res();

    await handler(req(payload()), response);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.bookingRef).toMatch(/-1$/);
    expect(insertSingleMock).toHaveBeenCalledTimes(2);
    expect(insertSingleMock.mock.calls[1][0].booking_ref).toBe(body.bookingRef);
  });

  it("rejects incomplete scheduling before writing", async () => {
    const response = res();
    await handler(req(payload({ time: "" })), response);
    expect(response.statusCode).toBe(400);
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it("rejects a rug-only request on the server", async () => {
    const response = res();
    await handler(
      req(
        payload({
          quoteConfig: {
            service: "deep",
            deepService: "carpet_upholstery",
            carpetCondition: "normal",
            carpetCounts: { rug: 1 },
            parkingAvailable: "yes",
            congestionZone: "no",
          },
        }),
      ),
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it("returns a safe error when the CRM database is unavailable", async () => {
    delete process.env.VITE_SUPABASE_URL;
    const response = res();
    await handler(req(payload()), response);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/temporarily unavailable/i);
  });

  it("sends multipart customer and manager emails when configured", async () => {
    process.env.GMAIL_SENDER = "sender@example.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    process.env.BUSINESS_EMAIL = "manager@example.com";
    sendMailMock.mockResolvedValue({ accepted: ["ok"] });
    const response = res();

    await handler(req(payload()), response);

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    for (const [message] of sendMailMock.mock.calls) {
      expect(message.text).toBeTruthy();
      expect(message.html).toBeTruthy();
      expect(message.text).toMatch(/£30 deposit request/i);
      expect(message.text).toMatch(/after.*agree/i);
      expect(message.html).toMatch(/£30 deposit request/i);
    }
    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email_customer_sent: true,
        email_business_sent: true,
      }),
      "id",
      "booking-1",
    );
  });

  it("sends the manager Telegram notification using the existing bot settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    const response = res();

    await handler(req(payload()), response);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/bottest-bot-token/sendMessage",
    );
    const telegramBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(telegramBody.chat_id).toBe("test-chat-id");
    expect(telegramBody.text).toMatch(/New booking request/);
    expect(telegramBody.text).toMatch(
      /Free initial request; deposit requested after agreement/,
    );
    expect(telegramBody.text).not.toMatch(/£30 deposit|deposit link|Stripe/i);
    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({ telegram_sent: true }),
      "id",
      "booking-1",
    );
  });
});
