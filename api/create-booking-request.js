import { rejectUnsafePreview, isHostedPreview, previewTestInbox } from './_lib/previewIsolation.js';
import { randomBytes, createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { loadWebsitePricebook } from "./_lib/websitePricebook.js";
import { priceBookingRequest } from "../shared/requestPricing.js";
import { formatServiceDetail } from "./_lib/formatBookingItems.js";
import { emailWordmarkHtml } from "./_lib/emailBrand.js";

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
      "[booking-request] booking_ref collision on",
      bookingRef,
      "— retrying",
    );
  }

  return { data: null, error: lastError, bookingRef: baseRef };
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailRows(data) {
  return [
    ["Reference", data.bookingRef],
    ["Service", data.serviceDetail || data.service],
    ["Preferred date", data.date],
    ["Arrival window", data.time],
    ["Address", data.address],
    ["Postcode", data.postcode],
  ];
}

function detailText(data) {
  return detailRows(data)
    .map(([label, value]) => `${label}: ${value || "—"}`)
    .join("\n");
}

function customerText(data) {
  return [
    `Hi ${data.fullName},`,
    "",
    "We received your cleaning request. No payment has been taken.",
    "Your requested time is not confirmed yet. We will review availability, the final scope and price during opening hours and contact you.",
    "",
    detailText(data),
    "",
    "After we agree the time, scope and price, we send a £30 deposit request. Your appointment is confirmed when that deposit is paid; it comes off your total.",
    "",
    "VVE Clean",
    "020 8050 2233 · contact@vveclean.co.uk",
  ].join("\n");
}

function businessText(data) {
  return [
    `New booking request — ${data.bookingRef}`,
    "",
    `Customer: ${data.fullName}`,
    `Phone: ${data.phone}`,
    `Email: ${data.email}`,
    detailText(data),
    `Estimated total: £${data.totalPrice}`,
    `Notes: ${data.message || "—"}`,
    "",
    "Manager next step: check availability and the final scope, then contact the customer to agree the appointment. The initial request is free. Send the £30 deposit request only after agreeing the booking details.",
  ].join("\n");
}

function emailHtml(data, business = false) {
  const rows = (
    business
      ? [
          ["Customer", data.fullName],
          ["Phone", data.phone],
          ["Email", data.email],
          ...detailRows(data),
          ["Estimated total", `£${data.totalPrice}`],
          ["Notes", data.message || "—"],
        ]
      : detailRows(data)
  )
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-top:1px solid #e3e7ee;color:#667085;font-size:13px">${esc(label)}</td><td style="padding:8px 12px;border-top:1px solid #e3e7ee;color:#020b24;font-size:13px;font-weight:600">${esc(value || "—")}</td></tr>`,
    )
    .join("");

  const intro = business
    ? "Check availability and the final scope, then contact the customer to agree the appointment. The initial request is free. Send the £30 deposit request only after agreeing the booking details."
    : "No payment has been taken. Your requested time is not confirmed yet; we will review availability, the final scope and price during opening hours and contact you.";
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#020b24"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden"><tr><td style="background:#020b24;padding:24px 28px">${emailWordmarkHtml({ inverse: true })}</td></tr><tr><td style="padding:28px"><h1 style="font-size:22px;margin:0 0 12px">${business ? "New booking request" : "We received your request"}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(intro)}</p><table role="presentation" width="100%" cellspacing="0" style="border:1px solid #e3e7ee;border-radius:10px;border-collapse:separate;border-spacing:0">${rows}</table>${business ? "" : '<p style="font-size:14px;line-height:1.6;margin:18px 0 0">After we agree the time, scope and price, we send a £30 deposit request. Your appointment is confirmed when that deposit is paid; it comes off your total.</p>'}</td></tr></table></td></tr></table></body></html>`;
}

