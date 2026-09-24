import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGoogleDataManagerAdapter,
  dataManagerMeasurementPayload,
  deliverBookingMeasurements,
} from "../../api/_lib/depositMeasurement.js";

const row = (extra = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  event_key: "booking:22222222-2222-4222-8222-222222222222:deposit_paid",
  booking_id: "22222222-2222-4222-8222-222222222222",
  payment_external_id: "cs_verified",
  event_name: "deposit_paid",
  conversion_id: "33333333-3333-4333-8333-333333333333",
  amount_pence: 3000,
  currency: "gbp",
  payment_type: "stripe_deposit",
  occurred_at: "2026-09-17T12:00:00.000Z",
  attribution: { gclid: "safe.click-1", utm_campaign: "campaign", landing_page: "/carpet-cleaning-london" },
  consent: { advertising: true, version: "2026-07-14", recorded_at: "2026-09-16T10:00:00Z", withdrawn_at: null },
  match_data: {},
  is_test: false,
  provider: "google_data_manager",
  status: "sending",
  attempts: 1,
  provider_acknowledgement: null,
  ...extra,
});

const booking = (extra = {}) => ({
  measurement_advertising_consent: true,
  measurement_consent_version: "2026-07-14",
  measurement_consent_recorded_at: "2026-09-16T10:00:00Z",
  measurement_consent_withdrawn_at: null,
  measurement_is_test: false,
  ...extra,
});

