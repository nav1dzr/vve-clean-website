import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { isHostedPreview, previewTestInbox } from './previewIsolation.js';

export const DEPOSIT_PENCE = 3000;
const JOURNEY_COLUMNS =
  "booking_id,revision,offer_version,state,draft,snapshot,previous_snapshot,token_generation,token_expires_at,hold_until,reminder_sent_at,appointment_reminder_sent_at,checkout_id,checkout_kind,checkout_creating_at,paid_pence,refunded_pence,customer_request,updated_at";
const BOOKING_COLUMNS =
  "id,booking_ref,full_name,email,phone,address,postcode,service,preferred_date,preferred_time,service_date,total_price,deposit_amount,payment_status,balance_status,status,email_customer_sent,email_business_sent";
export class JourneyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireJourneyEnabled() {
  if (process.env.BOOKING_JOURNEY_ENABLED !== "true")
    throw new JourneyError(
      "Booking management is not enabled yet. Complete the test setup before sending.",
      503,
    );
  if ((process.env.BOOKING_JOURNEY_TOKEN_SECRET || "").length < 32)
    throw new JourneyError(
      "Booking management signing key is not configured.",
      503,
    );
}
function siteOrigin() {
  const url = new URL(
    process.env.BOOKING_JOURNEY_SITE_URL ||
      process.env.SITE_URL ||
      "https://www.vveclean.co.uk",
  );
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new JourneyError("Secure website URL is required.", 503);
  return url.origin;
}
export function signToken(j) {
  const value = `${j.booking_id}.${j.token_generation}`;
  return `${value}.${createHmac("sha256", process.env.BOOKING_JOURNEY_TOKEN_SECRET).update(value).digest("base64url")}`;
}
export function tokenIdentity(token) {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9-]{36}\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw new JourneyError(
      "This private booking link is invalid or has expired.",
      401,
    );
  const [id, generation, signature] = token.split(".");
  const expected = createHmac(
    "sha256",
    process.env.BOOKING_JOURNEY_TOKEN_SECRET,
  )
    .update(`${id}.${generation}`)
    .digest("base64url");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    throw new JourneyError(
      "This private booking link is invalid or has expired.",
      401,
    );
  return { id, generation };
}
export const manageLink = (j) =>
  `${siteOrigin()}/manage-booking#token=${signToken(j)}`;
