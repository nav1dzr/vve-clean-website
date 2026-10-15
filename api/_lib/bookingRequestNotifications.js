import nodemailer from "nodemailer";
import { emailWordmarkHtml } from "./emailBrand.js";
import {
  isHostedPreview,
  previewTestInbox,
} from "./previewIsolation.js";

const CHANNELS = new Set(["business_email", "customer_email", "telegram"]);

export function safeOperationalCode(error, fallback = "operation_failed") {
  const candidate = error?.code;
  return typeof candidate === "string" &&
    /^[A-Za-z0-9_.:-]{1,80}$/.test(candidate)
    ? candidate
    : fallback;
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
    ["Service", data.service],
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
    "We received your cleaning request.",
    "No payment is required to submit a booking request. After we review and confirm the job details, we’ll email your deposit payment instructions. Your booking is confirmed once the deposit is paid.",
    "",
    detailText(data),
    "",
    "Nothing has been charged with this request.",
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
    "Manager next step: agree the scope, final price and time with the customer, then send the booking details and £30 deposit request from the CRM.",
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
    ? "Agree the scope, final price and time with the customer, then send the booking details and £30 deposit request from the CRM. This request is not a confirmed appointment."
    : "No payment is required to submit a booking request. After we review and confirm the job details, we’ll email your deposit payment instructions. Your booking is confirmed once the deposit is paid.";
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#020b24"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden"><tr><td style="background:#020b24;padding:24px 28px">${emailWordmarkHtml({ inverse: true })}</td></tr><tr><td style="padding:28px"><h1 style="font-size:22px;margin:0 0 12px">${business ? "New booking request" : "We received your request"}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(intro)}</p><table role="presentation" width="100%" cellspacing="0" style="border:1px solid #e3e7ee;border-radius:10px;border-collapse:separate;border-spacing:0">${rows}</table>${business ? "" : '<p style="font-size:14px;line-height:1.6;margin:18px 0 0">Nothing has been charged with this request.</p>'}</td></tr></table></td></tr></table></body></html>`;
}

function makeTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.GMAIL_SENDER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function failedDeliveryStatus(error) {
  const code = safeOperationalCode(error, "");
  if (
    code === "telegram_rejected" ||
    code.startsWith("telegram_http_") ||
    ["EAUTH", "ECONNECTION", "EDNS", "EENVELOPE"].includes(code) ||
    (Number.isInteger(error?.responseCode) && error.responseCode >= 400)
  ) return "failed";
  // A timeout, socket break or unknown exception can occur after a provider
  // accepted the message. Hold it for a destination check instead of risking
  // an automatic duplicate.
  return "uncertain";
}

function notificationJob(claim, transport, preview, testInbox) {
  const data = claim.booking;
  const emailReady = Boolean(
    process.env.GMAIL_SENDER &&
      process.env.GMAIL_APP_PASSWORD &&
      (preview ? testInbox : process.env.BUSINESS_EMAIL),
  );
  if (claim.channel === "business_email") {
    return {
      ready: emailReady,
      send: () =>
        transport.sendMail({
          from: `"VVE Clean Requests" <${process.env.GMAIL_SENDER}>`,
          to: preview ? testInbox : process.env.BUSINESS_EMAIL,
          replyTo: preview ? testInbox : `"${data.fullName}" <${data.email}>`,
          messageId: `<booking-request-${claim.outbox_id}@vveclean.co.uk>`,
          subject: `${preview ? "[TEST] " : ""}New booking request — ${data.bookingRef}`,
          text: businessText(data),
          html: emailHtml(data, true),
        }),
    };
  }
  if (claim.channel === "customer_email") {
    return {
      ready: emailReady,
      send: () =>
        transport.sendMail({
          from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
          to: preview ? testInbox : data.email,
          replyTo: preview ? testInbox : "contact@vveclean.co.uk",
          messageId: `<booking-request-${claim.outbox_id}@vveclean.co.uk>`,
          subject: `${preview ? "[TEST] " : ""}Request received — ${data.bookingRef}`,
          text: customerText(data),
          html: emailHtml(data),
        }),
    };
  }
  if (claim.channel === "telegram") {
    const ready = Boolean(
      !preview &&
        process.env.TELEGRAM_BOT_TOKEN &&
        process.env.TELEGRAM_CHAT_ID,
    );
    return {
      ready,
      send: async () => {
        const response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: `New booking request\n${data.bookingRef}\n${data.fullName} · ${data.phone}\n${data.service}\n${data.date} · ${data.time}\nEstimated total: £${data.totalPrice}\nNo payment was taken. Review and agree the job details, then email the deposit instructions. The booking is confirmed once the deposit is paid.`,
            }),
          },
        );
        const provider = await response.json().catch(() => null);
        if (!response.ok || provider?.ok !== true) {
          const error = new Error("Telegram rejected the notification");
          error.code = response.ok
            ? "telegram_rejected"
            : `telegram_http_${response.status}`;
          throw error;
        }
      },
    };
  }
  return { ready: false, send: null };
}