function fakeDb(initialRow = row(), initialBooking = booking()) {
  let outbox = { ...initialRow };
  let bookingRow = { ...initialBooking };
  const updates = [];
  const db = {
    rpc: vi.fn(async () => {
      if (["pending", "failed", "sending"].includes(outbox.status)) outbox.status = "sending";
      outbox.attempts += 1;
      return { data: [{ ...outbox }], error: null };
    }),
    from(table) {
      let patch = null;
      const filters = {};
      const query = {
        select() { return query; },
        update(value) { patch = value; return query; },
        eq(key, value) { filters[key] = value; return query; },
        maybeSingle: async () => {
          if (table === "booking_measurement_outbox")
            return { data: filters.id === outbox.id ? { status: outbox.status, is_test: outbox.is_test } : null, error: null };
          if (table === "bookings")
            return { data: filters.id === outbox.booking_id ? { ...bookingRow } : null, error: null };
          return { data: null, error: null };
        },
        then(resolve, reject) {
          let changed = false;
          if (patch && table === "booking_measurement_outbox" && filters.id === outbox.id && filters.status === outbox.status) {
            updates.push({ ...patch });
            outbox = { ...outbox, ...patch };
            changed = true;
          }
          return Promise.resolve({ data: changed ? [{ id: outbox.id }] : [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    get row() { return outbox; },
    get booking() { return bookingRow; },
    setBooking(value) { bookingRow = { ...bookingRow, ...value }; },
    updates,
  };
  return db;
}

function configure(mode = "live") {
  for (const [name, value] of Object.entries({
    BOOKING_MEASUREMENT_MODE: mode,
    GOOGLE_ADS_CUSTOMER_ID: "1234567890",
    GOOGLE_DATA_MANAGER_CLIENT_ID: "test-client",
    GOOGLE_DATA_MANAGER_CLIENT_SECRET: "test-secret",
    GOOGLE_DATA_MANAGER_REFRESH_TOKEN: "test-refresh",
    GOOGLE_ADS_BOOKING_REQUEST_SUBMITTED_CONVERSION_ACTION_ID: "111111111",
    GOOGLE_ADS_BOOKING_REQUEST_QUALIFIED_CONVERSION_ACTION_ID: "222222222",
    GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID: "987654321",
    GOOGLE_ADS_BOOKING_CONFIRMED_CONVERSION_ACTION_ID: "444444444",
  })) vi.stubEnv(name, value);
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("canonical Data Manager payload", () => {
  it("uses the verified deposit value and Stripe transaction ID without raw customer PII", () => {
    configure();
    const payload = dataManagerMeasurementPayload(row({
      amount_pence: 4250,
      attribution: { gclid: "safe.click-1", email: "customer@example.invalid", postcode: "E1 1AA" },
    }));
    expect(payload).toMatchObject({
      destinations: [{
        operatingAccount: { accountType: "GOOGLE_ADS", accountId: "1234567890" },
        productDestinationId: "987654321",
      }],
      consent: { adUserData: "CONSENT_GRANTED", adPersonalization: "CONSENT_GRANTED" },
      events: [{
        adIdentifiers: { gclid: "safe.click-1" },
        conversionValue: 42.5,
        currency: "GBP",
        eventTimestamp: "2026-09-17T12:00:00.000Z",
        transactionId: "cs_verified",
        eventSource: "WEB",
      }],
      validateOnly: false,
    });
    expect(JSON.stringify(payload)).not.toMatch(/customer@example|postcode|E1 1AA/i);
  });

  it("supports Data Manager validation without changing the event", () => {
    configure();
    expect(dataManagerMeasurementPayload(row(), { validateOnly: true }).validateOnly).toBe(true);
  });

  it.each([
    { is_test: true },
    { status: "pending" },
    { consent: { advertising: false } },
    { consent: { advertising: true, withdrawn_at: "2026-09-17T11:00:00Z" } },
    { consent: { advertising: true, version: "2026-07-14", recorded_at: null, withdrawn_at: null } },
    { amount_pence: 0 },
    { currency: "usd" },
    { attribution: {} },
  ])("rejects unsafe or ineligible delivery %#", (change) => {
    configure();
    expect(() => dataManagerMeasurementPayload(row(change))).toThrow();
  });

  it.each([
    ["booking_request_submitted", "111111111"],
    ["booking_request_qualified", "222222222"],
    ["booking_confirmed", "444444444"],
  ])("routes %s to its own action without a payment value", (eventName, actionId) => {
    configure();
    const payload = dataManagerMeasurementPayload(row({
      event_name: eventName,
      event_key: `booking:22222222-2222-4222-8222-222222222222:${eventName}`,
      payment_external_id: null,
      amount_pence: null,
      currency: null,
      payment_type: null,
    }));
    expect(payload.destinations[0].productDestinationId).toBe(actionId);
    expect(payload.events[0].transactionId).toBe(
      `booking:22222222-2222-4222-8222-222222222222:${eventName}`,
    );
    expect(payload.events[0]).not.toHaveProperty("conversionValue");
    expect(payload.events[0]).not.toHaveProperty("currency");
  });

  it("never exposes a manual bank reference as the deposit transaction ID", () => {
    configure();
    const paymentReference = "bank-deposit:22222222-2222-4222-8222-222222222222:E1 1AA-240926";
    const payload = dataManagerMeasurementPayload(row({
      payment_external_id: paymentReference,
      payment_type: "bank_transfer_deposit",
    }));
    expect(payload.events[0].transactionId).toBe(
      "booking:22222222-2222-4222-8222-222222222222:deposit_paid",
    );
    expect(JSON.stringify(payload)).not.toContain(paymentReference);
    expect(JSON.stringify(payload)).not.toContain("E1 1AA");
  });

  it("safely upgrades a legacy deposit-only row at delivery time without rewriting it", () => {
    configure();
    const payload = dataManagerMeasurementPayload(row({
      provider: "google_ads_offline",
      event_key: null,
      occurred_at: null,
      paid_at: "2026-09-17T11:59:00.000Z",
      match_data: undefined,
      payment_type: "bank_transfer_deposit",
      payment_external_id: "WC1N 1LX-170926",
    }));
    expect(payload.events[0]).toMatchObject({
      eventTimestamp: "2026-09-17T11:59:00.000Z",
      transactionId: "booking:22222222-2222-4222-8222-222222222222:deposit_paid",
    });
    expect(JSON.stringify(payload)).not.toContain("WC1N 1LX-170926");
  });

  it("adds only consented normalized hashes as enhanced conversion match data", () => {
    configure();
    const emailHash = "A".repeat(64);
    const phoneHash = "b".repeat(64);
    const payload = dataManagerMeasurementPayload(row({
      match_data: {
        email_sha256: emailHash,
        phone_sha256: phoneHash,
        email: "customer@example.invalid",
      },
    }));
    expect(payload.encoding).toBe("HEX");
    expect(payload.events[0].userData).toEqual({ userIdentifiers: [
      { emailAddress: emailHash.toLowerCase() },
      { phoneNumber: phoneHash },
    ] });
    expect(JSON.stringify(payload)).not.toContain("customer@example.invalid");
  });

  it("accepts consented hash-only matching when no advertising click ID is available", () => {
    configure();
    const payload = dataManagerMeasurementPayload(row({
      attribution: {},
      match_data: { email_sha256: "a".repeat(64) },
    }));
    expect(payload.events[0]).not.toHaveProperty("adIdentifiers");
    expect(payload.events[0].userData).toEqual({
      userIdentifiers: [{ emailAddress: "a".repeat(64) }],
    });
    expect(payload.encoding).toBe("HEX");
  });

  it("omits invalid match values instead of sending them", () => {
    configure();
    const payload = dataManagerMeasurementPayload(row({
      match_data: { email_sha256: "not-a-hash", phone_sha256: "also-not-a-hash" },
    }));
    expect(payload).not.toHaveProperty("encoding");
    expect(payload.events[0]).not.toHaveProperty("userData");
  });
});

describe("durable Data Manager delivery", () => {
  it("fails closed for a missing or unknown delivery mode", async () => {
    configure("unexpected");
    const db = fakeDb(row({ status: "pending" }));
    const result = await deliverBookingMeasurements(db);
    expect(result).toMatchObject({ status: "disabled", processed: 0 });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("does not claim work until every canonical action is configured", async () => {
    configure();
    vi.stubEnv("GOOGLE_ADS_BOOKING_CONFIRMED_CONVERSION_ACTION_ID", "");
    const db = fakeDb(row({ status: "pending" }));
    const result = await deliverBookingMeasurements(db);
    expect(result).toMatchObject({ status: "disabled", processed: 0 });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("uses Data Manager validateOnly automatically in validate mode", () => {
    configure("validate");
    const adapter = createGoogleDataManagerAdapter({ fetchFn: vi.fn() });
    expect(adapter.configured).toBe(true);
    expect(adapter.validateOnly).toBe(true);
  });

  it("routes a claimed legacy provider row through the Data Manager adapter", async () => {
    configure("validate");
    const db = fakeDb(row({
      status: "pending",
      provider: "google_ads_offline",
      event_key: null,
      occurred_at: null,
      paid_at: "2026-09-17T11:59:00.000Z",
      attempts: 0,
    }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const result = await deliverBookingMeasurements(db, { fetchFn });

    expect(result).toMatchObject({ validated: 1, failed: 0 });
    expect(db.row.status).toBe("validated");
  });

  it("stores the real request ID as submitted, then marks delivery only after diagnostics succeed", async () => {
    configure();
    const db = fakeDb(row({ status: "pending", attempts: 0 }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access-1" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ requestId: "dm-request-123", fieldWarnings: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access-2" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        requestStatusPerDestination: [{ requestStatus: "SUCCESS", eventsIngestionStatus: { recordCount: "1" } }],
      }) });

    const submitted = await deliverBookingMeasurements(db, { fetchFn, now: () => new Date("2026-09-17T12:01:00Z") });
    expect(submitted).toMatchObject({ submitted: 1, delivered: 0, failed: 0 });
    expect(db.row.status).toBe("submitted");
    expect(JSON.parse(db.row.provider_acknowledgement)).toMatchObject({
      provider: "google_data_manager", requestId: "dm-request-123", status: "SUBMITTED",
    });

    const delivered = await deliverBookingMeasurements(db, { fetchFn, now: () => new Date("2026-09-17T12:31:00Z") });
    expect(delivered).toMatchObject({ submitted: 0, delivered: 1, failed: 0 });
    expect(db.row.status).toBe("delivered");
    expect(JSON.parse(db.row.provider_acknowledgement)).toMatchObject({
      requestId: "dm-request-123", status: "SUCCESS", recordCount: "1",
    });
    expect(fetchFn.mock.calls[1][0]).toBe("https://datamanager.googleapis.com/v1/events:ingest");
    expect(fetchFn.mock.calls[3][0]).toContain("requestStatus:retrieve?requestId=dm-request-123");
  });

  it("reconciles an exact duplicate transaction as an already-delivered retry", async () => {
    configure();
    const db = fakeDb(row({
      status: "submitted",
      attempts: 2,
      provider_acknowledgement: JSON.stringify({
        provider: "google_data_manager",
        requestId: "duplicate-retry-123",
        status: "SUBMITTED",
      }),
    }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        requestStatusPerDestination: [{
          requestStatus: "FAILED",
          eventsIngestionStatus: { recordCount: "1" },
          errorInfo: { errorCounts: [{
            reason: "PROCESSING_ERROR_REASON_DUPLICATE_TRANSACTION_ID",
            recordCount: "1",
          }] },
        }],
      }) });

    const result = await deliverBookingMeasurements(db, {
      fetchFn,
      now: () => new Date("2026-09-17T12:31:00Z"),
    });

    expect(result).toMatchObject({ delivered: 1, failed: 0, submitted: 0 });
    expect(db.row.status).toBe("delivered");
    expect(JSON.parse(db.row.provider_acknowledgement)).toMatchObject({
      status: "FAILED",
      idempotencyResult: "ALREADY_UPLOADED",
      errorReasons: ["PROCESSING_ERROR_REASON_DUPLICATE_TRANSACTION_ID"],
    });
  });

  it("does not treat any other provider rejection as successful delivery", async () => {
    configure();
    const db = fakeDb(row({
      status: "submitted",
      attempts: 2,
      provider_acknowledgement: JSON.stringify({
        provider: "google_data_manager",
        requestId: "invalid-click-123",
        status: "SUBMITTED",
      }),
    }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        requestStatusPerDestination: [{
          requestStatus: "FAILED",
          eventsIngestionStatus: { recordCount: "1" },
          errorInfo: { errorCounts: [{
            reason: "PROCESSING_ERROR_REASON_INVALID_GCLID",
            recordCount: "1",
          }] },
        }],
      }) });

    const result = await deliverBookingMeasurements(db, {
      fetchFn,
      now: () => new Date("2026-09-17T12:31:00Z"),
    });

    expect(result).toMatchObject({ delivered: 0, failed: 1, submitted: 0 });
    expect(db.row).toMatchObject({
      status: "failed",
      last_error: "data_manager_failed_PROCESSING_ERROR_REASON_INVALID_GCLID",
    });
  });

  it("rechecks live consent after provider preparation and suppresses before sending", async () => {
    const db = fakeDb();
    const adapter = {
      configured: true,
      prepare: vi.fn(async () => { db.setBooking({ measurement_consent_withdrawn_at: "2026-09-17T12:00:00Z" }); }),
      send: vi.fn(),
    };
    const result = await deliverBookingMeasurements(db, {
      adapters: { google_data_manager: adapter },
      now: () => new Date("2026-09-17T12:01:00Z"),
    });
    expect(result).toMatchObject({ suppressed: 1, submitted: 0, delivered: 0 });
    expect(adapter.send).not.toHaveBeenCalled();
    expect(db.row).toMatchObject({ status: "suppressed", last_error: "consent_withdrawn" });
  });

  it("keeps temporary send failures visible and retries the same transaction safely", async () => {
    configure();
    const db = fakeDb(row({ status: "pending", attempts: 0 }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access-1" }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({
        error: { status: "UNAVAILABLE", details: [{ reason: "BACKEND_ERROR" }] },
      }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access-2" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ requestId: "retry-request", fieldWarnings: [] }) });

    const failed = await deliverBookingMeasurements(db, { fetchFn, now: () => new Date("2026-09-17T12:00:00Z") });
    expect(failed).toMatchObject({ failed: 1, submitted: 0 });
    expect(db.row).toMatchObject({ status: "failed", last_error: "data_manager_http_503_unavailable_backend_error" });
    expect(db.row.next_attempt_at).toBeTruthy();

    const retried = await deliverBookingMeasurements(db, { fetchFn, now: () => new Date("2026-09-17T12:10:00Z") });
    expect(retried).toMatchObject({ failed: 0, submitted: 1 });
    expect(db.row.status).toBe("submitted");
    const sentBodies = fetchFn.mock.calls
      .filter(([url]) => url === "https://datamanager.googleapis.com/v1/events:ingest")
      .map(([, options]) => JSON.parse(options.body));
    expect(sentBodies).toHaveLength(2);
    expect(sentBodies[0].events[0].transactionId).toBe(sentBodies[1].events[0].transactionId);
  });

  it("keeps a submitted request recoverable when diagnostics are temporarily unavailable", async () => {
    const db = fakeDb(row({
      status: "submitted",
      attempts: 2,
      provider_acknowledgement: JSON.stringify({ provider: "google_data_manager", requestId: "pending-123", status: "SUBMITTED" }),
    }));
    const adapter = {
      configured: true,
      prepare: vi.fn(async () => {}),
      check: vi.fn(async () => { throw new Error("raw provider detail must not be stored"); }),
    };
    const result = await deliverBookingMeasurements(db, {
      adapters: { google_data_manager: adapter },
      now: () => new Date("2026-09-17T13:00:00Z"),
    });
    expect(result).toMatchObject({ submitted: 1, delivered: 0, failed: 0 });
    expect(db.row).toMatchObject({ status: "submitted", last_error: "measurement_delivery_failed" });
    expect(db.row.last_error).not.toContain("raw provider");
    expect(db.row.next_attempt_at).toBeTruthy();
  });

  it("records validate-only acceptance as validated, never delivered", async () => {
    configure();
    const db = fakeDb();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access" }) })
      // Google's validateOnly response can be an empty object: validation does
      // not create an upload that needs asynchronous status polling.
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const adapter = createGoogleDataManagerAdapter({ fetchFn, validateOnly: true });
    const result = await deliverBookingMeasurements(db, {
      adapters: { google_data_manager: adapter },
      now: () => new Date("2026-09-17T12:00:00Z"),
    });
    expect(result).toMatchObject({ validated: 1, delivered: 0, submitted: 0 });
    expect(db.row.status).toBe("validated");
    expect(JSON.parse(db.row.provider_acknowledgement)).toMatchObject({
      validateOnly: true, status: "VALIDATED",
    });
    expect(JSON.parse(db.row.provider_acknowledgement)).not.toHaveProperty("requestId");
  });

  it("stores only sanitised validation warning codes and field paths", async () => {
    configure();
    const db = fakeDb();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        fieldWarnings: [{
          fieldPath: "events[0].userData",
          reason: "MATCH_RATE_LOW",
          description: "customer@example.invalid must never be retained",
        }],
      }) });
    const adapter = createGoogleDataManagerAdapter({ fetchFn, validateOnly: true });

    await deliverBookingMeasurements(db, {
      adapters: { google_data_manager: adapter },
      now: () => new Date("2026-09-17T12:00:00Z"),
    });

    const acknowledgement = JSON.parse(db.row.provider_acknowledgement);
    expect(acknowledgement).toMatchObject({
      fieldWarningCount: 1,
      fieldWarnings: [{ fieldPath: "events[0].userData", reason: "MATCH_RATE_LOW" }],
    });
    expect(db.row.provider_acknowledgement).not.toContain("customer@example.invalid");
  });
});
