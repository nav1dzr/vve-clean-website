import { createSign } from "node:crypto";

const money = (p) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
export function ownerBookingTitle(payload) {
  if (payload.kind === "confirmation") return payload.journey.paid_pence > 0
    ? "DEPOSIT PAID — BOOKING CONFIRMED" : "BOOKING CONFIRMED";
  return ({ revised_confirmation: "BOOKING TIME UPDATED", receipt: "BOOKING PAYMENT RECEIVED",
    reschedule_received: "RESCHEDULE REQUEST — ACTION NEEDED", cancellation_requested: "CANCELLATION REQUEST — ACTION NEEDED",
    cancelled: "BOOKING CANCELLED", payment_review: "PAYMENT RECEIVED — REVIEW NEEDED" })[payload.kind] || "BOOKING UPDATE";
}
export function ownerBookingText(payload) {
  const j = payload.journey, s = j.snapshot || j.draft;
  return [ownerBookingTitle(payload), `Reference: ${payload.reference}`, `Customer: ${payload.name}`,
    `Service: ${s.service}`, `Appointment: ${s.date} · ${s.time} (London time)`,
    `Address: ${s.address}, ${s.postcode}`, `Agreed total: ${money(s.totalPence)}`,
    `Paid: ${money(j.paid_pence)}`, `Remaining: ${money(Math.max(0, s.totalPence - j.paid_pence + j.refunded_pence))}`,
    payload.payment?.method ? `Payment method: ${payload.payment.method.replaceAll("_", " ")}` : "",
    j.customer_request ? `Customer request: ${j.customer_request.kind} ${j.customer_request.date || ""} ${j.customer_request.time || ""}\n${j.customer_request.reason || ""}` : "",
    `CRM: https://admin.vveclean.co.uk/bookings/${j.booking_id}`].filter(Boolean).join("\n");
}
export async function sendBookingTelegram(payload, { test = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = test ? process.env.BOOKING_JOURNEY_TEST_TELEGRAM_CHAT_ID : process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error(test ? "Test Telegram destination is not configured." : "Booking Telegram notifications are not configured.");
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: `${test ? "[TEST] " : ""}${ownerBookingText(payload)}`.slice(0, 4000), link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw new Error("Telegram could not be reached. Check delivery before retrying."); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(`Telegram delivery failed (${response.status}).`);
}

export function calendarEvent(booking, journey) {
  const s = journey.state === "change_pending" ? journey.previous_snapshot : journey.snapshot;
  if (!s || !["confirmed", "change_pending", "completed", "cancelled"].includes(journey.state)) return null;
  const [start, end] = s.time.split(/\s*[-–]\s*/);
  return {
    id: `vve${journey.booking_id.replaceAll("-", "")}`,
    status: journey.state === "cancelled" ? "cancelled" : "confirmed",
    summary: `VVE Clean · ${booking.full_name} · ${s.service}`,
    location: `${s.address}, ${s.postcode}`,
    description: [`Reference: ${booking.booking_ref}`, `Arrival window: ${s.time} (London time). This is not the full cleaning duration.`,
      s.items, `Contact: ${booking.phone || ""}`, `Agreed total: ${money(s.totalPence)}`,
      `Paid: ${money(journey.paid_pence)}`, `Remaining: ${money(Math.max(0, s.totalPence - journey.paid_pence + journey.refunded_pence))}`,
      `CRM: https://admin.vveclean.co.uk/bookings/${journey.booking_id}`].join("\n"),
    start: { dateTime: `${s.date}T${start}:00`, timeZone: "Europe/London" },
    end: { dateTime: `${s.date}T${end}:00`, timeZone: "Europe/London" },
    visibility: "private", extendedProperties: { private: { vveBookingId: journey.booking_id, vveRevision: String(journey.revision) } },
  };
}
async function calendarToken() {
  const email = process.env.BOOKING_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.BOOKING_CALENDAR_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!email || !key) throw new Error("Google Calendar service connection is not configured.");
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: email, scope: "https://www.googleapis.com/auth/calendar.events", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  let signature;
  try { signature = createSign("RSA-SHA256").update(unsigned).sign(key, "base64url"); }
  catch { throw new Error("Google Calendar signing key is invalid."); }
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Google Calendar authentication failed.");
  return data.access_token;
}
export async function syncBookingCalendar(booking, journey, { test = false } = {}) {
  const event = calendarEvent(booking, journey);
  if (!event) return;
  const calendar = test ? process.env.BOOKING_CALENDAR_TEST_ID : process.env.BOOKING_CALENDAR_ID;
  if (!calendar || (test && calendar === process.env.BOOKING_CALENDAR_ID)) throw new Error(test ? "A separate test calendar is required." : "VVE Clean calendar is not connected.");
  const token = await calendarToken();
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const existing = await fetch(`${base}/${event.id}`, { headers, signal: AbortSignal.timeout(12000) });
  if (![200, 404, 410].includes(existing.status)) throw new Error(`Calendar lookup failed (${existing.status}).`);
  const prior = existing.ok ? await existing.json() : null;
  if (prior && prior.extendedProperties?.private?.vveBookingId !== journey.booking_id) throw new Error("Calendar event ownership could not be verified.");
  if (prior && Number(prior.extendedProperties?.private?.vveRevision) > journey.revision) return;
  if (!prior && event.status === "cancelled") return;
  const response = await fetch(`${base}${prior ? `/${event.id}` : ""}?sendUpdates=none`, {
    method: prior ? "PUT" : "POST", headers: { ...headers, ...(prior?.etag ? { "If-Match": prior.etag } : {}) },
    body: JSON.stringify(event), signal: AbortSignal.timeout(12000),
  });
  // Conflicts retry through the outbox and re-read the current booking and event.
  if (!response.ok) throw new Error(`Calendar update failed (${response.status}); retry will check the latest booking.`);
}