async function recordResult(supabase, claim, status, errorCode = null) {
  const { data, error } = await supabase.rpc(
    "record_booking_request_notification",
    {
      p_id: claim.outbox_id,
      p_token: claim.claim_token,
      p_status: status,
      p_error_code: errorCode,
    },
  );
  if (error || data !== true) {
    const checkpointError = new Error("Notification checkpoint failed");
    checkpointError.code = safeOperationalCode(
      error,
      "notification_checkpoint_failed",
    );
    throw checkpointError;
  }
}

async function deliverClaim(supabase, claim, transport, preview, testInbox) {
  if (
    !claim ||
    !CHANNELS.has(claim.channel) ||
    !claim.outbox_id ||
    !claim.claim_token ||
    !claim.booking
  ) {
    throw Object.assign(new Error("Invalid notification claim"), {
      code: "invalid_notification_claim",
    });
  }
  const job = notificationJob(claim, transport, preview, testInbox);
  if (!job.ready) {
    await recordResult(supabase, claim, "unconfigured", "channel_unconfigured");
    return { channel: claim.channel, status: "unconfigured" };
  }
  try {
    await job.send();
  } catch (error) {
    const code = safeOperationalCode(error, `${claim.channel}_delivery_failed`);
    const status = failedDeliveryStatus(error);
    console.error(`[booking-request] ${claim.channel} delivery failed`, code);
    await recordResult(supabase, claim, status, code);
    return { channel: claim.channel, status };
  }
  await recordResult(supabase, claim, "sent");
  return { channel: claim.channel, status: "sent" };
}

export async function deliverBookingRequestNotifications(
  supabase,
  { bookingId = null, limit = 12 } = {},
) {
  const { data: claims, error } = await supabase.rpc(
    "claim_booking_request_notifications",
    {
      p_booking_id: bookingId,
      p_limit: Math.max(1, Math.min(30, Number(limit) || 12)),
    },
  );
  if (error) {
    const claimError = new Error("Notification claim failed");
    claimError.code = safeOperationalCode(error, "notification_claim_failed");
    throw claimError;
  }
  const rows = Array.isArray(claims) ? claims : [];
  if (!rows.length) return { claimed: 0, results: [] };

  const preview = isHostedPreview();
  const testInbox = previewTestInbox();
  const emailReady = Boolean(
    process.env.GMAIL_SENDER &&
      process.env.GMAIL_APP_PASSWORD &&
      (preview ? testInbox : process.env.BUSINESS_EMAIL),
  );
  const transport = emailReady ? makeTransport() : null;
  const settled = await Promise.allSettled(
    rows.map((claim) =>
      deliverClaim(supabase, claim, transport, preview, testInbox),
    ),
  );
  const rejected = settled.filter((result) => result.status === "rejected");
  if (rejected.length) {
    const deliveryError = new Error("Notification delivery checkpoint failed");
    deliveryError.code = safeOperationalCode(
      rejected[0].reason,
      "notification_delivery_checkpoint_failed",
    );
    throw deliveryError;
  }
  return {
    claimed: rows.length,
    results: settled.map((result) => result.value),
  };
}