async function sendNotifications(data) {
  const preview = isHostedPreview();
  const testInbox = previewTestInbox();
  const result = {
    emailCustomerSent: false,
    emailBusinessSent: false,
    telegramSent: false,
  };
  if (
    process.env.GMAIL_SENDER &&
    process.env.GMAIL_APP_PASSWORD &&
    (preview ? testInbox : process.env.BUSINESS_EMAIL)
  ) {
    const transport = nodemailer.createTransport({
      service: "gmail",
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.GMAIL_SENDER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    const [business, customer] = await Promise.allSettled([
      transport.sendMail({
        from: `"VVE Clean Requests" <${process.env.GMAIL_SENDER}>`,
        to: preview ? testInbox : process.env.BUSINESS_EMAIL,
        replyTo: preview ? testInbox : `"${data.fullName}" <${data.email}>`,
        subject: `${preview ? '[TEST] ' : ''}New booking request — ${data.bookingRef}`,
        text: businessText(data),
        html: emailHtml(data, true),
      }),
      transport.sendMail({
        from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
        to: preview ? testInbox : data.email,
        replyTo: preview ? testInbox : process.env.BUSINESS_EMAIL,
        subject: `${preview ? '[TEST] ' : ''}Request received — ${data.bookingRef}`,
        text: customerText(data),
        html: emailHtml(data),
      }),
    ]);
    result.emailBusinessSent = business.status === "fulfilled";
    result.emailCustomerSent = customer.status === "fulfilled";
    if (business.status === "rejected")
      console.error(
        "[booking-request] business email failed:",
        business.reason?.message || business.reason,
      );
    if (customer.status === "rejected")
      console.error(
        "[booking-request] customer email failed:",
        customer.reason?.message || customer.reason,
      );
  }

  if (!preview && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `New booking request\n${data.bookingRef}\n${data.fullName} · ${data.phone}\n${data.service}\n${data.date} · ${data.time}\nEstimated total: £${data.totalPrice}\nFree initial request; deposit requested after agreement`,
          }),
        },
      );
      result.telegramSent = response.ok;
    } catch (error) {
      console.error("[booking-request] Telegram failed:", error.message);
    }
  }
  return result;
}

function errorResponse(res, headers, status, error) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" });
  return res.end(JSON.stringify({ error }));
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
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    gclid,
  } = payload;

  if (!quoteConfig)
    return errorResponse(res, headers, 400, "quoteConfig is required");
  if (!fullName || String(fullName).trim().length < 2)
    return errorResponse(res, headers, 400, "A full name is required");
  if (!phone || String(phone).replace(/\D/g, "").length < 10)
    return errorResponse(res, headers, 400, "A valid phone number is required");
  if (!email || !EMAIL_RE.test(String(email)))
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
  if (
    requestKey &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestKey,
    )
  )
    return errorResponse(res, headers, 400, "Invalid request identifier.");
  const fingerprint = requestFingerprint(payload);
  const findRetry = () => findSavedRequest(supabase, requestKey);
  const respondRetry = (existing) => {
    if (existing.request_fingerprint !== fingerprint)
      return errorResponse(
        res,
        headers,
        409,
        "This request changed. Please refresh the form before sending again.",
      );
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
    console.error("[booking-request] reference lookup failed:", error.message);
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
  const row = {
    booking_ref: bookingRef,
    ...(requestKey
      ? { request_key: requestKey, request_fingerprint: fingerprint }
      : {}),
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
    first_source:
      typeof first_source === "string" ? first_source.slice(0, 500) : null,
    last_source:
      typeof last_source === "string" ? last_source.slice(0, 500) : null,
    landing_page:
      typeof landing_page === "string" ? landing_page.slice(0, 500) : null,
    utm_source:
      typeof utm_source === "string" ? utm_source.slice(0, 500) : null,
    utm_medium:
      typeof utm_medium === "string" ? utm_medium.slice(0, 500) : null,
    utm_campaign:
      typeof utm_campaign === "string" ? utm_campaign.slice(0, 500) : null,
    utm_content:
      typeof utm_content === "string" ? utm_content.slice(0, 500) : null,
    gclid: typeof gclid === "string" ? gclid.slice(0, 500) : null,
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
    console.error("[booking-request] insert failed:", insertError?.message);
    return errorResponse(
      res,
      headers,
      503,
      "We could not save your request. Please try again.",
    );
  }
  bookingRef = persistedBookingRef;

  const notificationData = {
    bookingRef,
    service: String(service || ""),
    serviceDetail,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    postcode: row.postcode,
    date,
    time: row.preferred_time,
    message: row.notes,
    totalPrice: validatedPrice,
  };
  const delivery = await sendNotifications(notificationData);
  if (
    delivery.emailCustomerSent ||
    delivery.emailBusinessSent ||
    delivery.telegramSent
  ) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        email_customer_sent: delivery.emailCustomerSent,
        email_business_sent: delivery.emailBusinessSent,
        telegram_sent: delivery.telegramSent,
      })
      .eq("id", saved.id);
    if (updateError)
      console.error(
        "[booking-request] notification flags update failed:",
        updateError.message,
      );
  }

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
