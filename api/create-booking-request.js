import { rejectUnsafePreview, isHostedPreview } from './_lib/previewIsolation.js';
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadWebsitePricebook } from "./_lib/websitePricebook.js";
import { priceBookingRequest } from "../shared/requestPricing.js";
import { formatServiceDetail } from "./_lib/formatBookingItems.js";
import {
  deliverBookingRequestNotifications,
  safeOperationalCode,
} from "./_lib/bookingRequestNotifications.js";

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 64 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PARKING = ["yes", "no", "not_sure"];
const VALID_CONGESTION = ["yes", "no", "not_sure"];
const MAX_REF_COLLISION_RETRIES = 5;
const ALLOWED_ORIGINS = [
  process.env.SITE_URL,
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

function cleanCampaignValue(value, max = 200) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return cleaned || null;
}
function cleanClickId(value) {
  const cleaned = cleanCampaignValue(value, 200);
  return cleaned && /^[A-Za-z0-9._~-]+$/.test(cleaned) ? cleaned : null;
}
function cleanLandingPath(value) {
  const cleaned = cleanCampaignValue(value, 500);
  return cleaned && /^\/(?!\/)[^?#]*$/.test(cleaned) ? cleaned : null;
}
function validIsoTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) &&
    parsed <= Date.now() + 60000 &&
    new Date(parsed).toISOString() === value
    ? value
    : null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function measurementEmailHash(value) {
  const compact = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const parts = compact.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [local, domain] = parts;
  const normalizedLocal = ["gmail.com", "googlemail.com"].includes(domain)
    ? local.split("+")[0].replace(/\./g, "")
    : local;
  const normalized = `${normalizedLocal}@${domain}`;
  return EMAIL_RE.test(normalized) ? sha256(normalized) : null;
}

function measurementPhoneHash(value) {
  let normalized = String(value || "").trim().replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  else if (/^0\d+$/.test(normalized)) normalized = `+44${normalized.slice(1)}`;
  else if (/^44\d+$/.test(normalized)) normalized = `+${normalized}`;
  if (normalized.startsWith("+440")) normalized = `+44${normalized.slice(4)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  return sha256(normalized);
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy(new Error("Request body too large"));
        reject(new Error("Request body too large"));
        return;
      }
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function isoToDDMMYY(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[3]}${match[2]}${match[1].slice(2)}`;
}

