import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createPricingCatalogue } from "../../shared/pricingCatalogue.js";

const selectLikeMock = vi.fn();
const selectRequestMock = vi.fn();
const loadPricebookMock = vi.fn();
const insertSingleMock = vi.fn();
const claimNotificationsMock = vi.fn();
const recordNotificationMock = vi.fn();
const sendMailMock = vi.fn();
const updateGa4ContextMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: (name, args) => {
      if (name === "claim_booking_request_notifications")
        return claimNotificationsMock(args);
      if (name === "record_booking_request_notification")
        return recordNotificationMock(args);
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from: (table) => ({
      select: () => ({
        like: (...args) => selectLikeMock(...args),
        eq: (...args) => ({ maybeSingle: () => selectRequestMock(...args) }),
      }),
      insert: (row) => ({
        select: () => ({ single: () => insertSingleMock(row) }),
      }),
      update: (row) => ({
        eq: (column, value) => updateGa4ContextMock(table, row, column, value),
      }),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 20);
  return date.toISOString().slice(0, 10);
}

const REQUEST_KEY = "ac4e6421-0e54-4086-944e-3b08e5a4ce67";

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
    requestKey: REQUEST_KEY,
    ...overrides,
  };
}

function notificationClaims(channels = [
  "business_email",
  "customer_email",
  "telegram",
]) {
  const channelIds = {
    business_email: 0,
    customer_email: 1,
    telegram: 2,
  };
  const booking = {
    bookingRef: "E81AA010127",
    fullName: "Jane Smith",
    email: "jane@example.com",
    phone: "07700900000",
    address: "12 High Street",
    postcode: "E8 1AA",
    service: "Window cleaning",
    date: futureDate(),
    time: "Flexible",
    message: null,
    totalPrice: 85,
  };
  return channels.map((channel) => {
    const index = channelIds[channel];
    return {
      outbox_id: `00000000-0000-4000-8000-00000000000${index}`,
      booking_id: "booking-1",
      channel,
      claim_token: `10000000-0000-4000-8000-00000000000${index}`,
      booking,
    };
  });
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
    vi.stubEnv("GA4_BOOKING_MEASUREMENT_MODE", "disabled");
    updateGa4ContextMock.mockResolvedValue({ error: null });
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
    const claimedBookings = new Set();
    claimNotificationsMock.mockImplementation(async ({ p_booking_id }) => {
      const key = p_booking_id || "worker";
      if (claimedBookings.has(key)) return { data: [], error: null };
      claimedBookings.add(key);
      return { data: notificationClaims(), error: null };
    });
    recordNotificationMock.mockResolvedValue({ data: true, error: null });
  });

  function configureEmails() {
    process.env.GMAIL_SENDER = "sender@example.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    process.env.BUSINESS_EMAIL = "manager@example.com";
    sendMailMock.mockResolvedValue({ accepted: ["ok"] });
  }

  it.each([249, 399, 1, 9999])('rejects an unassessed after-builders request even with a client price of %s', async price => {
    const response = res();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    configureEmails();
    await handler(req(payload({
      service: 'Window cleaning', // A misleading display label cannot bypass the service config.
      price,
      quoteMode: 'fixed_quote',
      assessed: true,
      quoteConfig: {
        service: 'deep', deepService: 'after_builders', deepSize: 'bed2', deepBaths: 6,
        addOnCounts: { oven: 1, carpet_bundle: 1 }, parkingAvailable: 'yes', congestionZone: 'no',
        assessed: true, quoteMode: 'fixed_quote',
      },
    })), response);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: expect.stringMatching(/after-builders.*assessment.*fixed price/i),
      code: 'manual_quote_required',
      quoteUrl: '/after-builders-cleaning-london#builders-quote',
    });
    expect(loadPricebookMock).not.toHaveBeenCalled();
    expect(selectRequestMock).not.toHaveBeenCalled();
    expect(insertSingleMock).not.toHaveBeenCalled();
    expect(claimNotificationsMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('acknowledges a saved request while the platform keeps notification delivery alive', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    const contextKey = Symbol.for('@vercel/request-context');
    const continuations = [];
    globalThis[contextKey] = { get: () => ({ waitUntil: promise => continuations.push(promise) }) };
    configureEmails();
    claimNotificationsMock.mockResolvedValue({ data: notificationClaims(['business_email', 'customer_email']), error: null });
    let releaseMail;
    const mailDelivery = new Promise(resolve => { releaseMail = resolve; });
    sendMailMock.mockReturnValue(mailDelivery);
    try {
      const response = res();
      await handler(req(payload()), response);
      expect(response.statusCode).toBe(201);
      expect(insertSingleMock).toHaveBeenCalledOnce();
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(recordNotificationMock).not.toHaveBeenCalled();
      expect(continuations).toHaveLength(1);
      releaseMail({ accepted: ['synthetic@example.test'] });
      await Promise.all(continuations);
      expect(recordNotificationMock.mock.calls.filter(([row]) => row.p_status === 'sent')).toHaveLength(2);
    } finally {
      releaseMail({ accepted: [] });
      await Promise.all(continuations);
      delete globalThis[contextKey];
    }
  });

  it('accepts an initial and surname and trims email just like browser validation', async () => {
    const response = res();
    await handler(req(payload({ fullName: ' P Munt ', email: ' test@example.test ' })), response);
    expect(response.statusCode).toBe(201);
    expect(insertSingleMock).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'P Munt', email: 'test@example.test' }));
  });

  it.each(['P', ' ', 12, { name: 'Test' }])('rejects an invalid name before persistence: %j', fullName => {
    const response = res();
    return handler(req(payload({ fullName })), response).then(() => {
      expect(response.statusCode).toBe(400);
      expect(insertSingleMock).not.toHaveBeenCalled();
    });
  });

  it('uses London midnight for preferred dates during British Summer Time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T23:30:00Z'));
    try {
      const past = res();
      await handler(req(payload({ date: '2026-06-15' })), past);
      expect(past.statusCode).toBe(400);
      expect(JSON.parse(past.body).error).toContain('already passed');
      expect(insertSingleMock).not.toHaveBeenCalled();
      const today = res();
      await handler(req(payload({ date: '2026-06-16' })), today);
      expect(today.statusCode).toBe(201);
    } finally { vi.useRealTimers(); }
  });

  function ga4Context(overrides = {}) {
    return {
      analytics: true, advertising: false, consent_version: "2026-07-14",
      measurement_id: "G-TEST1234", client_id: "123456789.1791000000", session_id: "1791000000",
      captured_at: new Date().toISOString(), consent_recorded_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function configureGa4AndNotifications() {
    vi.stubEnv("GA4_BOOKING_MEASUREMENT_MODE", "validate");
    vi.stubEnv("GA4_MEASUREMENT_ID", "G-TEST1234");
    configureEmails();
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function expectAcceptedWithNotifications(response, fetchMock) {
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, requestId: "booking-1", total: 85 });
    expect(insertSingleMock).toHaveBeenCalledOnce();
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/bottest-bot-token/sendMessage");
    expect(recordNotificationMock.mock.calls.filter(([result]) => result.p_status === "sent")).toHaveLength(3);
  }

  it("saves valid optional GA4 context only after accepting the request and preserves all notification channels", async () => {
    const fetchMock = configureGa4AndNotifications();
    const context = ga4Context();
    const response = res();
    await handler(req(payload({ ga4_context: { ...context, customer_email: "must-not-be-saved@example.invalid", mode: "live" } })), response);
    expectAcceptedWithNotifications(response, fetchMock);
    expect(insertSingleMock.mock.calls[0][0]).not.toHaveProperty("ga4_context");
    expect(updateGa4ContextMock).toHaveBeenCalledExactlyOnceWith("bookings", { ga4_context: { ...context, mode: "validate" } }, "id", "booking-1");
    expect(insertSingleMock.mock.invocationCallOrder[0]).toBeLessThan(updateGa4ContextMock.mock.invocationCallOrder[0]);
    expect(updateGa4ContextMock.mock.invocationCallOrder[0]).toBeLessThan(claimNotificationsMock.mock.invocationCallOrder[0]);
  });

  it.each(["database error", "rejected write"])("accepts the request and sends notifications after an optional GA4 %s", async failure => {
    const fetchMock = configureGa4AndNotifications();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (failure === "database error") updateGa4ContextMock.mockResolvedValue({ error: { message: "private database detail" } });
    else updateGa4ContextMock.mockRejectedValue(new Error("private database detail"));
    const response = res();
    await handler(req(payload({ ga4_context: ga4Context() })), response);
    expectAcceptedWithNotifications(response, fetchMock);
    expect(updateGa4ContextMock).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledWith("[booking-request] optional GA4 context was not saved");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private database detail");
  });

  it.each(["disabled", "missing", "analytics denied", "wrong property", "invalid identity"])("makes no metadata update for %s GA4 context", async scenario => {
    const fetchMock = configureGa4AndNotifications();
    let context = ga4Context();
    if (scenario === "disabled") vi.stubEnv("GA4_BOOKING_MEASUREMENT_MODE", "disabled");
    if (scenario === "missing") context = undefined;
    if (scenario === "analytics denied") context.analytics = false;
    if (scenario === "wrong property") context.measurement_id = "G-OTHER123";
    if (scenario === "invalid identity") context.client_id = "customer@example.invalid";
    const response = res();
    await handler(req(payload({ ga4_context: context })), response);
    expectAcceptedWithNotifications(response, fetchMock);
    expect(updateGa4ContextMock).not.toHaveBeenCalled();
  });

  it("ignores changed analytics metadata in retry identity without overwriting first saved context or resending notifications", async () => {
    const fetchMock = configureGa4AndNotifications();
    const context = ga4Context();
    const original = payload({ ga4_context: context });
    const first = res();
    await handler(req(original), first);
    expectAcceptedWithNotifications(first, fetchMock);
    selectRequestMock.mockResolvedValue({ data: { ...insertSingleMock.mock.calls[0][0], id: "booking-1" }, error: null });
    const retry = res();
    await handler(req({ ...original, ga4_context: ga4Context({ client_id: "987654321.1791000001", advertising: true }) }), retry);
    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body)).toEqual({ ...JSON.parse(first.body), replayed: true });
    expect(insertSingleMock).toHaveBeenCalledOnce();
    expect(updateGa4ContextMock).toHaveBeenCalledExactlyOnceWith("bookings", { ga4_context: { ...context, mode: "validate" } }, "id", "booking-1");
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends approved preview acknowledgements only to the test inbox, with no inherited Telegram message', async () => {
    configureEmails();
    for (const [key, value] of Object.entries({ VERCEL_ENV: 'preview', VVE_PREVIEW_ISOLATION_APPROVED: 'true', VVE_PREVIEW_SUPABASE_PROJECT_REF: 'stageisolatedproject', VITE_SUPABASE_URL: 'https://stageisolatedproject.supabase.co', SUPABASE_URL: '', VVE_PREVIEW_TEST_EMAIL: 'preview@example.com', STRIPE_SECRET_KEY: '', BOOKING_JOURNEY_MODE: 'test', TELEGRAM_BOT_TOKEN: 'synthetic', TELEGRAM_CHAT_ID: 'synthetic' })) vi.stubEnv(key, value);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const response = res(); await handler(req(payload()), response);
    expect(response.statusCode).toBe(201); expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(insertSingleMock.mock.calls[0][0].measurement_is_test).toBe(true);
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

  it('routes customer replies to contact while owner alerts can reply to the customer', async () => {
    configureEmails();
    const response = res();
    await handler(req(payload()), response);
    expect(response.statusCode).toBe(201);
    const messages = sendMailMock.mock.calls.map(([mail]) => mail);
    expect(messages.find(mail => mail.to === 'jane@example.com')?.replyTo).toBe('contact@vveclean.co.uk');
    expect(messages.find(mail => mail.to === 'manager@example.com')?.replyTo).toBe('"Jane Smith" <jane@example.com>');
  });

  const requestKey = REQUEST_KEY;

  it.each([null, "not-a-uuid", "ac4e6421-0e54-1086-944e-3b08e5a4ce67"])(
    "rejects a missing or invalid durable request identity (%s)",
    async (invalidKey) => {
      const response = res();
      await handler(req(payload({ requestKey: invalidKey })), response);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toMatch(/request identifier/i);
      expect(insertSingleMock).not.toHaveBeenCalled();
    },
  );

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

  it("retries only the failed notification channel on a saved-request replay", async () => {
    configureEmails();
    claimNotificationsMock
      .mockResolvedValueOnce({
        data: notificationClaims(),
        error: null,
      })
      .mockResolvedValueOnce({
        data: notificationClaims(["customer_email"]),
        error: null,
      });
    sendMailMock
      .mockResolvedValueOnce({ accepted: ["manager@example.com"] })
      .mockRejectedValueOnce(Object.assign(new Error("private SMTP response"), {
        code: "ECONNECTION",
      }))
      .mockResolvedValueOnce({ accepted: ["jane@example.com"] });

    const original = payload({ requestKey });
    const first = res();
    await handler(req(original), first);
    const saved = { ...insertSingleMock.mock.calls[0][0], id: "booking-1" };
    selectRequestMock.mockResolvedValue({ data: saved, error: null });
    const replay = res();
    await handler(req(original), replay);

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(sendMailMock.mock.calls[2][0].messageId).toBe(
      sendMailMock.mock.calls[1][0].messageId,
    );
    const customerResults = recordNotificationMock.mock.calls
      .map(([result]) => result)
      .filter((result) => result.p_id.endsWith("001"));
    expect(customerResults.map((result) => result.p_status)).toEqual([
      "failed",
      "sent",
    ]);
    expect(
      recordNotificationMock.mock.calls
        .map(([result]) => result)
        .filter(
          (result) =>
            result.p_id.endsWith("000") && result.p_status === "sent",
        ),
    ).toHaveLength(1);
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

  it("persists consented first-touch attribution with its original timestamp", async () => {
    const firstTouchAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const consentRecordedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const response = res();
    await handler(req(payload({
      first_source: "google",
      last_source: "google",
      landing_page: "/carpet-cleaning-london",
      first_touch_at: firstTouchAt,
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "carpet",
      utm_term: "carpet cleaning",
      gclid: "valid-click-id",
      measurement_consent: {
        advertising: true,
        version: "2026-07-14",
        recorded_at: consentRecordedAt,
      },
    })), response);

    expect(response.statusCode).toBe(201);
    expect(insertSingleMock.mock.calls[0][0]).toMatchObject({
      first_source: "google",
      last_source: "google",
      landing_page: "/carpet-cleaning-london",
      attribution_first_touch_at: firstTouchAt,
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "carpet",
      utm_term: "carpet cleaning",
      gclid: "valid-click-id",
      measurement_advertising_consent: true,
      measurement_consent_recorded_at: consentRecordedAt,
      measurement_email_sha256: createHash("sha256").update("jane@example.com").digest("hex"),
      measurement_phone_sha256: createHash("sha256").update("+447700900000").digest("hex"),
      measurement_is_test: false,
    });
    expect(JSON.stringify(insertSingleMock.mock.calls[0][0])).not.toContain("+447700900000");
  });

  it("normalises consented Gmail and UK phone identifiers before hashing", async () => {
    const response = res();
    await handler(req(payload({
      email: " Jane.Smith+booking@GMAIL.com ",
      phone: "+44 (0) 7700 900000",
      measurement_consent: {
        advertising: true,
        version: "2026-07-14",
        recorded_at: new Date().toISOString(),
      },
    })), response);

    expect(response.statusCode).toBe(201);
    expect(insertSingleMock.mock.calls[0][0]).toMatchObject({
      measurement_email_sha256: createHash("sha256").update("janesmith@gmail.com").digest("hex"),
      measurement_phone_sha256: createHash("sha256").update("+447700900000").digest("hex"),
    });
  });

  it("fails closed when advertising consent is denied or its timestamp is not canonical ISO", async () => {
    const baseAttribution = {
      first_source: "google",
      last_source: "google",
      landing_page: "/",
      first_touch_at: "2026-09-24 10:00:00",
      utm_source: "google",
      gclid: "consented-click-id",
    };

    const denied = res();
    await handler(req(payload({
      ...baseAttribution,
      measurement_consent: {
        advertising: false,
        version: "2026-07-14",
        recorded_at: new Date().toISOString(),
      },
    })), denied);
    expect(denied.statusCode).toBe(201);
    expect(insertSingleMock.mock.calls[0][0]).toMatchObject({
      first_source: null,
      landing_page: null,
      attribution_first_touch_at: null,
      utm_source: null,
      gclid: null,
      measurement_advertising_consent: false,
      measurement_email_sha256: null,
      measurement_phone_sha256: null,
    });

    insertSingleMock.mockClear();
    const malformed = res();
    await handler(req(payload({
      ...baseAttribution,
      postcode: "E8 2BB",
      measurement_consent: {
        advertising: true,
        version: "2026-07-14",
        recorded_at: "2026-09-24T10:00:00+00:00",
      },
    })), malformed);
    expect(malformed.statusCode).toBe(201);
    expect(insertSingleMock.mock.calls[0][0]).toMatchObject({
      attribution_first_touch_at: null,
      gclid: null,
      measurement_advertising_consent: false,
      measurement_consent_recorded_at: null,
      measurement_email_sha256: null,
      measurement_phone_sha256: null,
    });

    insertSingleMock.mockClear();
    const invalidFirstTouch = res();
    await handler(req(payload({
      ...baseAttribution,
      postcode: "E8 3CC",
      measurement_consent: {
        advertising: true,
        version: "2026-07-14",
        recorded_at: new Date().toISOString(),
      },
    })), invalidFirstTouch);
    expect(invalidFirstTouch.statusCode).toBe(201);
    expect(insertSingleMock.mock.calls[0][0]).toMatchObject({
      attribution_first_touch_at: null,
      gclid: "consented-click-id",
      measurement_advertising_consent: true,
    });
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
      expect(message.text).toMatch(/deposit (?:request|payment instructions)/i);
      expect(message.text).not.toMatch(/Pay £30 deposit by card|checkout.stripe.com/i);
      expect(message.text).toMatch(/(?:review and confirm the job details|agree the scope, final price and time)/i);
      expect(message.html).toMatch(/deposit (?:request|payment instructions)/i);
      expect(message.html).not.toMatch(/Pay £30 deposit by card|checkout.stripe.com/i);
    }
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_status: "sent" }),
    );
    expect(
      recordNotificationMock.mock.calls.filter(
        ([result]) => result.p_status === "sent",
      ),
    ).toHaveLength(2);
  });

  it("sends the manager Telegram notification using the existing bot settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
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
    expect(telegramBody.text).toContain("Address: 12 High Street");
    expect(telegramBody.text).toContain("Postcode: E8 1AA");
    expect(telegramBody.text).toMatch(
      /No payment was taken.*booking is confirmed once the deposit is paid/s,
    );
    expect(telegramBody.text).not.toMatch(/£30 deposit|deposit link|Stripe/i);
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_status: "sent",
        p_error_code: null,
      }),
    );
  });
  it("recognises a Telegram provider rejection even when HTTP succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, description: "rejected" }) });
    vi.stubGlobal("fetch", fetchMock);
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    const response = res();
    await handler(req(payload()), response);
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_status: "failed",
        p_error_code: "telegram_rejected",
      }),
    );
  });

  it("quarantines an ambiguous Telegram timeout instead of automatically resending it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        Object.assign(new Error("private timeout detail"), { code: "ETIMEDOUT" }),
      ),
    );
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    const response = res();

    await handler(req(payload()), response);

    expect(response.statusCode).toBe(201);
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_status: "uncertain",
        p_error_code: "ETIMEDOUT",
      }),
    );
  });

  it("logs only fixed event labels and safe provider codes", async () => {
    const spies = ["error", "warn", "log"].map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const providerText = "private provider rejection for navid@example.invalid";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, description: providerText }),
      }),
    );
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    const privatePayload = payload({
      fullName: "Private Customer",
      email: "navid@example.invalid",
      phone: "07700900999",
      postcode: "N15 2NG",
    });
    const response = res();
    await handler(req(privatePayload), response);

    expect(response.statusCode).toBe(201);
    const logs = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    const derivedRef = JSON.parse(response.body).bookingRef;
    for (const privateValue of [
      privatePayload.fullName,
      privatePayload.email,
      privatePayload.phone,
      derivedRef,
      providerText,
    ]) expect(logs).not.toContain(privateValue);
    expect(logs).toContain("telegram_rejected");
  });
});
