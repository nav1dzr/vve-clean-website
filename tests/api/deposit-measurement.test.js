import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverDepositMeasurements, googleAdsDepositPayload } from "../../api/_lib/depositMeasurement.js";

const row = (extra = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  booking_id: "22222222-2222-4222-8222-222222222222",
  payment_external_id: "cs_verified",
  event_name: "deposit_paid",
  conversion_id: "33333333-3333-4333-8333-333333333333",
  amount_pence: 3000,
  currency: "gbp",
  payment_type: "stripe_deposit",
  paid_at: "2026-09-17T12:00:00.000Z",
  attribution: { gclid: "safe.click-1", utm_campaign: "campaign", landing_page: "/carpet-cleaning-london" },
  consent: { advertising: true, version: "2026-07-14", recorded_at: "2026-09-16T10:00:00Z", withdrawn_at: null },
  is_test: false,
  status: "sending",
  attempts: 1,
  ...extra,
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("verified deposit measurement", () => {
  it("uses the verified amount, currency, paid time and opaque conversion id without PII", () => {
    vi.stubEnv("GOOGLE_ADS_CUSTOMER_ID", "1234567890");
    vi.stubEnv("GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID", "987654321");
    const payload = googleAdsDepositPayload(row({
      attribution: { gclid: "safe.click-1", email: "customer@example.invalid", postcode: "E1 1AA", booking_ref: "E11AA" },
    }));
    expect(payload.conversions[0]).toMatchObject({
      gclid: "safe.click-1", conversionValue: 30, currencyCode: "GBP",
      orderId: "33333333-3333-4333-8333-333333333333",
    });
    expect(JSON.stringify(payload)).not.toMatch(/customer@example|postcode|booking_ref|E1 1AA/i);
  });

  it.each([
    { is_test: true },
    { status: "pending" },
    { consent: { advertising: false } },
    { consent: { advertising: true, withdrawn_at: "2026-09-17T11:00:00Z" } },
    { amount_pence: 0 },
    { currency: "usd" },
    { attribution: {} },
  ])("rejects unsafe or ineligible delivery %#", (change) => {
    vi.stubEnv("GOOGLE_ADS_CUSTOMER_ID", "1234567890");
    vi.stubEnv("GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID", "987654321");
    expect(() => googleAdsDepositPayload(row(change))).toThrow();
  });

  it("records provider acknowledgement after one supported offline upload", async () => {
    for (const [name, value] of Object.entries({
      DEPOSIT_MEASUREMENT_ENABLED: "true", GOOGLE_ADS_API_VERSION: "vTEST",
      GOOGLE_ADS_CUSTOMER_ID: "1234567890", GOOGLE_ADS_DEVELOPER_TOKEN: "test",
      GOOGLE_ADS_CLIENT_ID: "test", GOOGLE_ADS_CLIENT_SECRET: "test",
      GOOGLE_ADS_REFRESH_TOKEN: "test", GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID: "987654321",
    })) vi.stubEnv(name, value);
    const updates = [];
    const query = { eq: vi.fn(() => query), then: (resolve) => Promise.resolve({ error: null }).then(resolve) };
    const db = {
      rpc: vi.fn(async () => ({ data: [row()], error: null })),
      from: vi.fn(() => ({ update: vi.fn((patch) => { updates.push(patch); return query; }) })),
    };
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-access" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ resourceName: "customers/123/conversions/opaque" }] }) });
    const result = await deliverDepositMeasurements(db, { fetchFn });
    expect(result).toMatchObject({ processed: 1, delivered: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(updates.at(-1)).toMatchObject({ status: "delivered", provider_acknowledgement: "customers/123/conversions/opaque" });
  });
});
