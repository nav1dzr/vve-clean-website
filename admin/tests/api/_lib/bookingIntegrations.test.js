import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { calendarEvent, ownerBookingText, sendBookingTelegram, syncBookingCalendar } from "../../../api/_lib/bookingIntegrations.js";

const booking = { full_name: "Synthetic Customer", booking_ref: "E11AA251026", phone: "EXAMPLE ONLY" };
const snapshot = { service: "Carpet cleaning", items: "Two bedrooms", date: "2026-10-25", time: "09:00–11:00", address: "Synthetic address", postcode: "E1 1AA", totalPence: 10000 };
const journey = { booking_id: "22222222-2222-4222-8222-222222222222", revision: 2, state: "confirmed", paid_pence: 3000, refunded_pence: 0, snapshot };
const payload = { kind: "confirmation", name: booking.full_name, reference: booking.booking_ref, journey, payment: { method: "bank_transfer" } };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("independent owner and calendar notifications", () => {
  it("distinguishes a received deposit from an enquiry without exposing the private customer link", () => {
    const text = ownerBookingText(payload);
    expect(text).toContain("DEPOSIT PAID — BOOKING CONFIRMED");
    expect(text).toContain("bank transfer");
    expect(text).toContain("£70.00");
    expect(text).not.toContain("token=");
  });
  it("routes tests only to the test Telegram chat", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "synthetic-secret");
    vi.stubEnv("TELEGRAM_CHAT_ID", "live-chat");
    vi.stubEnv("BOOKING_JOURNEY_TEST_TELEGRAM_CHAT_ID", "test-chat");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    await sendBookingTelegram(payload, { test: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe("test-chat");
    expect(body.text).toContain("[TEST]");
    expect(body.parse_mode).toBeUndefined();
  });
  it("does not fall back to the live Telegram destination or expose tokens on failure", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "synthetic-secret");
    vi.stubEnv("TELEGRAM_CHAT_ID", "live-chat");
    vi.stubEnv("BOOKING_JOURNEY_TEST_TELEGRAM_CHAT_ID", "");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("https://api.telegram.org/botsynthetic-secret")));
    await expect(sendBookingTelegram(payload, { test: true })).rejects.toThrow("Test Telegram destination");
    expect(fetch).not.toHaveBeenCalled();
    await expect(sendBookingTelegram(payload)).rejects.toThrow("Telegram could not be reached");
  });
  it("uses a stable private calendar event, London time and the accepted appointment during changes", () => {
    expect(calendarEvent(booking, { ...journey, state: "offered" })).toBeNull();
    const event = calendarEvent(booking, journey);
    expect(event.start).toEqual({ dateTime: "2026-10-25T09:00:00", timeZone: "Europe/London" });
    expect(event.id).toMatch(/^[0-9a-v]+$/);
    expect(event.visibility).toBe("private");
    expect(event.attendees).toBeUndefined();
    expect(event.description).toContain("not the full cleaning duration");
    expect(calendarEvent(booking, { ...journey, state: "change_pending", previous_snapshot: snapshot, snapshot: { ...snapshot, date: "2026-10-26" } }).start).toEqual(event.start);
    expect(calendarEvent(booking, { ...journey, state: "cancelled" })).toMatchObject({ id: event.id, status: "cancelled" });
  });
  it("requires a separate calendar for tests", async () => {
    vi.stubEnv("BOOKING_CALENDAR_ID", "live-calendar");
    vi.stubEnv("BOOKING_CALENDAR_TEST_ID", "live-calendar");
    vi.stubGlobal("fetch", vi.fn());
    await expect(syncBookingCalendar(booking, journey, { test: true })).rejects.toThrow("separate test calendar");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("updates its existing event using its revision and ETag, without inviting the customer", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("BOOKING_CALENDAR_SERVICE_ACCOUNT_EMAIL", "test@example.invalid");
    vi.stubEnv("BOOKING_CALENDAR_PRIVATE_KEY", privateKey.export({ type: "pkcs8", format: "pem" }));
    vi.stubEnv("BOOKING_CALENDAR_ID", "separate-calendar");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "synthetic-token" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ etag: '"v1"', extendedProperties: { private: { vveBookingId: journey.booking_id, vveRevision: "1" } } }) })
      .mockResolvedValueOnce({ ok: true }));
    await syncBookingCalendar(booking, journey);
    expect(fetch.mock.calls[2][0]).toContain("sendUpdates=none");
    expect(fetch.mock.calls[2][1]).toMatchObject({ method: "PUT", headers: { "If-Match": '"v1"' } });
  });
});
