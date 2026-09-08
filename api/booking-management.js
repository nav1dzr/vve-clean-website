import { rejectUnsafePreview } from './_lib/previewIsolation.js';
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import {
  requireJourneyEnabled,
  loadPrivateJourney,
  publicJourney,
  performCustomerAction,
  JourneyError,
} from "../admin/api/_lib/bookingJourney.js";

import { processDueBookingJourneys } from "./_lib/bookingJourneyWorker.js";
export const config = { api: { bodyParser: false } };
async function readBody(req) {
  if (req.body) {
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 16384)
      throw new JourneyError("Request too large.", 413);
    return JSON.parse(raw);
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 16384)
      throw new JourneyError("Request too large.", 413);
  }
  return raw ? JSON.parse(raw) : {};
}
function authorisedWorker(req) {
  const expected = process.env.BOOKING_JOURNEY_WORKER_SECRET || "";
  const actual = String(req.headers.authorization || "").replace(
    /^Bearer /,
    "",
  );
  return (
    expected.length >= 32 &&
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
export default async function handler(req, res) {
  if (rejectUnsafePreview(res)) return;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, private",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
  };
  function send(status, body) {
    res.writeHead(status, headers);
    return res.end(JSON.stringify(body));
  }
  if (!["GET", "POST"].includes(req.method))
    return send(405, { error: "Method not allowed" });
  try {
    requireJourneyEnabled();
    const url = process.env.VITE_SUPABASE_URL,
      key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new JourneyError(
        "Booking management is temporarily unavailable.",
        503,
      );
    const db = createClient(url, key, { auth: { persistSession: false } });
    if (
      req.method === "POST" &&
      new URL(req.url, "https://x").searchParams.get("action") === "process-due"
    ) {
      if (!authorisedWorker(req)) return send(401, { error: "Unauthorised" });
      return send(200, await processDueBookingJourneys(db));
    }
    // Private bearer token is in the request header, never a URL query. It is
    // deliberately independent of cookies, so cross-origin forms cannot act.
    if (
      req.method === "POST" &&
      !String(req.headers["content-type"] || "").startsWith("application/json")
    )
      return send(415, { error: "JSON required" });
    const token = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    if (req.method === "GET") {
      const { booking, journey } = await loadPrivateJourney(db, token);
      return send(200, { booking: publicJourney(booking, journey) });
    }
    const body = await readBody(req);
    return send(200, await performCustomerAction(db, token, body));
  } catch (error) {
    return send(
      error instanceof JourneyError
        ? error.status
        : error instanceof SyntaxError
          ? 400
          : 503,
      {
        error:
          error instanceof JourneyError
            ? error.message
            : error instanceof SyntaxError
              ? "Invalid request body."
              : "Booking management is temporarily unavailable. Please contact the team.",
      },
    );
  }
}