async function buildBookingRef(postcode, date, supabase) {
  const postcodeKey = String(postcode || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const dateKey = isoToDDMMYY(date);
  if (!postcodeKey || !dateKey) return null;
  const base = `${postcodeKey}${dateKey}`;
  const { data, error } = await supabase
    .from("bookings")
    .select("booking_ref")
    .like("booking_ref", `${base}%`);
  if (error) throw error;

  const existing = new Set((data || []).map((row) => row.booking_ref));
  if (!existing.has(base)) return base;
  let suffix = 1;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function findSavedRequest(supabase, requestKey) {
  if (!requestKey) return null;
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_ref, request_fingerprint, total_price")
    .eq("request_key", requestKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function requestFingerprint(payload) {
  // Only the customer's submitted agreement enters this hash. A published
  // pricebook, promotion rule or JSON property order can change between retries.
  const {
    service,
    quoteConfig,
    fullName,
    address,
    postcode,
    phone,
    email,
    date,
    time,
    message,
    offer_code,
    price,
    pricebookVersion,
  } = payload;
  const canonical = JSON.stringify(
    {
      service,
      quoteConfig,
      fullName,
      address,
      postcode,
      phone,
      email,
      date,
      time,
      message,
      offer_code,
      price,
      pricebookVersion,
    },
    (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

async function insertBookingWithRefRetry(
  supabase,
  row,
  maxRetries = MAX_REF_COLLISION_RETRIES,
) {
  const baseRef = row.booking_ref;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const bookingRef = attempt === 0 ? baseRef : `${baseRef}-${attempt}`;
    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...row, booking_ref: bookingRef })
      .select("id")
      .single();

    if (!error && data?.id) return { data, error: null, bookingRef };
    lastError = error || new Error("Booking insert returned no id");
    if (error?.code !== "23505") break;
    // A concurrent copy of this same request may have committed after our
    // first lookup. Resolve it before retrying what could be a reference clash.
    if (row.request_key) {
      try {
        const replay = await findSavedRequest(supabase, row.request_key);
        if (replay) return { replay, error: null };
      } catch (lookupError) {
        return { data: null, error: lookupError, bookingRef: baseRef };
      }
    }
    console.warn(
      "[booking-request] booking reference collision; retrying",
      safeOperationalCode(error, "unique_constraint"),
    );
  }

  return { data: null, error: lastError, bookingRef: baseRef };
}

function errorResponse(res, headers, status, error) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" });
  return res.end(JSON.stringify({ error }));
}

async function attemptNotificationDelivery(supabase, bookingId) {
  try {
    await deliverBookingRequestNotifications(supabase, {
      bookingId,
      limit: 3,
    });
  } catch (error) {
    console.error(
      "[booking-request] notification delivery deferred",
      safeOperationalCode(error, "notification_delivery_deferred"),
    );
  }
}

export default async function handler(req, res) {
  if (rejectUnsafePreview(res)) return;
  const headers = corsHeaders(req.headers.origin || "");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }
  if (req.method !== "POST")
    return errorResponse(res, headers, 405, "Method not allowed");

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return errorResponse(res, headers, 400, "Invalid request body.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return errorResponse(res, headers, 400, "Invalid request body.");
  if (payload._honeypot) {
    res.writeHead(200, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, bookingRef: null }));
  }

  const {
    service,
    quoteConfig,
    fullName,
    address,
    postcode,
    phone,
    email,
    date,
    time,
    message,
    requestKey,
    offer_code,
    pricebookVersion,
    first_source,
    last_source,
    landing_page,
    first_touch_at,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    gclid,
    gbraid,
    wbraid,
    measurement_consent,
  } = payload;

  if (!quoteConfig)
    return errorResponse(res, headers, 400, "quoteConfig is required");
  if (!fullName || String(fullName).trim().length < 2)
    return errorResponse(res, headers, 400, "A full name is required");
  if (!phone || String(phone).replace(/\D/g, "").length < 10)
    return errorResponse(res, headers, 400, "A valid phone number is required");
  if (!email || !EMAIL_RE.test(String(email).trim()))
    return errorResponse(
      res,
      headers,
      400,
      "A valid email address is required",
    );
  if (
    typeof address !== "string" ||
    typeof postcode !== "string" ||
    !address.trim() ||
    !/^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i.test(postcode.trim())
  )
    return errorResponse(
      res,
      headers,
      400,
      "Address and postcode are required",
    );
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return errorResponse(res, headers, 400, "A preferred date is required");
  if (
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return errorResponse(res, headers, 400, "Choose a valid date.");
  if (!time)
    return errorResponse(
      res,
      headers,
      400,
      "A preferred arrival window is required",
    );
  if (!VALID_PARKING.includes(quoteConfig.parkingAvailable))
    return errorResponse(
      res,
      headers,
      400,
      "Please answer the parking question",
    );
  if (!VALID_CONGESTION.includes(quoteConfig.congestionZone))
    return errorResponse(
      res,
      headers,
      400,
      "Please answer the Congestion Charge question",
    );
  if (message && String(message).length > 500)
    return errorResponse(
      res,
      headers,
      400,
      "Your message is too long. Please keep it under 500 characters.",
    );
  // Every accepted request needs a durable idempotency key. The website
  // creates this before sending so retries and database measurement use the
  // same identity rather than creating another lead.
  if (
    !requestKey ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestKey,
    )
  )
    return errorResponse(res, headers, 400, "Invalid request identifier. Please refresh and try again.");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[booking-request] Supabase configuration missing");
    return errorResponse(
      res,
      headers,
      503,
      "Booking requests are temporarily unavailable. Please contact us on WhatsApp.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const fingerprint = requestFingerprint(payload);
  const findRetry = () => findSavedRequest(supabase, requestKey);
  const respondRetry = async (existing) => {
    if (existing.request_fingerprint !== fingerprint)
      return errorResponse(
        res,
        headers,
        409,
        "This request changed. Please refresh the form before sending again.",
      );
    await attemptNotificationDelivery(supabase, existing.id);
    res.writeHead(200, { ...headers, "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        bookingRef: existing.booking_ref,
        requestId: existing.id,
        total: Number(existing.total_price),
        replayed: true,
      }),
    );
  };
  try {
    const existing = await findRetry();
    if (existing) return respondRetry(existing);
  } catch {
    return errorResponse(
      res,
      headers,
      503,
      "We could not save your request. Please try again.",
    );
  }

  // A saved request remains replayable even after its preferred date or the
  // current pricebook changes. New requests still pass both checks below.
  if (
    date <
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
      new Date(),
    )
  )
    return errorResponse(
      res,
      headers,
      400,
      "The preferred date has already passed",
    );
  let pricebook;
  try {
    pricebook = await loadWebsitePricebook();
  } catch {
    return errorResponse(
      res,
      headers,
      503,
      "Website prices are temporarily unavailable. Please try again or contact us.",
    );
  }
  const priced = priceBookingRequest(
    quoteConfig,
    offer_code,
    pricebook.catalogue,
  );
  const validatedPrice = priced?.total ?? null;
  if (validatedPrice === null)
    return errorResponse(res, headers, 400, "Invalid service configuration");
  if (
    process.env.WEBSITE_PRICEBOOK_ENABLED === "true" &&
    (pricebookVersion !== pricebook.version ||
      (Number.isFinite(payload.price) &&
        Math.abs(payload.price - validatedPrice) > 0.01))
  ) {
    res.writeHead(409, { ...headers, "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        error:
          "Prices have changed since this estimate. Please refresh and review your quote before sending.",
        code: "price_changed",
        currentTotal: validatedPrice,
      }),
    );
  }
  priced.quoteConfig.pricebookVersion = pricebook.version;

  let bookingRef;
  try {
    bookingRef = await buildBookingRef(postcode, date, supabase);
  } catch (error) {
    console.error(
      "[booking-request] reference lookup failed",
      safeOperationalCode(error, "reference_lookup_failed"),
    );
    return errorResponse(
      res,
      headers,
      503,
      "We could not save your request. Please try again.",
    );
  }
  if (!bookingRef)
    return errorResponse(
      res,
      headers,
      400,
      "A valid postcode and preferred date are required",
    );

  const serviceDetail = formatServiceDetail(quoteConfig, service);
  const consentRecordedAt = validIsoTimestamp(measurement_consent?.recorded_at);
  const hasMeasurementConsent =
    measurement_consent?.advertising === true &&
    measurement_consent?.version === "2026-07-14" &&
    consentRecordedAt !== null;
  const row = {
    booking_ref: bookingRef,
    request_key: requestKey,
    request_fingerprint: fingerprint,
    confirmation_token: randomBytes(32).toString("hex"),
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    // The existing database enum uses `pending_payment` for every unpaid row.
    // deposit_amount=0 is the deliberate marker used by VVE Manager to show
    // this as a request awaiting availability, not as an abandoned checkout.
    payment_status: "pending_payment",
    deposit_amount: 0,
    total_price: validatedPrice,
    quote_config: priced.quoteConfig,
    status: "new",
    balance_status: "not_due",
    full_name: String(fullName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    postcode: String(postcode).trim().toUpperCase(),
    service: serviceDetail || String(service || "").slice(0, 500),
    preferred_date: date,
    preferred_time: String(time).slice(0, 100),
    notes:
      String(message || "")
        .trim()
        .slice(0, 500) || null,
    offer_code: priced.offer_code,
    discount_percent: priced.discount_percent,
    standard_total: priced.standard_total,
    discount_amount: priced.discount_amount,
    final_total_after_discount: priced.final_total_after_discount,
    first_source: hasMeasurementConsent ? cleanCampaignValue(first_source) : null,
    last_source: hasMeasurementConsent ? cleanCampaignValue(last_source) : null,
    landing_page: hasMeasurementConsent ? cleanLandingPath(landing_page) : null,
    attribution_first_touch_at: hasMeasurementConsent ? validIsoTimestamp(first_touch_at) : null,
    utm_source: hasMeasurementConsent ? cleanCampaignValue(utm_source) : null,
    utm_medium: hasMeasurementConsent ? cleanCampaignValue(utm_medium) : null,
    utm_campaign: hasMeasurementConsent ? cleanCampaignValue(utm_campaign) : null,
    utm_content: hasMeasurementConsent ? cleanCampaignValue(utm_content) : null,
    utm_term: hasMeasurementConsent ? cleanCampaignValue(utm_term) : null,
    gclid: hasMeasurementConsent ? cleanClickId(gclid) : null,
    gbraid: hasMeasurementConsent ? cleanClickId(gbraid) : null,
    wbraid: hasMeasurementConsent ? cleanClickId(wbraid) : null,
    measurement_advertising_consent: hasMeasurementConsent,
    measurement_consent_version: measurement_consent?.version === "2026-07-14" ? measurement_consent.version : null,
    measurement_consent_recorded_at: consentRecordedAt,
    measurement_email_sha256: hasMeasurementConsent ? measurementEmailHash(email) : null,
    measurement_phone_sha256: hasMeasurementConsent ? measurementPhoneHash(phone) : null,
    measurement_is_test: isHostedPreview(),
  };

  const {
    data: saved,
    error: insertError,
    bookingRef: persistedBookingRef,
    replay,
  } = await insertBookingWithRefRetry(supabase, row);
  if (replay) return respondRetry(replay);
  if (insertError || !saved?.id) {
    try {
      const existing = await findRetry();
      if (existing) return respondRetry(existing);
    } catch {
      /* Report a retryable save failure below. */
    }
    console.error(
      "[booking-request] insert failed",
      safeOperationalCode(insertError, "booking_insert_failed"),
    );
    return errorResponse(
      res,
      headers,
      503,
      "We could not save your request. Please try again.",
    );
  }
  bookingRef = persistedBookingRef;

  await attemptNotificationDelivery(supabase, saved.id);

  res.writeHead(201, { ...headers, "Content-Type": "application/json" });
  return res.end(
    JSON.stringify({
      ok: true,
      bookingRef,
      requestId: saved.id,
      total: validatedPrice,
    }),
  );
}
