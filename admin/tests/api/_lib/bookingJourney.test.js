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
  deliverJourneyMessages,
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
const depositSnapshot = { ...snapshot, paymentPlan: "deposit_after_agreement", paymentWindowHours: 48 };
const paidSession = (id = "cs_deposit") => ({ id, payment_status: "paid", status: "complete", currency: "gbp", amount_total: 3000,
  metadata: { journey: "v1", booking_id: ID, offer_version: "1", payment_kind: "deposit", amount_pence: "3000" } });
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
  it("validates the agreed amount independently of any deposit, plus date and scope", () => {
    expect(validateAgreement(snapshot).policyVersion).toBe("2026-09-14");
    expect(validateAgreement({ ...snapshot, totalPence: 2999 }).totalPence).toBe(2999);
    expect(() => validateAgreement({ ...snapshot, totalPence: 0 })).toThrow(
      "positive",
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
      "No automatic payment",
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
  it("confirms an agreed booking directly with no payment, deadline or Stripe request", async () => {
    const db = memoryDb({ draft: { ...snapshot, date: "2026-09-08" } });
    await performAdminAction(db, ID, { operation: "send", revision: 0, availabilityConfirmed: true }, "admin:test");
    const j = db.tables.booking_journeys[0];
    expect(j.state).toBe("confirmed");
    expect(j.hold_until).toBeNull();
    expect(j.paid_pence).toBe(0);
    expect(db.tables.bookings[0]).toMatchObject({ status: "confirmed", payment_status: "pending_payment", deposit_amount: 0, balance_status: "not_due" });
    expect(db.tables.booking_journey_payments).toHaveLength(0);
    expect(db.tables.booking_journey_messages[0].kind).toBe("confirmation");
    expect(db.tables.booking_journey_messages[0].status).toBe("sent");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("blocks an old unpaid offer checkout before touching Stripe or the booking", async () => {
    const db = memoryDb({ state: "offered", snapshot, hold_until: "2026-09-10T12:00:00.000Z" });
    const j = db.tables.booking_journeys[0];
    expect(publicJourney(db.tables.bookings[0], j).canPayDeposit).toBe(false);
    await expect(performCustomerAction(db, signToken(j), { operation: "checkout", revision: 0 })).rejects.toThrow("Payment is not available");
    await expect(performAdminAction(db, ID, { operation: "remind", revision: 0 }, "admin:test")).rejects.toThrow("No deposit reminder is due");
    expect(j.revision).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.tables.booking_journey_messages).toHaveLength(0);
  });
  it("closes an existing unpaid deposit checkout before directly confirming the agreed appointment", async () => {
    const db = memoryDb({ state: "offered", snapshot, checkout_id: "cs_old_offer", offer_version: 1 });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cs_old_offer", status: "open", payment_status: "unpaid" }) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cs_old_offer", status: "expired", payment_status: "unpaid" }) });
    await performAdminAction(db, ID, { operation: "send", revision: 0, availabilityConfirmed: true }, "admin:test");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe("https://api.stripe.com/v1/checkout/sessions/cs_old_offer/expire");
    expect(db.tables.booking_journeys[0]).toMatchObject({ state: "confirmed", paid_pence: 0, checkout_id: null, hold_until: null });
    expect(db.tables.bookings[0]).toMatchObject({ status: "confirmed", deposit_amount: 0, payment_status: "pending_payment" });
    expect(db.tables.booking_journey_payments).toHaveLength(0);
  });
  it("still reconciles an actual historical deposit payment once and credits its balance", async () => {
    const db = memoryDb({ state: "offered", snapshot, offer_version: 1 });
    const session = { id: "cs_historical", payment_status: "paid", currency: "gbp", amount_total: 3000,
      metadata: { journey: "v1", booking_id: ID, offer_version: "1", payment_kind: "deposit", amount_pence: "3000" } };
    await recordJourneyPayment(db, session);
    await recordJourneyPayment(db, session);
    const j = db.tables.booking_journeys[0];
    expect(j.paid_pence).toBe(3000);
    expect(db.tables.booking_journey_payments).toHaveLength(1);
    expect(publicJourney(db.tables.bookings[0], j).balancePence).toBe(24900);
    expect(db.tables.bookings[0].deposit_amount).toBe(30);
  });
  it.each([0, 3000])("keeps completed-clean balance checkout working with %i pence already paid", async (paidPence) => {
    const db = memoryDb({ state: "completed", snapshot, paid_pence: paidPence });
    const j = db.tables.booking_journeys[0];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cs_balance", url: "https://checkout.stripe.com/test", status: "open" }) });
    await performCustomerAction(db, signToken(j), { operation: "checkout", revision: 0 });
    const sent = fetch.mock.calls[0][1].body;
    expect(sent.get("line_items[0][price_data][unit_amount]")).toBe(String(snapshot.totalPence - paidPence));
    expect(sent.get("metadata[payment_kind]")).toBe("balance");
    expect(sent.get("payment_method_types[0]")).toBe("card");
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
  it("requires an explicit cancellation request, then owner cancellation, without an automatic refund", async () => {
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
    expect(db.tables.booking_journeys[0].state).toBe("confirmed");
    expect(db.tables.booking_journeys[0].customer_request.kind).toBe("cancel");
    expect(db.tables.booking_journey_messages[0].kind).toBe("cancellation_requested");
    await performAdminAction(db, ID, { operation: "cancel", revision: 1, reason: "Customer requested cancellation", confirm: true }, "admin:test");
    expect(db.tables.booking_journeys[0].state).toBe("cancelled");
    expect(db.tables.booking_journeys[0].paid_pence).toBe(3000);
    expect(db.tables.booking_journeys[0].refunded_pence).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.tables.booking_journey_messages.at(-1).kind).toBe("cancelled");
  });
  it.each([0, 3000])("keeps the original appointment with %i pence paid during reschedule review until customer acceptance", async (paidPence) => {
    const db = memoryDb({
      state: "confirmed",
      snapshot,
      paid_pence: paidPence,
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
    expect(j.paid_pence).toBe(paidPence);
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
    expect(db.tables.bookings[0].deposit_amount).toBe(0);
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
  it("saves the confirmation when SMTP is unavailable and leaves a visible retryable message", async () => {
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    const db = memoryDb();
    const result = await performAdminAction(
      db,
      ID,
      { operation: "send", revision: 0, availabilityConfirmed: true },
      "admin:test",
    );
    expect(db.tables.booking_journeys[0].state).toBe("confirmed");
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
    expect(mail.text).toContain("No deposit is required");
    expect(mail.text).not.toMatch(/£30|Deposit due|Payment deadline/);
  });
});

describe("retired deposit communications", () => {
  it("suppresses queued deposit requests and reminders without sending", async () => {
    const db = memoryDb({ state: "offered", snapshot, offer_version: 1, hold_until: "2026-09-10T12:00:00Z" });
    for (const kind of ["deposit_request", "reminder"]) db.tables.booking_journey_messages.push({ id: kind, booking_id: ID, kind, payload: { kind, journey: structuredClone(db.tables.booking_journeys[0]) }, status: "pending", attempts: 0 });
    await deliverJourneyMessages(db, ID);
    expect(db.tables.booking_journey_messages.every(m => m.status === "suppressed")).toBe(true);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["deposit_request", "confirmation", "change_proposal", "revised_confirmation", "reminder", "appointment_reminder", "expired", "balance_due"])("keeps %s templates free of deposit requirements", kind => {
    const db = memoryDb({ snapshot });
    const mail = emailForMessage({ kind, name: "Test", reference: "TEST", journey: db.tables.booking_journeys[0] });
    expect(mail.text + mail.html).not.toMatch(/£30|Deposit due|Payment deadline|deposit confirms|paying.*confirms/i);
  });
});


describe("bank instructions in directly confirmed bookings", () => {
  function configureBank() {
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NAME", "EXAMPLE ONLY");
    vi.stubEnv("INVOICE_BANK_SORT_CODE", "00-00-00");
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NUMBER", "00000000");
  }
  it("freezes server bank details and the existing reference, without requesting payment before completion", async () => {
    configureBank();
    const db = memoryDb();
    db.tables.bookings[0].booking_ref = "E11AA101026-1";
    await performAdminAction(db, ID, { operation: "send", revision: 0, availabilityConfirmed: true }, "test");
    let j = db.tables.booking_journeys[0];
    expect(j.state).toBe("confirmed");
    expect(j.snapshot.paymentInstructions.bank.reference).toBe("E11AA101026-1");
    const message = db.tables.booking_journey_messages.find((m) => m.kind === "confirmation");
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NAME", "LATER SETTINGS");
    const email = emailForMessage(message.payload);
    expect(email.text).toContain("EXAMPLE ONLY");
    expect(email.text).not.toContain("LATER SETTINGS");
    expect(email.text).toContain("no payment is needed now");
    expect(email.html).toContain("Payment after your clean");
    expect(email.text).not.toContain("Internal agreement note");
    expect(publicJourney(db.tables.bookings[0], j).canPayBalance).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    await performAdminAction(db, ID, { operation: "complete", revision: j.revision }, "test");
    j = db.tables.booking_journeys[0];
    expect(publicJourney(db.tables.bookings[0], j).canPayBalance).toBe(true);
    expect(emailForMessage(db.tables.booking_journey_messages.find((m) => m.kind === "balance_due").payload).text).toContain("Payment is now due");
  });
  it("keeps the reviewed bank account and customer reference when settings or the appointment date change", async () => {
    configureBank();
    const db = memoryDb();
    await performAdminAction(db, ID, { operation: "draft", revision: 0, agreement: snapshot }, "test");
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NAME", "CHANGED AFTER PREVIEW");
    await performAdminAction(db, ID, { operation: "send", revision: db.tables.booking_journeys[0].revision, availabilityConfirmed: true }, "test");
    expect(db.tables.booking_journeys[0].snapshot.paymentInstructions.bank.accountName).toBe("EXAMPLE ONLY");
    await performAdminAction(db, ID, { operation: "draft", revision: db.tables.booking_journeys[0].revision, agreement: { ...snapshot, date: "2026-10-11" } }, "test");
    await performAdminAction(db, ID, { operation: "send", revision: db.tables.booking_journeys[0].revision, availabilityConfirmed: true }, "test");
    expect(db.tables.bookings[0].booking_ref).toBe("TEST-001");
    expect(db.tables.booking_journeys[0].snapshot.paymentInstructions.bank).toMatchObject({ reference: "TEST-001", accountName: "EXAMPLE ONLY" });
  });
  it("does not invent a bank account or accept browser-supplied payment instructions", async () => {
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NAME", "");
    vi.stubEnv("INVOICE_BANK_SORT_CODE", "");
    vi.stubEnv("INVOICE_BANK_ACCOUNT_NUMBER", "");
    const db = memoryDb();
    await performAdminAction(db, ID, { operation: "draft", revision: 0, agreement: { ...snapshot, paymentInstructions: { bank: { accountName: "ATTACKER" } } } }, "test");
    await performAdminAction(db, ID, { operation: "send", revision: db.tables.booking_journeys[0].revision, availabilityConfirmed: true }, "test");
    const j = db.tables.booking_journeys[0];
    expect(j.snapshot.paymentInstructions.bank).toBeNull();
    expect(emailForMessage(db.tables.booking_journey_messages.find((m) => m.kind === "confirmation").payload).text).not.toContain("ATTACKER");
  });
  it("hides transfer instructions on cancellations, revisions, drafts and settled bookings", () => {
    const instructions = { due: "after_clean", bank: { accountName: "EXAMPLE ONLY", sortCode: "00-00-00", accountNumber: "00000000", reference: "E11AA101026" } };
    for (const state of ["draft", "cancelled", "change_pending", "payment_review", "expired"]) {
      const db = memoryDb({ state, snapshot: { ...snapshot, paymentInstructions: instructions } });
      expect(publicJourney(db.tables.bookings[0], db.tables.booking_journeys[0]).paymentInstructions).toBeNull();
      expect(emailForMessage({ kind: state === "cancelled" ? "cancelled" : "change_proposal", reference: "TEST", journey: db.tables.booking_journeys[0] }).text).not.toContain("Account number:");
    }
    const db = memoryDb({ state: "completed", snapshot: { ...snapshot, paymentInstructions: instructions }, paid_pence: snapshot.totalPence });
    expect(publicJourney(db.tables.bookings[0], db.tables.booking_journeys[0]).paymentInstructions).toBeNull();
  });
});

describe("deposit after owner agreement", () => {
  const offered = (extra = {}) => memoryDb({ state: "offered", snapshot: depositSnapshot, draft: depositSnapshot, offer_version: 1, hold_until: "2026-09-10T12:00:00Z", ...extra });
  it("sends an agreed £30 request, creates a fixed card checkout, and confirms one payment only", async () => {
    const db = memoryDb({ draft: depositSnapshot });
    await performAdminAction(db, ID, { operation: "send", revision: 0, availabilityConfirmed: true }, "admin:test");
    const j = db.tables.booking_journeys[0];
    expect(j.state).toBe("offered");
    expect(db.tables.bookings[0].status).toBe("new");
    expect(j.paid_pence).toBe(0);
    const mail = emailForMessage(db.tables.booking_journey_messages[0].payload);
    expect(mail.html).toContain("Pay £30 deposit by card");
    expect(mail.html).toContain("&amp;pay=deposit");
    expect(mail.text).toContain("£279.00");
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cs_deposit", url: "https://checkout.stripe.com/test" }) });
    await performCustomerAction(db, signToken(j), { operation: "checkout", revision: j.revision });
    const sent = fetch.mock.calls[0][1].body;
    expect(sent.get("line_items[0][price_data][unit_amount]")).toBe("3000");
    expect(sent.get("metadata[payment_kind]")).toBe("deposit");
    expect(Number(sent.get("expires_at")) * 1000).toBeLessThanOrEqual(Date.now() + 24 * 3600000);
    await recordJourneyPayment(db, paidSession());
    await recordJourneyPayment(db, paidSession());
    expect(j.state).toBe("confirmed");
    expect(j.paid_pence).toBe(3000);
    expect(publicJourney(db.tables.bookings[0], j)).toMatchObject({ canPayDeposit: false, balancePence: 24900 });
    expect(db.tables.bookings[0]).toMatchObject({ status: "confirmed", deposit_amount: 30, total_price: 279 });
    expect(db.tables.booking_journey_payments).toHaveLength(1);
    expect(db.tables.booking_journey_messages.filter(m => m.kind === "confirmation")).toHaveLength(1);
    expect(db.tables.booking_journey_messages.find(m => m.kind === "deposit_request").status).toBe("sent");
    const confirmation = db.tables.booking_journey_messages.find(m => m.kind === "confirmation");
    expect(emailForMessage(confirmation.payload).text).toContain("received your deposit");
  });
  it("records a checked bank transfer and credits £30 without Stripe or a second payment", async () => {
    const db = offered(), j = db.tables.booking_journeys[0];
    const body = { operation: "manual_deposit", revision: 0, amountPence: 3000, method: "bank_transfer", reference: "E11AA101026" };
    await expect(performAdminAction(db, ID, body, "admin:test")).rejects.toThrow("has arrived");
    await performAdminAction(db, ID, { ...body, receivedConfirmed: true }, "admin:test");
    expect(j).toMatchObject({ state: "confirmed", paid_pence: 3000, hold_until: null });
    expect(db.tables.booking_journey_payments[0].kind).toBe("manual_deposit");
    expect(db.tables.booking_journey_messages[0].payload.payment.method).toBe("bank_transfer");
    await expect(performAdminAction(db, ID, { ...body, revision: j.revision, receivedConfirmed: true }, "admin:test")).rejects.toThrow("current appointment");
    expect(db.tables.booking_journey_payments).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["manual_deposit", "remind"])("reconciles a card payment before %s and never duplicates it", async operation => {
    const db = offered({ checkout_id: "cs_deposit" });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => paidSession() });
    await expect(performAdminAction(db, ID, { operation, revision: 0, receivedConfirmed: true, method: "bank_transfer", amountPence: 3000, reference: "checked" }, "admin:test")).rejects.toThrow("Payment has been received");
    expect(db.tables.booking_journeys[0].paid_pence).toBe(3000);
    expect(db.tables.booking_journey_messages.some(m => m.kind === "reminder")).toBe(false);
    expect(db.tables.booking_journey_payments).toHaveLength(1);
  });
  it("records a late bank transfer for review, then confirms only after the owner checks availability", async () => {
    const db = offered({ state: "expired", hold_until: "2026-09-08T10:00:00Z" }), j = db.tables.booking_journeys[0];
    await performAdminAction(db, ID, { operation: "manual_deposit", revision: 0, amountPence: 3000, method: "bank_transfer", reference: "checked-late", receivedConfirmed: true }, "admin:test");
    expect(j).toMatchObject({ state: "payment_review", paid_pence: 3000 });
    expect(db.tables.booking_journey_messages[0].kind).toBe("payment_review");
    await performAdminAction(db, ID, { operation: "resolve_payment", revision: j.revision, resolution: "confirm", reason: "Checked availability with customer", availabilityConfirmed: true }, "admin:test");
    expect(j.state).toBe("confirmed");
    expect(db.tables.bookings[0]).toMatchObject({ deposit_amount: 30, payment_status: "paid" });
  });
  it("reminds once, preserves price, and refuses expired offers", async () => {
    const db = offered(), j = db.tables.booking_journeys[0];
    await performAdminAction(db, ID, { operation: "remind", revision: 0 }, "admin:test");
    await expect(performAdminAction(db, ID, { operation: "remind", revision: j.revision }, "admin:test")).rejects.toThrow("No deposit reminder");
    expect(j.snapshot.totalPence).toBe(27900);
    expect(j.paid_pence).toBe(0);
    const expiredDb = offered({ hold_until: "2026-09-08T11:00:00Z" });
    expect(publicJourney(expiredDb.tables.bookings[0], expiredDb.tables.booking_journeys[0]).canPayDeposit).toBe(false);
  });
  it.each(["cancel", "reschedule"])("pauses payment for a %s request and keeps the paid ledger unchanged", async operation => {
    const db = offered({ checkout_id: "cs_open" }), j = db.tables.booking_journeys[0];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "open", payment_status: "unpaid" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "expired" }) });
    await performCustomerAction(db, signToken(j), { operation, revision: 0, confirm: true, date: "2026-10-11", time: "11:00–13:00" });
    expect(j.state).toBe("offered");
    expect(j.customer_request.kind).toBe(operation);
    expect(publicJourney(db.tables.bookings[0], j).canPayDeposit).toBe(false);
    expect(fetch.mock.calls[1][0]).toContain("/expire");
    expect(db.tables.booking_journey_payments).toHaveLength(0);
  });
  it("records a delayed payment against an old session for review without confirming", async () => {
    const db = offered({ checkout_id: "cs_new" });
    await recordJourneyPayment(db, paidSession("cs_old"));
    expect(db.tables.booking_journeys[0]).toMatchObject({ state: "payment_review", paid_pence: 3000 });
    expect(db.tables.booking_journey_messages[0].kind).toBe("payment_review");
  });
  it.each(["initial_customer", "initial_business"])("keeps %s an unpaid request, with no payment button", kind => {
    const db = memoryDb();
    const content = emailForMessage({ kind, name: "Test", reference: "TEST", journey: db.tables.booking_journeys[0] });
    expect(content.text).toContain("No payment is taken with your request");
    expect(content.html).not.toContain("Pay £30 deposit by card");
  });
});
