import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(async () => ({ messageId: "test" })),
    })),
  },
}));
import nodemailer from "nodemailer";
import {
  validateAgreement,
  holdDeadline,
  signToken,
  tokenIdentity,
  loadPrivateJourney,
  publicJourney,
  performAdminAction,
  performCustomerAction,
  recordJourneyPayment,
  recordJourneyRefund,
  emailForMessage,
  requireJourneyEnabled,
} from "../../../api/_lib/bookingJourney.js";

const ID = "22222222-2222-4222-8222-222222222222";
const GEN = "33333333-3333-4333-8333-333333333333";
const snapshot = {
  service: "End of tenancy",
  items: "1 bedroom Complete",
  scope: "Agreed checklist and oven",
  exclusions: "Carpet extraction not selected",
  address: "Test address",
  postcode: "E1 1AA",
  date: "2026-10-10",
  time: "09:00–11:00",
  totalPence: 27900,
  changeReason: "Internal agreement note",
  preparation: "Provide access",
};
function memoryDb(initial = {}) {
  const tables = {
    bookings: [
      {
        id: ID,
        booking_ref: "TEST-001",
        full_name: "Test Customer",
        email: "customer@example.invalid",
        service: "End of tenancy",
        address: "Test address",
        postcode: "E1 1AA",
        total_price: 279,
        deposit_amount: 0,
        payment_status: "pending_payment",
        status: "new",
      },
    ],
    booking_journeys: [
      {
        booking_id: ID,
        revision: 0,
        offer_version: 0,
        state: "draft",
        draft: snapshot,
        snapshot: null,
        previous_snapshot: null,
        token_generation: GEN,
        token_expires_at: "2027-09-08T00:00:00Z",
        hold_until: null,
        checkout_id: null,
        checkout_kind: null,
        checkout_creating_at: null,
        paid_pence: 0,
        refunded_pence: 0,
        customer_request: null,
        ...initial,
      },
    ],
    booking_journey_messages: [],
    booking_journey_events: [],
    booking_journey_payments: [],
  };
  let seq = 1;
  const db = {
    tables,
    from(table) {
      let filters = [],
        mode = "select",
        patch = null,
        one = false;
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push((r) => r[k] === v);
          return q;
        },
        in(k, v) {
          filters.push((r) => v.includes(r[k]));
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        update(value) {
          mode = "update";
          patch = value;
          return q;
        },
        insert(value) {
          mode = "insert";
          patch = value;
          return q;
        },
        maybeSingle() {
          one = true;
          return q;
        },
        single() {
          one = true;
          return q;
        },
        then(resolve, reject) {
          try {
            if (
              table === "bookings" &&
              mode === "update" &&
              db.failLegacyFlag &&
              (patch.email_customer_sent || patch.email_business_sent)
            )
              return Promise.resolve({
                data: null,
                error: { code: "TEST" },
              }).then(resolve, reject);
            let rows = tables[table].filter((r) => filters.every((f) => f(r)));
            if (mode === "update") rows.forEach((r) => Object.assign(r, patch));
            if (mode === "insert") {
              const row = { ...patch };
              tables[table].push(row);
              rows = [row];
            }
            return Promise.resolve({
              data: structuredClone(one ? rows[0] || null : rows),
              error: null,
            }).then(resolve, reject);
          } catch (e) {
            return Promise.reject(e).then(resolve, reject);
          }
        },
      };
      return q;
    },
    async rpc(name, p) {
      expect(name).toBe("apply_booking_journey");
      const j = tables.booking_journeys.find(
        (r) => r.booking_id === p.p_booking_id,
      );
      if (
        p.p_payment &&
        tables.booking_journey_payments.some(
          (r) => r.external_id === p.p_payment.external_id,
        )
      )
        return { data: structuredClone(j), error: null };
      if (j.revision !== p.p_revision)
        return { data: null, error: { code: "40001" } };
      Object.assign(j, p.p_patch, { revision: j.revision + 1 });
      Object.assign(tables.bookings[0], p.p_booking_patch);
      tables.booking_journey_events.push({ event_type: p.p_event });
      if (p.p_payment) tables.booking_journey_payments.push(p.p_payment);
      if (p.p_message)
        tables.booking_journey_messages.push({
          id: String(seq++),
          booking_id: ID,
          dedup_key: p.p_message.dedup_key,
          kind: p.p_message.kind,
          payload: p.p_message.payload,
          status: "pending",
          attempts: 0,
          created_at: new Date().toISOString(),
        });
      return { data: structuredClone(j), error: null };
    },
  };
  return db;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  vi.stubEnv("BOOKING_JOURNEY_ENABLED", "true");
  vi.stubEnv("BOOKING_JOURNEY_TOKEN_SECRET", "a".repeat(64));
  vi.stubEnv("BOOKING_JOURNEY_MODE", "test");
  vi.stubEnv("BOOKING_JOURNEY_TEST_EMAIL", "test@example.invalid");
  vi.stubEnv("GMAIL_SENDER", "sender@example.invalid");
  vi.stubEnv("GMAIL_APP_PASSWORD", "test-placeholder");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("agreed booking validation and privacy", () => {
  it("keeps the deposit at £30 and rejects prices below it, invalid dates and incomplete scope", () => {
    expect(validateAgreement(snapshot).policyVersion).toBe("2026-09-08");
    expect(() => validateAgreement({ ...snapshot, totalPence: 2999 })).toThrow(
      "at least £30",
    );
    expect(() =>
      validateAgreement({ ...snapshot, date: "2026-02-31" }),
    ).toThrow("valid appointment");
    expect(() => validateAgreement({ ...snapshot, items: "" })).toThrow(
      "included items",
    );
  });
  it("has a real 48-hour business deadline and requires explicit near-term timing", () => {
    expect(holdDeadline(null, snapshot)).toBe("2026-09-10T12:00:00.000Z");
    expect(() =>
      holdDeadline(null, { ...snapshot, date: "2026-09-09" }),
    ).toThrow("explicit");
    expect(() => holdDeadline("2026-09-11T12:00:00Z", snapshot)).toThrow(
      "48 hours",
    );
  });
  it("rejects tampered tokens and keeps internal agreement notes out of the private customer API", () => {
    const db = memoryDb();
    const token = signToken(db.tables.booking_journeys[0]);
    expect(tokenIdentity(token).id).toBe(ID);
    expect(() => tokenIdentity(token.slice(0, -1) + "!")).toThrow("invalid");
    expect(
      publicJourney(db.tables.bookings[0], db.tables.booking_journeys[0])
        .agreement,
    ).not.toHaveProperty("changeReason");
  });
  it("is off unless explicitly enabled", () => {
    vi.stubEnv("BOOKING_JOURNEY_ENABLED", "false");
    expect(() => requireJourneyEnabled()).toThrow("not enabled");
  });
  it("reads private booking details without changing any state, and rejects revoked or expired links", async () => {
    const db = memoryDb();
    const j = db.tables.booking_journeys[0],
      token = signToken(j);
    await loadPrivateJourney(db, token);
    expect(j.revision).toBe(0);
    expect(db.tables.booking_journey_events).toHaveLength(0);
    j.token_generation = "44444444-4444-4444-8444-444444444444";
    await expect(loadPrivateJourney(db, token)).rejects.toThrow("expired");
    j.token_expires_at = "2025-01-01";
    await expect(loadPrivateJourney(db, signToken(j))).rejects.toThrow(
      "expired",
    );
  });
  it("refuses a near-term deadline after the arrival start, using London daylight saving time", () => {
    expect(() =>
      holdDeadline("2026-09-09T09:30:00Z", {
        ...snapshot,
        date: "2026-09-09",
        time: "09:00–11:00",
      }),
    ).toThrow("before the arrival");
  });
});
describe("booking lifecycle and payment races", () => {
  it("reminds once about the existing confirmed appointment while proposed changes are pending", async () => {
    const original = { ...snapshot, date: "2026-09-09" };
    const db = memoryDb({
      state: "change_pending",
      snapshot: { ...snapshot, date: "2026-09-15" },
      previous_snapshot: original,
      paid_pence: 3000,
      appointment_reminder_sent_at: null,
    });
    await performAdminAction(
      db,
      ID,
      { operation: "appointment_reminder", revision: 0 },
      "worker",
    );
    const message = db.tables.booking_journey_messages[0];
    expect(message.kind).toBe("appointment_reminder");
    expect(message.payload.journey.snapshot.date).toBe("2026-09-09");
    expect(emailForMessage(message.payload).text).toContain(
      "no automatic payment",
    );
    await expect(
      performAdminAction(
        db,
        ID,
        { operation: "appointment_reminder", revision: 1 },
        "worker",
      ),
    ).rejects.toThrow("No appointment reminder is due");
  });
  it("sends a saved offer, creates a card-only £30 checkout, confirms once after verified payment, and credits the balance", async () => {
    const db = memoryDb();
    await performAdminAction(
      db,
      ID,
      { operation: "send", revision: 0, availabilityConfirmed: true },
      "admin:test",
    );
    let j = db.tables.booking_journeys[0];
    expect(j.state).toBe("offered");
    expect(j.hold_until).toBe("2026-09-10T12:00:00.000Z");
    expect(db.tables.bookings[0].payment_status).toBe("pending_payment");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "cs_test_a",
        url: "https://checkout.stripe.com/test",
        status: "open",
      }),
    });
    await performCustomerAction(db, signToken(j), {
      operation: "checkout",
      revision: j.revision,
    });
    const sent = fetch.mock.calls[0][1].body;
    expect(sent.get("line_items[0][price_data][unit_amount]")).toBe("3000");
    expect(sent.get("payment_method_types[0]")).toBe("card");
    expect(
      Number(sent.get("expires_at")) * 1000 - Date.now(),
    ).toBeLessThanOrEqual(24 * 3600000);
    const session = {
      id: "cs_test_a",
      payment_status: "paid",
      currency: "gbp",
      amount_total: 3000,
      metadata: {
        journey: "v1",
        booking_id: ID,
        offer_version: "1",
        payment_kind: "deposit",
        amount_pence: "3000",
      },
    };
    await recordJourneyPayment(db, session);
    await recordJourneyPayment(db, session);
    j = db.tables.booking_journeys[0];
    expect(j.state).toBe("confirmed");
    expect(j.paid_pence).toBe(3000);
    expect(db.tables.booking_journey_payments).toHaveLength(1);
    expect(publicJourney(db.tables.bookings[0], j).balancePence).toBe(24900);
    expect(db.tables.bookings[0].deposit_amount).toBe(30);
  });
  it("does not confirm an unpaid Stripe checkout return", async () => {
    const db = memoryDb();
    expect(
      await recordJourneyPayment(db, {
        metadata: { journey: "v1" },
        payment_status: "unpaid",
      }),
    ).toBe(true);
    expect(db.tables.booking_journeys[0].state).toBe("draft");
    expect(db.tables.booking_journey_payments).toHaveLength(0);
  });
  it("blocks cancellation while a checkout is processing and preserves the appointment", async () => {
    const db = memoryDb({
      state: "offered",
      snapshot,
      offer_version: 1,
      checkout_id: "cs_processing",
      hold_until: "2026-09-10T12:00:00Z",
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "complete", payment_status: "unpaid" }),
    });
    await expect(
      performCustomerAction(db, signToken(db.tables.booking_journeys[0]), {
        operation: "cancel",
        revision: 0,
        confirm: true,
      }),
    ).rejects.toThrow("processing");
    expect(db.tables.booking_journeys[0].state).toBe("offered");
  });
  it("recovers a crashed checkout reservation by checking Stripe before closing an expired unpaid hold", async () => {
    const db = memoryDb({
      state: "offered",
      snapshot,
      offer_version: 1,
      checkout_creating_at: "2026-09-07T10:00:00Z",
      hold_until: "2026-09-08T10:00:00Z",
    });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "cs_recovered",
              metadata: {
                journey: "v1",
                booking_id: ID,
                checkout_attempt: "2026-09-07T10:00:00Z",
              },
            },
          ],
          has_more: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "cs_recovered",
          status: "expired",
          payment_status: "unpaid",
        }),
      });
    await performAdminAction(
      db,
      ID,
      { operation: "expire", revision: 0 },
      "worker",
    );
    expect(db.tables.booking_journeys[0].state).toBe("expired");
    expect(db.tables.booking_journeys[0].checkout_creating_at).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("requires POST confirmation to cancel, sends a cancellation acknowledgement, and never refunds automatically", async () => {
    const db = memoryDb({
      state: "confirmed",
      snapshot,
      paid_pence: 3000,
      offer_version: 1,
    });
    const token = signToken(db.tables.booking_journeys[0]);
    await expect(
      performCustomerAction(db, token, { operation: "cancel", revision: 0 }),
    ).rejects.toThrow("confirm");
    await performCustomerAction(db, token, {
      operation: "cancel",
      revision: 0,
      confirm: true,
    });
    expect(db.tables.booking_journeys[0].state).toBe("cancelled");
    expect(db.tables.booking_journeys[0].paid_pence).toBe(3000);
    expect(db.tables.booking_journeys[0].refunded_pence).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.tables.booking_journey_messages[0].kind).toBe("cancelled");
  });
  it("keeps the paid original appointment during reschedule review, and changes it only on customer acceptance", async () => {
    const db = memoryDb({
      state: "confirmed",
      snapshot,
      paid_pence: 3000,
      offer_version: 1,
    });
    let j = db.tables.booking_journeys[0];
    await performCustomerAction(db, signToken(j), {
      operation: "reschedule",
      revision: 0,
      confirm: true,
      date: "2026-10-11",
      time: "11:00–13:00",
    });
    expect(j.snapshot.date).toBe("2026-10-10");
    await performAdminAction(
      db,
      ID,
      {
        operation: "draft",
        revision: j.revision,
        agreement: { ...snapshot, date: "2026-10-11" },
      },
      "admin:test",
    );
    await performAdminAction(
      db,
      ID,
      { operation: "send", revision: j.revision, availabilityConfirmed: true },
      "admin:test",
    );
    expect(j.state).toBe("change_pending");
    expect(j.previous_snapshot.date).toBe("2026-10-10");
    await performCustomerAction(db, signToken(j), {
      operation: "accept_change",
      revision: j.revision,
      confirm: true,
    });
    expect(j.state).toBe("confirmed");
    expect(db.tables.bookings[0].service_date).toBe("2026-10-11");
    expect(j.paid_pence).toBe(3000);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("records a late payment on a closed offer for staff review instead of silently confirming a cancelled clean", async () => {
    const db = memoryDb({ state: "cancelled", snapshot, offer_version: 1 });
    await recordJourneyPayment(db, {
      id: "cs_late",
      payment_status: "paid",
      currency: "gbp",
      amount_total: 3000,
      metadata: {
        journey: "v1",
        booking_id: ID,
        offer_version: "1",
        payment_kind: "deposit",
        amount_pence: "3000",
      },
    });
    expect(db.tables.booking_journeys[0].state).toBe("payment_review");
    expect(db.tables.booking_journeys[0].paid_pence).toBe(3000);
  });
  it("rejects stale staff edits and under-priced revisions after payment", async () => {
    const db = memoryDb({
      revision: 2,
      state: "confirmed",
      snapshot,
      paid_pence: 4000,
    });
    await expect(
      performAdminAction(
        db,
        ID,
        { operation: "draft", revision: 1, agreement: snapshot },
        "admin:test",
      ),
    ).rejects.toThrow("changed");
    db.tables.booking_journeys[0].draft = { ...snapshot, totalPence: 3000 };
    await expect(
      performAdminAction(
        db,
        ID,
        { operation: "send", revision: 2, availabilityConfirmed: true },
        "admin:test",
      ),
    ).rejects.toThrow("below money already paid");
  });
  it("records completed-job manual payments once and preserves real-money totals", async () => {
    const db = memoryDb({ state: "completed", snapshot, paid_pence: 3000 });
    await performAdminAction(
      db,
      ID,
      {
        operation: "manual_payment",
        revision: 0,
        amountPence: 24900,
        method: "bank_transfer",
        reference: "BANK-TEST-1",
      },
      "admin:test",
    );
    expect(db.tables.booking_journeys[0].paid_pence).toBe(27900);
    expect(db.tables.bookings[0].balance_status).toBe("paid");
    expect(db.tables.booking_journey_payments).toHaveLength(1);
  });
  it("logs confirmed Stripe refunds separately without making an extra refund call", async () => {
    const db = memoryDb({ state: "cancelled", snapshot, paid_pence: 3000 });
    const charge = {
      metadata: { journey: "v1", booking_id: ID },
      refunds: {
        data: [
          { id: "re_test", status: "succeeded", amount: 3000, currency: "gbp" },
        ],
      },
    };
    await recordJourneyRefund(db, charge);
    await recordJourneyRefund(db, charge);
    expect(db.tables.booking_journeys[0].refunded_pence).toBe(3000);
    expect(db.tables.booking_journey_payments).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects mismatched Stripe currency and amount without touching the ledger", async () => {
    const db = memoryDb({ state: "offered", snapshot, offer_version: 1 });
    await expect(
      recordJourneyPayment(db, {
        id: "cs_bad",
        payment_status: "paid",
        currency: "usd",
        amount_total: 3000,
        metadata: {
          journey: "v1",
          booking_id: ID,
          offer_version: "1",
          payment_kind: "deposit",
          amount_pence: "3000",
        },
      }),
    ).rejects.toThrow("currency");
    expect(db.tables.booking_journey_payments).toHaveLength(0);
  });
  it("does not turn a post-clean refund into an automatic new balance request", async () => {
    const db = memoryDb({ state: "completed", snapshot, paid_pence: 27900 });
    await recordJourneyRefund(db, {
      metadata: { journey: "v1", booking_id: ID },
      refunds: {
        data: [
          {
            id: "re_adjustment",
            status: "succeeded",
            amount: 3000,
            currency: "gbp",
          },
        ],
      },
    });
    expect(db.tables.booking_journeys[0].state).toBe("payment_review");
    expect(
      publicJourney(db.tables.bookings[0], db.tables.booking_journeys[0])
        .canPayBalance,
    ).toBe(false);
    expect(db.tables.bookings[0].balance_status).toBe("not_due");
  });
  it("requires staff availability confirmation before resolving a late payment into a confirmed appointment", async () => {
    const db = memoryDb({
      state: "payment_review",
      snapshot,
      paid_pence: 3000,
    });
    await expect(
      performAdminAction(
        db,
        ID,
        {
          operation: "resolve_payment",
          resolution: "confirm",
          reason: "Checked the payment",
          revision: 0,
        },
        "admin:test",
      ),
    ).rejects.toThrow("Check availability");
    await performAdminAction(
      db,
      ID,
      {
        operation: "resolve_payment",
        resolution: "confirm",
        reason: "Checked payment and availability with customer",
        availabilityConfirmed: true,
        revision: 0,
      },
      "admin:test",
    );
    expect(db.tables.booking_journeys[0].state).toBe("confirmed");
    expect(db.tables.bookings[0].deposit_amount).toBe(30);
  });
});
describe("communication failure handling", () => {
  it("never automatically resends an email because the legacy request flag failed after successful delivery", async () => {
    const db = memoryDb();
    db.tables.bookings[0].email_customer_sent = false;
    db.tables.bookings[0].email_business_sent = true;
    db.failLegacyFlag = true;
    const first = await performAdminAction(
      db,
      ID,
      { operation: "retry_request", revision: 0 },
      "admin:test",
    );
    expect(first.deliveries[0].status).toBe("sent");
    expect(db.tables.booking_journey_messages[0].status).toBe("sent");
    expect(db.tables.booking_journey_messages[0].last_error).toContain(
      "flag needs repair",
    );
    const transport = nodemailer.createTransport.mock.results.at(-1).value;
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    db.failLegacyFlag = false;
    await performAdminAction(
      db,
      ID,
      {
        operation: "retry_request",
        revision: db.tables.booking_journeys[0].revision,
      },
      "admin:test",
    );
    expect(db.tables.bookings[0].email_customer_sent).toBe(true);
    expect(db.tables.booking_journey_messages).toHaveLength(1);
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });
  it("saves the offer when SMTP is unavailable and leaves a visible retryable message", async () => {
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    const db = memoryDb();
    const result = await performAdminAction(
      db,
      ID,
      { operation: "send", revision: 0, availabilityConfirmed: true },
      "admin:test",
    );
    expect(db.tables.booking_journeys[0].state).toBe("offered");
    expect(result.deliveries[0].status).toBe("failed");
    expect(db.tables.booking_journey_messages[0].last_error).toContain(
      "credentials",
    );
  });
  it("routes test sends only to the dedicated test inbox", async () => {
    const db = memoryDb();
    await performAdminAction(
      db,
      ID,
      { operation: "send", revision: 0, availabilityConfirmed: true },
      "admin:test",
    );
    const transport = nodemailer.createTransport.mock.results.at(-1).value;
    expect(transport.sendMail.mock.calls[0][0].to).toBe("test@example.invalid");
    expect(transport.sendMail.mock.calls[0][0].subject).toMatch(/^\[TEST\]/);
  });
  it('overrides inherited booking-mail destinations with the approved preview inbox', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_TEST_EMAIL', 'preview@example.invalid');
    const db = memoryDb();
    await performAdminAction(db, ID, { operation: 'send', revision: 0, availabilityConfirmed: true }, 'admin:test');
    const transport = nodemailer.createTransport.mock.results.at(-1).value;
    expect(transport.sendMail.mock.calls[0][0]).toMatchObject({ to: 'preview@example.invalid', replyTo: 'preview@example.invalid' });
  });
  it("escapes customer data in the branded email and includes a readable plaintext private link", () => {
    const db = memoryDb({ snapshot });
    const mail = emailForMessage({
      kind: "deposit_request",
      name: "<img src=x onerror=1>",
      reference: "TEST",
      journey: db.tables.booking_journeys[0],
    });
    expect(mail.html).toContain("&lt;img");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.text).toContain("/manage-booking#token=");
    expect(mail.text).toContain("£30.00");
  });
});
