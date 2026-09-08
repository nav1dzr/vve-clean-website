import { describe, it, expect, vi } from "vitest";
import { processDueBookingJourneys } from "../../api/_lib/bookingJourneyWorker.js";

function workerDb(journeys, messages = []) {
  const db = {
    from(table) {
      let filters = [],
        limit = Infinity,
        sort = "";
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push((r) =>
            k.includes("->>")
              ? r[k.split("->>")[0]]?.[k.split("->>")[1]] === v
              : r[k] === v,
          );
          return q;
        },
        is(k, v) {
          filters.push((r) => r[k] === v);
          return q;
        },
        gt(k, v) {
          filters.push((r) => r[k] > v);
          return q;
        },
        lte(k, v) {
          filters.push((r) => r[k] <= v);
          return q;
        },
        order(k) {
          sort = k;
          return q;
        },
        limit(n) {
          limit = n;
          return q;
        },
        or(expression) {
          expect(expression).toContain("status.eq.sending");
          expect(expression).toContain("claimed_at.lte.");
          filters.push(
            (r) =>
              (["pending", "failed"].includes(r.status) && r.attempts < 5) ||
              (r.status === "sending" &&
                r.claimed_at <= "2026-09-08T11:50:00.000Z"),
          );
          return q;
        },
        then(resolve, reject) {
          const rows = (table === "booking_journeys" ? journeys : messages)
            .filter((r) => filters.every((f) => f(r)))
            .sort((a, b) => String(a[sort]).localeCompare(String(b[sort])))
            .slice(0, limit);
          return Promise.resolve({ data: rows, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return q;
    },
  };
  return db;
}
describe("bounded booking worker", () => {
  it("selects tomorrow in London and uses the existing appointment during a pending change", async () => {
    const rows = [
      {
        booking_id: "confirmed",
        revision: 1,
        state: "confirmed",
        snapshot: { date: "2026-09-10" },
        appointment_reminder_sent_at: null,
      },
      {
        booking_id: "pending-old",
        revision: 2,
        state: "change_pending",
        snapshot: { date: "2026-09-12" },
        previous_snapshot: { date: "2026-09-10" },
        appointment_reminder_sent_at: null,
      },
      {
        booking_id: "proposed-only",
        revision: 2,
        state: "change_pending",
        snapshot: { date: "2026-09-10" },
        previous_snapshot: { date: "2026-09-12" },
        appointment_reminder_sent_at: null,
      },
      {
        booking_id: "cancelled",
        revision: 1,
        state: "cancelled",
        snapshot: { date: "2026-09-10" },
        appointment_reminder_sent_at: null,
      },
    ];
    const perform = vi.fn();
    await processDueBookingJourneys(workerDb(rows), {
      perform,
      deliver: vi.fn(),
      now: new Date("2026-09-08T23:30:00Z"),
    });
    expect(perform.mock.calls.map((c) => c[1]).sort()).toEqual([
      "confirmed",
      "pending-old",
    ]);
    expect(
      perform.mock.calls.every(
        (c) => c[2].operation === "appointment_reminder",
      ),
    ).toBe(true);
  });
  it("advances through more than ten eligible reminders instead of selecting reminded rows forever", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      booking_id: `b${i}`,
      revision: 0,
      offer_version: 1,
      state: "offered",
      hold_until: "2026-09-09T10:00:00.000Z",
      reminder_sent_at: null,
    }));
    const db = workerDb(rows);
    const perform = vi.fn(async (_db, id, action) => {
      expect(action.operation).toBe("remind");
      rows.find((r) => r.booking_id === id).reminder_sent_at =
        "2026-09-08T12:00:00.000Z";
    });
    const deliver = vi.fn();
    for (let i = 0; i < 3; i++)
      await processDueBookingJourneys(db, {
        perform,
        deliver,
        now: new Date("2026-09-08T12:00:00Z"),
      });
    expect(perform).toHaveBeenCalledTimes(25);
    expect(new Set(perform.mock.calls.map((c) => c[1])).size).toBe(25);
  });
  it("recovers a stale sending claim while leaving an active send and exhausted failure alone", async () => {
    const messages = [
      {
        id: "stale",
        booking_id: "b1",
        status: "sending",
        attempts: 5,
        claimed_at: "2026-09-08T11:00:00.000Z",
        created_at: "2026-09-08T10:00:00Z",
      },
      {
        id: "active",
        booking_id: "b2",
        status: "sending",
        attempts: 1,
        claimed_at: "2026-09-08T11:59:00.000Z",
        created_at: "2026-09-08T10:00:00Z",
      },
      {
        id: "exhausted",
        booking_id: "b3",
        status: "failed",
        attempts: 5,
        created_at: "2026-09-08T10:00:00Z",
      },
    ];
    const deliver = vi.fn();
    await processDueBookingJourneys(workerDb([], messages), {
      perform: vi.fn(),
      deliver,
      now: new Date("2026-09-08T12:00:00Z"),
    });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0].slice(1)).toEqual(["b1", "stale"]);
  });
});