export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function clean(value, max = 2000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
export function validateAgreement(input, now = new Date()) {
  const data = {
    service: clean(input.service, 200),
    items: clean(input.items, 3000),
    scope: clean(input.scope, 3000),
    exclusions: clean(input.exclusions, 2000),
    address: clean(input.address, 500),
    postcode: clean(input.postcode, 12).toUpperCase(),
    date: clean(input.date, 10),
    time: clean(input.time, 80),
    totalPence: Math.round(Number(input.totalPence)),
    changeReason: clean(input.changeReason, 1000),
    preparation: clean(input.preparation, 2000),
    policyVersion: "2026-09-08",
  };
  if (!data.service || !data.items || !data.address || !data.time)
    throw new JourneyError(
      "Enter service, included items, address and arrival window.",
    );
  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d\s*[-–]\s*(?:[01]\d|2[0-3]):[0-5]\d$/.test(
      data.time,
    )
  )
    throw new JourneyError(
      "Enter the arrival window as HH:MM–HH:MM in London time.",
    );
  const times = data.time.split(/\s*[-–]\s*/);
  if (times[0] >= times[1])
    throw new JourneyError(
      "The arrival window must end after it starts on the same day.",
    );
  if (!/^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/.test(data.postcode))
    throw new JourneyError("Enter a full UK postcode.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(Date.parse(`${data.date}T12:00:00Z`)) ||
    new Date(`${data.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      data.date ||
    data.date < londonToday(now)
  )
    throw new JourneyError(
      "Choose a valid appointment date, today or later in London time.",
    );
  if (
    !Number.isSafeInteger(data.totalPence) ||
    data.totalPence < DEPOSIT_PENCE ||
    data.totalPence > 10000000
  )
    throw new JourneyError(
      "The agreed total must be at least £30 and a valid amount.",
    );
  if (!data.changeReason)
    throw new JourneyError(
      "Record why these arrangements or price were agreed.",
    );
  return data;
}
export function holdDeadline(input, snapshot, now = new Date()) {
  const deadline = input
    ? new Date(input)
    : new Date(now.getTime() + 48 * 60 * 60 * 1000);
  if (
    !Number.isFinite(deadline.getTime()) ||
    deadline <= new Date(now.getTime() + 31 * 60 * 1000) ||
    deadline > new Date(now.getTime() + 48 * 60 * 60 * 1000)
  )
    throw new JourneyError(
      "Choose a payment deadline between 31 minutes and 48 hours from now.",
    );
  // A near-term booking needs an explicit same-day deadline verified by staff.
  if (!input && snapshot.date <= londonToday(deadline))
    throw new JourneyError(
      "For this near-term job, set an explicit payment deadline before arrival.",
    );
  if (londonToday(deadline) > snapshot.date)
    throw new JourneyError(
      "The payment deadline must not be after the appointment date.",
    );
  if (londonToday(deadline) === snapshot.date) {
    const londonTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(deadline);
    if (londonTime >= snapshot.time.slice(0, 5))
      throw new JourneyError(
        "The payment deadline must be before the arrival window starts.",
      );
  }
  return deadline.toISOString();
}
export async function loadJourney(db, id, create = false) {
  const { data: booking, error: be } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (be) throw new JourneyError("Could not load the booking.", 503);
  if (!booking) throw new JourneyError("Booking not found.", 404);
  let { data: journey, error: je } = await db
    .from("booking_journeys")
    .select(JOURNEY_COLUMNS)
    .eq("booking_id", id)
    .maybeSingle();
  if (je)
    throw new JourneyError(
      "Booking management tables are unavailable. Apply the migration to the test database first.",
      503,
    );
  if (!journey && create) {
    if (booking.payment_status === "paid" || Number(booking.deposit_amount) > 0)
      throw new JourneyError(
        "This historic deposit booking uses its existing payment journey. Do not request another deposit.",
      );
    if (
      !["new", null, undefined].includes(booking.status) ||
      ["paid", "waived"].includes(booking.balance_status)
    )
      throw new JourneyError(
        "This existing booking is already scheduled, closed or settled. Keep its existing records; do not request a new deposit.",
      );
    const draft = {
      service: booking.service || "",
      items: booking.service || "",
      scope: "",
      exclusions: "",
      address: booking.address || "",
      postcode: booking.postcode || "",
      date: booking.service_date || booking.preferred_date || "",
      time: booking.preferred_time || "",
      totalPence: Math.round(Number(booking.total_price || 0) * 100),
      changeReason: "",
      preparation: "",
    };
    const { error } = await db
      .from("booking_journeys")
      .insert({ booking_id: id, draft });
    if (error && error.code !== "23505")
      throw new JourneyError("Could not create the booking workspace.", 503);
    ({ data: journey, error: je } = await db
      .from("booking_journeys")
      .select(JOURNEY_COLUMNS)
      .eq("booking_id", id)
      .single());
    if (je)
      throw new JourneyError("Could not load the booking workspace.", 503);
  }
  return { booking, journey };
}
export async function loadPrivateJourney(db, token) {
  const { id, generation } = tokenIdentity(token);
  const result = await loadJourney(db, id);
  if (
    !result.journey ||
    result.journey.token_generation !== generation ||
    new Date(result.journey.token_expires_at) <= new Date()
  )
    throw new JourneyError(
      "This private booking link has expired. Please contact VVE Clean.",
      401,
    );
  return result;
}
export function publicJourney(booking, j) {
  const snapshot = j.snapshot || j.draft;
  const netPaid = Math.max(0, j.paid_pence - j.refunded_pence);
  const safeAgreement = (s) =>
    s
      ? Object.fromEntries(
          [
            "service",
            "items",
            "scope",
            "exclusions",
            "address",
            "postcode",
            "date",
            "time",
            "totalPence",
            "preparation",
            "policyVersion",
          ].map((key) => [key, s[key]]),
        )
      : null;
  return {
    reference: booking.booking_ref,
    firstName: clean(booking.full_name, 120).split(" ")[0],
    revision: j.revision,
    offerVersion: j.offer_version,
    state: j.state,
    agreement: safeAgreement(snapshot),
    previousAgreement:
      j.state === "change_pending" ? safeAgreement(j.previous_snapshot) : null,
    holdUntil: j.hold_until,
    paidPence: j.paid_pence,
    refundedPence: j.refunded_pence,
    balancePence: Math.max(0, (snapshot?.totalPence || 0) - netPaid),
    customerRequest: j.customer_request,
    canPayDeposit:
      j.state === "offered" &&
      netPaid === 0 &&
      new Date(j.hold_until) > new Date(Date.now() + 31 * 60 * 1000),
    canPayBalance:
      j.state === "completed" && netPaid < (snapshot?.totalPence || 0),
    canChange: ["offered", "confirmed", "change_pending"].includes(j.state),
    canAccept: j.state === "change_pending",
  };
}
function bookingPatch(s, status, extra = {}) {
  return {
    service: [s.service, s.items, s.scope].filter(Boolean).join(" · "),
    address: s.address,
    postcode: s.postcode,
    preferred_date: s.date,
    service_date: s.date,
    preferred_time: s.time,
    total_price: s.totalPence / 100,
    status,
    ...extra,
  };
}
function messagePayload(booking, j, kind) {
  return {
    kind,
    reference: booking.booking_ref,
    name: booking.full_name,
    email: booking.email,
    journey:
      kind === "appointment_reminder" && j.state === "change_pending"
        ? { ...j, snapshot: j.previous_snapshot }
        : j,
  };
}
async function apply(
  db,
  booking,
  j,
  event,
  patch = {},
  bp = {},
  kind = null,
  actor = "system",
  payment = null,
) {
  const next = { ...j, ...patch, revision: j.revision + 1 };
  const message = kind
    ? {
        kind,
        dedup_key: kind.startsWith("initial_")
          ? `${j.booking_id}:${kind}`
          : `${j.booking_id}:${next.revision}:${kind}`,
        payload: messagePayload(booking, next, kind),
      }
    : null;
  const { data, error } = await db.rpc("apply_booking_journey", {
    p_booking_id: j.booking_id,
    p_revision: j.revision,
    p_actor: actor,
    p_event: event,
    p_patch: patch,
    p_booking_patch: bp,
    p_message: message,
    p_payment: payment,
  });
  if (error)
    throw new JourneyError(
      error.code === "40001"
        ? "This booking changed. Reload before trying again."
        : "Could not save the booking action.",
      error.code === "40001" ? 409 : 503,
    );
  return data;
}
export function emailForMessage(payload) {
  const j = payload.journey,
    s = j.snapshot || j.draft;
  const labels = {
    deposit_request: [
      "Confirm your booking with a £30 deposit",
      "We have agreed the following arrangements. Your appointment is provisionally held until the deadline below. Paying the £30 deposit confirms it.",
    ],
    confirmation: [
      "Your booking is confirmed",
      "Thank you. Your £30 deposit has been received and credited towards your agreed total.",
    ],
    change_proposal: [
      "Please review your revised booking",
      "Please review and accept the revised arrangements. Your previous confirmed appointment stays in place until you accept. No second deposit is required.",
    ],
    revised_confirmation: [
      "Your revised booking is confirmed",
      "Your agreed changes are confirmed. Money already paid remains credited to your booking.",
    ],
    reschedule_received: [
      "We received your rescheduling request",
      "We will check availability and contact you. Your current appointment has not been cancelled or moved.",
    ],
    cancelled: [
      "Your booking is cancelled",
      "Your appointment has been cancelled. Any money already paid remains recorded. We will contact you separately about any refund due under the agreed terms; this email does not confirm a refund.",
    ],
    expired: [
      "Your appointment hold has expired",
      "The deposit deadline passed and the provisional appointment is no longer held. Please contact us to agree new availability. No confirmed paid appointment has been cancelled.",
    ],
    reminder: [
      "Your £30 deposit reminder",
      "Your provisional appointment is awaiting its £30 deposit. The deadline is shown below.",
    ],
    appointment_reminder: [
      "Your confirmed clean is tomorrow",
      "Here are the details of your confirmed appointment. Please check access and preparation below. Your deposit remains credited; no automatic payment will be taken by this reminder. If revised arrangements are awaiting your acceptance, the existing confirmed appointment shown here remains in place.",
    ],
    balance_due: [
      "Your clean is completed — remaining balance",
      "Thank you for choosing VVE Clean. Your deposit has been deducted. You can pay the remaining balance using your private booking page.",
    ],
    receipt: [
      "Payment received — thank you",
      "We have recorded your payment. Your remaining balance is shown below.",
    ],
    refund: [
      "Your refund has been recorded",
      "A Stripe refund has been recorded for this booking. Your bank controls when the refund appears.",
    ],
    payment_review: [
      "Payment received — arrangements under review",
      "We received a payment while the booking was being changed or closed. Please contact us; your payment is recorded but the appointment needs staff confirmation.",
    ],
  };
  const initial = ["initial_customer", "initial_business"].includes(
    payload.kind,
  );
  const [heading, intro] = initial
    ? [
        "We received your cleaning request",
        "Your initial request is free. We will contact you to agree availability, scope and the final price. Once agreed, a £30 deposit confirms the appointment.",
      ]
    : labels[payload.kind] || [
        "Your booking update",
        "Please review the latest details.",
      ];
  const money = (p) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(p / 100);
  const deadline = j.hold_until
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(j.hold_until)) + " (London time)"
    : "—";
  const rows = [
    ["Reference", payload.reference],
    ["Service", s.service],
    ["Included items", s.items],
    ["Scope", s.scope],
    ["Not included", s.exclusions],
    [
      initial ? "Requested date / time" : "Appointment",
      `${s.date} · ${s.time} (London time)`,
    ],
    ["Address", `${s.address}, ${s.postcode}`],
    [initial ? "Estimated total" : "Agreed total", money(s.totalPence)],
    ...(!initial
      ? [
          ["Paid", money(j.paid_pence)],
          ["Refunded", money(j.refunded_pence)],
          [
            j.state === "cancelled"
              ? "Unpaid portion of original quote (not a cancellation charge)"
              : "Remaining balance",
            money(Math.max(0, s.totalPence - j.paid_pence + j.refunded_pence)),
          ],
        ]
      : []),
    ...(["deposit_request", "reminder"].includes(payload.kind)
      ? [
          ["Deposit due", money(DEPOSIT_PENCE)],
          ["Payment deadline", deadline],
        ]
      : []),
    ...(j.customer_request?.kind === "reschedule"
      ? [
          [
            "Requested new time",
            `${j.customer_request.date} · ${j.customer_request.time}`,
          ],
          ["Customer message", j.customer_request.reason],
        ]
      : []),
    ["Preparation", s.preparation],
  ].filter(([, v]) => v);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const link = manageLink(j);
  const text = [
    `Hi ${payload.name || "there"},`,
    "",
    heading,
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `View your booking, pay, request another time or cancel: ${link}`,
    "",
    "VVE Clean · 020 8050 2233 · contact@vveclean.co.uk",
  ].join("\n");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#edf3fa;color:#10203d;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" style="width:100%;max-width:600px;background:white;border-radius:16px;overflow:hidden"><tr><td style="background:#071a3e;padding:28px;color:white;font-size:25px;font-weight:bold">VVE <span style="color:#6cb5ff">Clean</span></td></tr><tr><td style="padding:28px"><p>Hi ${esc(payload.name || "there")},</p><h1 style="font-size:26px;line-height:1.2">${esc(heading)}</h1><p style="line-height:1.6">${esc(intro)}</p><table role="presentation" width="100%" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e5eaf2;vertical-align:top;width:36%;font-size:14px;color:#52627c">${esc(k)}</td><td style="padding:12px 8px;border-bottom:1px solid #e5eaf2;font-size:14px;white-space:pre-line">${esc(v)}</td></tr>`).join("")}</table><p style="margin:28px 0"><a href="${esc(link)}" style="background:#1266df;border-radius:8px;color:white;padding:15px 20px;text-decoration:none;display:inline-block;font-weight:bold">View and manage booking</a></p><p style="font-size:13px;line-height:1.6">The button opens your private booking page. No payment or cancellation happens until you choose and confirm an action.</p><p style="font-size:12px;word-break:break-all">${esc(link)}</p><p style="font-size:14px">020 8050 2233 · contact@vveclean.co.uk</p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: `${payload.audience === "business" || payload.kind === "initial_business" ? "Staff update: " : ""}${heading} — ${payload.reference}`,
    text,
    html,
  };
}
async function stripeRequest(path, params = null, idempotencyKey = null) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) throw new JourneyError("Stripe is not configured.", 503);
  if (
    process.env.BOOKING_JOURNEY_MODE !== "live" &&
    !key.startsWith("sk_test_") &&
    !key.startsWith("rk_test_")
  )
    throw new JourneyError("Test mode requires a Stripe test key.", 503);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new JourneyError(
      "Stripe could not complete this action. Please retry or contact the team.",
      503,
    );
  return body;
}
async function recoverCheckoutReservation(db, booking, j) {
  if (!j.checkout_creating_at) return j;
  if (Date.now() - new Date(j.checkout_creating_at).getTime() < 600000)
    throw new JourneyError(
      "A payment checkout is being prepared. Retry shortly before changing this booking.",
      409,
    );
  const since =
    Math.floor(new Date(j.checkout_creating_at).getTime() / 1000) - 60;
  let cursor = "",
    matched = null;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(since),
      ...(cursor ? { starting_after: cursor } : {}),
    });
    const result = await stripeRequest(`checkout/sessions?${params}`);
    for (const session of result.data || []) {
      if (
        session.metadata?.journey === "v1" &&
        session.metadata.booking_id === j.booking_id &&
        session.metadata.checkout_attempt === j.checkout_creating_at
      ) {
        if (matched)
          throw new JourneyError(
            "Multiple checkout attempts require staff reconciliation.",
            409,
          );
        matched = session;
      }
    }
    if (!result.has_more)
      return apply(
        db,
        booking,
        j,
        "checkout_recovered",
        { checkout_id: matched?.id || null, checkout_creating_at: null },
        {},
        null,
        "system",
      );
    cursor = result.data?.at(-1)?.id;
    if (!cursor) break;
  }
  throw new JourneyError(
    "Checkout recovery needs staff reconciliation. No new payment was opened.",
    409,
  );
}
export async function reconcileCheckout(
  db,
  booking,
  j,
  { close = false } = {},
) {
  j = await recoverCheckoutReservation(db, booking, j);
  if (!j.checkout_id) return j;
  let session = await stripeRequest(
    `checkout/sessions/${encodeURIComponent(j.checkout_id)}`,
  );
  if (session.payment_status === "paid") {
    await recordJourneyPayment(db, session);
    throw new JourneyError(
      "Payment has been received. Reload the booking before making changes.",
      409,
    );
  }
  if (session.status === "complete")
    throw new JourneyError(
      "A payment is processing. Wait for its final result before changing the booking.",
      409,
    );
  if (close && session.status === "open") {
    session = await stripeRequest(
      `checkout/sessions/${encodeURIComponent(j.checkout_id)}/expire`,
      {},
      `close:${j.checkout_id}`,
    );
    if (session.status !== "expired")
      throw new JourneyError(
        "Checkout could not be closed safely. Retry after checking payment.",
        409,
      );
  }
  return j;
}
export async function performAdminAction(db, id, body, actor) {
  requireJourneyEnabled();
  let { booking, journey: j } = await loadJourney(db, id, true);
  if (body.revision !== j.revision)
    throw new JourneyError(
      "This booking changed. Reload before trying again.",
      409,
    );
  const action = body.operation;
  if (action === "draft") {
    const draft = validateAgreement(body.agreement);
    if (["cancelled", "completed", "payment_review"].includes(j.state))
      throw new JourneyError(
        "This booking cannot be edited in its current state.",
      );
    j = await apply(db, booking, j, "draft_saved", { draft }, {}, null, actor);
  } else if (action === "send") {
    if (body.availabilityConfirmed !== true)
      throw new JourneyError(
        "Confirm you checked availability and agreed these details with the customer.",
      );
    if (["cancelled", "completed", "payment_review"].includes(j.state))
      throw new JourneyError(
        "This booking cannot be offered in its current state.",
      );
    j = await reconcileCheckout(db, booking, j, { close: true });
    const snapshot = validateAgreement(j.draft);
    if (snapshot.totalPence < j.paid_pence - j.refunded_pence)
      throw new JourneyError(
        "The revised total is below money already paid. Reconcile the refund first.",
      );
    const paid = j.paid_pence - j.refunded_pence >= DEPOSIT_PENCE;
    const holdUntil = paid ? null : holdDeadline(body.holdUntil, snapshot);
    const patch = {
      snapshot,
      previous_snapshot: paid ? j.previous_snapshot || j.snapshot : null,
      offer_version: j.offer_version + 1,
      state: paid ? "change_pending" : "offered",
      hold_until: holdUntil,
      reminder_sent_at: null,
      checkout_id: null,
      checkout_kind: null,
      customer_request: null,
    };
    j = await apply(
      db,
      booking,
      j,
      "agreement_sent",
      patch,
      paid ? {} : bookingPatch(snapshot, "new"),
      paid ? "change_proposal" : "deposit_request",
      actor,
    );
  } else if (action === "remind") {
    if (j.state !== "offered" || new Date(j.hold_until) <= new Date())
      throw new JourneyError("Only an active unpaid offer can be reminded.");
    j = await reconcileCheckout(db, booking, j);
    j = await apply(
      db,
      booking,
      j,
      "deposit_reminder",
      { reminder_sent_at: new Date().toISOString() },
      {},
      "reminder",
      actor,
    );
  } else if (action === "appointment_reminder") {
    const active =
      j.state === "confirmed"
        ? j.snapshot
        : j.state === "change_pending"
          ? j.previous_snapshot
          : null;
    const tomorrow = new Date(`${londonToday()}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (
      !active ||
      active.date !== tomorrow.toISOString().slice(0, 10) ||
      j.appointment_reminder_sent_at
    )
      throw new JourneyError(
        "No appointment reminder is due for this confirmed arrangement.",
      );
    j = await apply(
      db,
      booking,
      j,
      "appointment_reminder",
      { appointment_reminder_sent_at: new Date().toISOString() },
      {},
      "appointment_reminder",
      actor,
    );
  } else if (
    action === "cancel" ||
    action === "expire" ||
    action === "revoke"
  ) {
    if (
      action === "expire" &&
      (j.state !== "offered" || new Date(j.hold_until) > new Date())
    )
      throw new JourneyError("This hold is not due to expire.");
    if (action === "cancel" && ["cancelled", "completed"].includes(j.state))
      throw new JourneyError("This booking is already closed.");
    j = await reconcileCheckout(db, booking, j, { close: true });
    const patch =
      action === "revoke"
        ? { token_generation: randomUUID(), checkout_id: null }
        : {
            state: action === "expire" ? "expired" : "cancelled",
            checkout_id: null,
            customer_request: null,
          };
    j = await apply(
      db,
      booking,
      j,
      action,
      patch,
      action === "cancel" ? { status: "cancelled" } : {},
      action === "revoke"
        ? null
        : action === "expire"
          ? "expired"
          : "cancelled",
      actor,
    );
  } else if (action === "complete") {
    if (j.state !== "confirmed")
      throw new JourneyError(
        "Confirm the booking before marking the clean completed.",
      );
    j = await apply(
      db,
      booking,
      j,
      "clean_completed",
      { state: "completed" },
      {
        status: "completed",
        balance_status:
          j.paid_pence - j.refunded_pence >= j.snapshot.totalPence
            ? "paid"
            : "outstanding",
      },
      "balance_due",
      actor,
    );
  } else if (action === "manual_payment") {
    if (j.state !== "completed")
      throw new JourneyError(
        "Record a balance payment after the clean is completed.",
      );
    j = await reconcileCheckout(db, booking, j, { close: true });
    const amount = Math.round(Number(body.amountPence));
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > j.snapshot.totalPence - j.paid_pence + j.refunded_pence
    )
      throw new JourneyError(
        "Enter an amount no greater than the remaining balance.",
      );
    if (
      !["cash", "bank_transfer", "card", "other"].includes(body.method) ||
      !clean(body.reference, 200)
    )
      throw new JourneyError(
        "Record the payment method and actual payment reference.",
      );
    const paid = j.paid_pence + amount,
      settled = paid - j.refunded_pence >= j.snapshot.totalPence;
    j = await apply(
      db,
      booking,
      j,
      "manual_payment",
      { paid_pence: paid, checkout_id: null },
      {
        balance_status: settled ? "paid" : "outstanding",
        balance_payment_method: body.method,
        ...(settled ? { balance_paid_at: new Date().toISOString() } : {}),
      },
      "receipt",
      actor,
      {
        external_id: `manual:${id}:${clean(body.reference, 200)}`,
        kind: "manual_balance",
        amount_pence: amount,
      },
    );
  } else if (action === "resolve_payment") {
    if (j.state !== "payment_review" || !clean(body.reason, 1000))
      throw new JourneyError(
        "Record a reconciliation reason for this payment review.",
      );
    j = await reconcileCheckout(db, booking, j, { close: true });
    if (body.resolution === "confirm") {
      const net = j.paid_pence - j.refunded_pence;
      if (
        body.availabilityConfirmed !== true ||
        net < DEPOSIT_PENCE ||
        net > j.snapshot.totalPence
      )
        throw new JourneyError(
          "Check availability and reconcile the paid amount before confirming. At least the £30 deposit must remain credited.",
        );
      const snapshot = {
        ...j.snapshot,
        changeReason: `Payment reconciliation: ${clean(body.reason, 1000)}`,
      };
      j = await apply(
        db,
        booking,
        j,
        "payment_review_resolved",
        {
          state: "confirmed",
          snapshot,
          previous_snapshot: null,
          appointment_reminder_sent_at: null,
        },
        bookingPatch(snapshot, "confirmed", {
          deposit_amount: 30,
          payment_status: "paid",
          balance_status: "not_due",
        }),
        "revised_confirmation",
        actor,
      );
    } else if (body.resolution === "cancel") {
      j = await apply(
        db,
        booking,
        j,
        "payment_review_closed",
        {
          state: "cancelled",
          draft: {
            ...j.draft,
            changeReason: `Payment reconciliation: ${clean(body.reason, 1000)}`,
          },
        },
        { status: "cancelled", balance_status: "not_due" },
        "cancelled",
        actor,
      );
    } else
      throw new JourneyError(
        "Choose whether to confirm the reconciled appointment or close it as cancelled.",
      );
  } else if (action === "retry_request") {
    if (j.state !== "draft")
      throw new JourneyError(
        "The initial request has moved on. Use the current booking email instead.",
      );
    for (const [flag, kind] of [
      ["email_customer_sent", "initial_customer"],
      ["email_business_sent", "initial_business"],
    ]) {
      if (booking[flag] !== false) continue;
      const { data: prior, error: priorError } = await db
        .from("booking_journey_messages")
        .select("id,status")
        .eq("dedup_key", `${id}:${kind}`)
        .maybeSingle();
      if (priorError)
        throw new JourneyError(
          "Could not check the existing acknowledgement.",
          503,
        );
      if (prior?.status === "sent") {
        const { error: repairError } = await db
          .from("bookings")
          .update({ [flag]: true })
          .eq("id", id);
        if (repairError)
          throw new JourneyError(
            "The email was sent, but its request flag could not be repaired. No email was resent.",
            503,
          );
        await db
          .from("booking_journey_messages")
          .update({ last_error: null })
          .eq("id", prior.id);
      } else if (!prior)
        j = await apply(
          db,
          booking,
          j,
          "initial_acknowledgement_retry",
          {},
          {},
          kind,
          actor,
        );
    }
  } else if (action !== "retry")
    throw new JourneyError("Unknown booking action.");
  const deliveries = await deliverJourneyMessages(
    db,
    id,
    action === "retry" ? body.messageId : null,
  );
  return { journey: j, deliveries };
}
export async function performCustomerAction(db, token, body) {
  requireJourneyEnabled();
  let { booking, journey: j } = await loadPrivateJourney(db, token);
  if (body.revision !== j.revision)
    throw new JourneyError(
      "Your booking has changed. Refresh to see its current details.",
      409,
    );
  if (body.operation === "checkout")
    return createJourneyCheckout(db, booking, j);
  if (body.confirm !== true)
    throw new JourneyError("Please confirm your chosen action.");
  if (body.operation === "accept_change") {
    if (j.state !== "change_pending")
      throw new JourneyError(
        "There are no revised arrangements awaiting acceptance.",
      );
    j = await apply(
      db,
      booking,
      j,
      "changes_accepted",
      {
        state: "confirmed",
        previous_snapshot: null,
        customer_request: null,
        appointment_reminder_sent_at: null,
      },
      bookingPatch(j.snapshot, "confirmed"),
      "revised_confirmation",
      "customer",
    );
  } else if (body.operation === "reschedule") {
    if (!["offered", "confirmed", "change_pending"].includes(j.state))
      throw new JourneyError(
        "Please contact the team to arrange a new appointment.",
      );
    const date = clean(body.date, 10),
      time = clean(body.time, 80),
      reason = clean(body.reason, 1000);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
      date < londonToday() ||
      !time
    )
      throw new JourneyError(
        "Enter a valid preferred future date and arrival window.",
      );
    if (j.customer_request?.kind === "reschedule")
      throw new JourneyError(
        "Your rescheduling request is already with the team. Please contact us to change it.",
      );
    j = await apply(
      db,
      booking,
      j,
      "reschedule_requested",
      {
        customer_request: {
          kind: "reschedule",
          date,
          time,
          reason,
          createdAt: new Date().toISOString(),
        },
      },
      {},
      "reschedule_received",
      "customer",
    );
  } else if (body.operation === "cancel") {
    if (!["offered", "confirmed", "change_pending"].includes(j.state))
      throw new JourneyError(
        "This booking cannot be cancelled online in its current state. Contact the team.",
      );
    j = await reconcileCheckout(db, booking, j, { close: true });
    j = await apply(
      db,
      booking,
      j,
      "customer_cancelled",
      {
        state: "cancelled",
        checkout_id: null,
        customer_request: {
          kind: "cancel",
          reason: clean(body.reason, 1000),
          createdAt: new Date().toISOString(),
        },
      },
      { status: "cancelled" },
      "cancelled",
      "customer",
    );
  } else throw new JourneyError("Unknown booking action.");
  await deliverJourneyMessages(db, j.booking_id);
  return { booking: publicJourney(booking, j) };
}
export async function createJourneyCheckout(db, booking, j) {
  j = await recoverCheckoutReservation(db, booking, j);
  const balance = j.state === "completed",
    now = Date.now();
  if (
    !balance &&
    (j.state !== "offered" || j.paid_pence - j.refunded_pence > 0)
  )
    throw new JourneyError("A deposit is not due for this booking.");
  if (!balance && new Date(j.hold_until).getTime() - now < 31 * 60 * 1000)
    throw new JourneyError(
      "There is too little time left to open checkout safely. Contact the team to renew your hold.",
    );
  const amount = balance
    ? j.snapshot.totalPence - j.paid_pence + j.refunded_pence
    : DEPOSIT_PENCE;
  if (amount <= 0) throw new JourneyError("This booking is already paid.");
  if (j.checkout_id) {
    const session = await stripeRequest(
      `checkout/sessions/${encodeURIComponent(j.checkout_id)}`,
    );
    if (session.payment_status === "paid") {
      await recordJourneyPayment(db, session);
      throw new JourneyError(
        "Payment has been received. Refresh your booking.",
        409,
      );
    }
    if (session.status === "open") return { checkoutUrl: session.url };
    if (session.status === "complete")
      throw new JourneyError(
        "Your payment is processing. Please wait for confirmation.",
        409,
      );
  }
  // A reserved operation prevents parallel cancellation/edit while Stripe creates
  // checkout. A crash is recovered using the same Stripe idempotency key.
  if (
    j.checkout_creating_at &&
    now - new Date(j.checkout_creating_at).getTime() < 600000
  )
    throw new JourneyError(
      "Checkout is being prepared. Please retry shortly.",
      409,
    );
  const kind = balance ? "balance" : "deposit";
  const reservation = j.checkout_creating_at || new Date().toISOString();
  j = await apply(
    db,
    booking,
    j,
    "checkout_reserved",
    { checkout_creating_at: reservation, checkout_kind: kind },
    {},
    null,
    "customer",
  );
  const params = {
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `VVE Clean ${kind === "deposit" ? "£30 booking deposit" : "remaining balance"} — ${booking.booking_ref}`,
    "line_items[0][quantity]": "1",
    client_reference_id: j.booking_id,
    customer_email: booking.email,
    success_url: manageLink(j),
    cancel_url: manageLink(j),
    expires_at: String(
      Math.floor(
        Math.min(
          new Date(reservation).getTime() + 23 * 3600000,
          balance ? Infinity : new Date(j.hold_until).getTime(),
        ) / 1000,
      ),
    ),
    "metadata[journey]": "v1",
    "metadata[checkout_attempt]": reservation,
    "metadata[booking_id]": j.booking_id,
    "metadata[offer_version]": String(j.offer_version),
    "metadata[payment_kind]": kind,
    "metadata[amount_pence]": String(amount),
    "payment_intent_data[metadata][journey]": "v1",
    "payment_intent_data[metadata][booking_id]": j.booking_id,
  };
  let session;
  try {
    session = await stripeRequest(
      "checkout/sessions",
      params,
      `booking:${j.booking_id}:${j.offer_version}:${kind}:${reservation}`,
    );
  } catch (error) {
    throw new JourneyError(
      `${error.message} The payment preparation is saved; retry in ten minutes if its outcome is uncertain.`,
      503,
    );
  }
  try {
    await apply(
      db,
      booking,
      j,
      "checkout_ready",
      { checkout_id: session.id, checkout_creating_at: null },
      {},
      null,
      "system",
    );
  } catch (error) {
    await stripeRequest(
      `checkout/sessions/${encodeURIComponent(session.id)}/expire`,
      {},
      `close:${session.id}`,
    );
    throw error;
  }
  return { checkoutUrl: session.url };
}
export async function recordJourneyPayment(db, session) {
  const meta = session.metadata || {};
  if (meta.journey !== "v1") return false;
  if (session.payment_status !== "paid") return true;
  if (
    session.currency !== "gbp" ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total !== Number(meta.amount_pence)
  )
    throw new JourneyError("Payment amount or currency did not match.", 409);
  if (meta.payment_kind === "deposit" && session.amount_total !== DEPOSIT_PENCE)
    throw new JourneyError("Deposit amount did not match.", 409);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { booking, journey: j } = await loadJourney(db, meta.booking_id);
    if (!j) throw new JourneyError("Payment booking is unavailable.", 503);
    const { data: existing, error: lookupError } = await db
      .from("booking_journey_payments")
      .select("external_id")
      .eq("external_id", session.id)
      .maybeSingle();
    if (lookupError)
      throw new JourneyError("Payment ledger is unavailable.", 503);
    if (existing) {
      await deliverJourneyMessages(db, j.booking_id);
      return true;
    }
    const valid =
      Number(meta.offer_version) === j.offer_version &&
      ((meta.payment_kind === "deposit" &&
        j.state === "offered" &&
        j.paid_pence === 0) ||
        (meta.payment_kind === "balance" &&
          j.state === "completed" &&
          session.amount_total ===
            j.snapshot.totalPence - j.paid_pence + j.refunded_pence));
    const paid = j.paid_pence + session.amount_total;
    const state = valid
      ? meta.payment_kind === "deposit"
        ? "confirmed"
        : "completed"
      : "payment_review";
    const patch = {
      paid_pence: paid,
      state,
      checkout_id: null,
      checkout_creating_at: null,
      ...(state === "confirmed" ? { appointment_reminder_sent_at: null } : {}),
    };
    const bp = valid
      ? bookingPatch(
          j.snapshot,
          state === "completed" ? "completed" : "confirmed",
          {
            deposit_amount: Math.min(DEPOSIT_PENCE, paid) / 100,
            payment_status: "paid",
            balance_status:
              paid - j.refunded_pence >= j.snapshot.totalPence
                ? "paid"
                : state === "completed"
                  ? "outstanding"
                  : "not_due",
            ...(paid - j.refunded_pence >= j.snapshot.totalPence
              ? {
                  balance_paid_at: new Date().toISOString(),
                  balance_payment_method: "stripe",
                }
              : {}),
          },
        )
      : {};
    try {
      await apply(
        db,
        booking,
        j,
        "stripe_payment_received",
        patch,
        bp,
        valid
          ? meta.payment_kind === "deposit"
            ? "confirmation"
            : "receipt"
          : "payment_review",
        "stripe",
        {
          external_id: session.id,
          kind: meta.payment_kind,
          amount_pence: session.amount_total,
        },
      );
    } catch (error) {
      if (error.status === 409 && attempt < 2) continue;
      throw error;
    }
    await deliverJourneyMessages(db, j.booking_id);
    return true;
  }
}
export async function recordJourneyRefund(db, charge) {
  if (charge.metadata?.journey !== "v1") return false;
  const refunds = charge.refunds?.data || [];
  for (const refund of refunds.filter((r) => r.status === "succeeded")) {
    const { booking, journey: j } = await loadJourney(
      db,
      charge.metadata.booking_id,
    );
    const { data: prior, error } = await db
      .from("booking_journey_payments")
      .select("external_id")
      .eq("external_id", refund.id)
      .maybeSingle();
    if (error) throw new JourneyError("Refund ledger is unavailable.", 503);
    if (prior) continue;
    if (
      !j ||
      refund.currency !== "gbp" ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount <= 0 ||
      j.refunded_pence + refund.amount > j.paid_pence
    )
      throw new JourneyError("Refund requires reconciliation.", 409);
    await apply(
      db,
      booking,
      j,
      "stripe_refund_received",
      {
        refunded_pence: j.refunded_pence + refund.amount,
        state: j.state === "cancelled" ? "cancelled" : "payment_review",
      },
      { balance_status: "not_due" },
      "refund",
      "stripe",
      { external_id: refund.id, kind: "refund", amount_pence: -refund.amount },
    );
    await deliverJourneyMessages(db, j.booking_id);
  }
  return true;
}
export async function deliverJourneyMessages(db, id, messageId = null) {
  let query = db
    .from("booking_journey_messages")
    .select("id,booking_id,kind,payload,status,attempts,claimed_at")
    .eq("booking_id", id)
    .in("status", ["pending", "failed", "sending"])
    .order("created_at", { ascending: true })
    .limit(30);
  if (messageId) query = query.eq("id", messageId);
  const { data: messages, error } = await query;
  if (error)
    return [{ status: "failed", error: "Could not load pending messages." }];
  const results = [];
  for (const m of messages || []) {
    if (
      m.status === "sending" &&
      Date.now() - new Date(m.claimed_at).getTime() < 600000
    )
      continue;
    const { journey: current } = await loadJourney(db, id);
    const obsolete =
      m.payload.journey.token_generation !== current.token_generation ||
      (["deposit_request", "reminder"].includes(m.kind) &&
        (current.state !== "offered" ||
          current.offer_version !== m.payload.journey.offer_version ||
          new Date(current.hold_until) <= new Date())) ||
      (m.kind === "change_proposal" &&
        (current.state !== "change_pending" ||
          current.offer_version !== m.payload.journey.offer_version)) ||
      (["confirmation", "revised_confirmation"].includes(m.kind) &&
        (["cancelled", "payment_review"].includes(current.state) ||
          current.offer_version !== m.payload.journey.offer_version)) ||
      (m.kind === "reschedule_received" &&
        current.customer_request?.kind !== "reschedule") ||
      (m.kind === "appointment_reminder" &&
        JSON.stringify(
          current.state === "confirmed"
            ? current.snapshot
            : current.state === "change_pending"
              ? current.previous_snapshot
              : null,
        ) !== JSON.stringify(m.payload.journey.snapshot));
    if (obsolete) {
      await db
        .from("booking_journey_messages")
        .update({
          status: "suppressed",
          last_error: "Superseded by a newer booking state.",
        })
        .eq("id", m.id);
      continue;
    }
    const { data: claimed, error: ce } = await db
      .from("booking_journey_messages")
      .update({
        status: "sending",
        claimed_at: new Date().toISOString(),
        attempts: m.attempts + 1,
      })
      .eq("id", m.id)
      .eq("status", m.status)
      .eq("attempts", m.attempts)
      .select("id")
      .maybeSingle();
    if (ce || !claimed) continue;
    try {
      const preview = isHostedPreview();
      const test = preview || process.env.BOOKING_JOURNEY_MODE !== "live";
      const recipient = preview ? previewTestInbox() : test
        ? process.env.BOOKING_JOURNEY_TEST_EMAIL
        : m.payload.audience === "business" || m.kind === "initial_business"
          ? process.env.BUSINESS_EMAIL
          : m.payload.email;
      if (
        !recipient ||
        !process.env.GMAIL_SENDER ||
        !process.env.GMAIL_APP_PASSWORD
      )
        throw new Error(
          test
            ? "Set the test inbox and mail credentials before sending."
            : "Customer email or mail credentials are missing.",
        );
      const content = emailForMessage(m.payload);
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_SENDER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
      });
      await transport.sendMail({
        from: `"VVE Clean" <${process.env.GMAIL_SENDER}>`,
        to: recipient,
        replyTo: preview ? previewTestInbox() : process.env.BUSINESS_EMAIL || "contact@vveclean.co.uk",
        messageId: `<booking-${m.id}@vveclean.co.uk>`,
        ...content,
        subject: `${test ? "[TEST] " : ""}${content.subject}`,
      });
      const { error: saveError } = await db
        .from("booking_journey_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", m.id);
      if (saveError)
        throw new Error(
          "Email delivery completed but its status could not be saved. Check delivery before retrying.",
        );
      if (["initial_customer", "initial_business"].includes(m.kind)) {
        const flag =
          m.kind === "initial_customer"
            ? "email_customer_sent"
            : "email_business_sent";
        const { error: flagError } = await db
          .from("bookings")
          .update({ [flag]: true })
          .eq("id", id);
        if (flagError) {
          // Delivery already succeeded. Keep it sent so automatic retry cannot
          // resend it just because the legacy request flag needs repair.
          await db
            .from("booking_journey_messages")
            .update({
              last_error:
                "Email sent; legacy request flag needs repair. Do not resend.",
            })
            .eq("id", m.id);
          results.push({
            id: m.id,
            status: "sent",
            warning: "Legacy request flag needs repair.",
          });
          continue;
        }
      }
      results.push({ id: m.id, status: "sent" });
    } catch (error) {
      const detail = String(error.message || "Email failed").slice(0, 300);
      await db
        .from("booking_journey_messages")
        .update({ status: "failed", last_error: detail })
        .eq("id", m.id);
      results.push({ id: m.id, status: "failed", error: detail });
    }
  }
  return results;
}
export async function journeyAdminView(db, id, { holdUntil } = {}) {
  const { booking, journey } = await loadJourney(db, id);
  if (!journey)
    return {
      journey: null,
      notifications: [],
      events: [],
      enabled: process.env.BOOKING_JOURNEY_ENABLED === "true",
    };
  const [
    { data: notifications, error: ne },
    { data: events, error: ee },
    { data: payments, error: pe },
  ] = await Promise.all([
    db
      .from("booking_journey_messages")
      .select("id,kind,status,attempts,last_error,sent_at,created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("booking_journey_events")
      .select("id,revision,actor,event_type,details,created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("booking_journey_payments")
      .select("external_id,kind,amount_pence,currency,created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (ne || ee || pe)
    throw new JourneyError("Booking history could not be loaded.", 503);
  const previewJourney = {
    ...journey,
    snapshot: journey.draft,
    hold_until: holdUntil
      ? holdDeadline(holdUntil, journey.draft)
      : new Date(Date.now() + 48 * 3600000).toISOString(),
  };
  return {
    journey,
    notifications,
    events,
    payments,
    enabled: process.env.BOOKING_JOURNEY_ENABLED === "true",
    previewHoldUntil: previewJourney.hold_until,
    preview: emailForMessage(
      messagePayload(
        booking,
        previewJourney,
        journey.paid_pence - journey.refunded_pence >= DEPOSIT_PENCE
          ? "change_proposal"
          : "deposit_request",
      ),
    ),
    manageUrl: manageLink(journey),
  };
}
