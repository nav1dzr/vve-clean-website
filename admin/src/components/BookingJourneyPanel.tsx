import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "../lib/authFetch";
import type { BookingDetail } from "../types/booking";
import { bookingAgreementText, fillMissingAgreementText, requestedArrivalWindow } from "../lib/bookingAgreementDefaults";

type Agreement = {
  service: string;
  items: string;
  scope: string;
  exclusions: string;
  accessNotes: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  totalPence: number;
  changeReason: string;
  preparation: string;
  paymentPlan?: string;
  paymentWindowHours?: number;
  policyVersion?: string;
};
type Journey = {
  revision: number;
  offer_version: number;
  state: string;
  draft: Agreement;
  snapshot: Agreement | null;
  previous_snapshot: Agreement | null;
  hold_until: string | null;
  reminder_sent_at?: string | null;
  paid_pence: number;
  refunded_pence: number;
  customer_request: {
    kind: string;
    date?: string;
    time?: string;
    reason?: string;
  } | null;
};
type Message = {
  channel?: string;
  audience?: string;
  id: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};
type View = {
  journey: Journey | null;
  enabled: boolean;
  notifications: Message[];
  events: {
    id: number;
    event_type: string;
    actor: string;
    created_at: string;
    details: unknown;
  }[];
  preview?: { subject: string; html: string; text: string };
  previewHoldUntil?: string;
  payments?: {
    external_id: string;
    kind: string;
    amount_pence: number;
    currency: string;
    created_at: string;
  }[];
  manageUrl?: string;
  deliveries?: { status: string }[];
};
const money = (p: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    p / 100,
  );
const field =
  "mt-1 block min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950";
const button =
  "min-h-11 rounded-lg border border-silver-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
const statusLabels: Record<string, string> = {
  draft: "Draft agreement",
  offered: "Awaiting £30 deposit",
  change_pending: "Customer reviewing changes",
  confirmed: "Confirmed",
  expired: "Hold expired",
  cancelled: "Cancelled",
  completed: "Clean completed",
  payment_review: "Payment needs staff review",
};

export default function BookingJourneyPanel({
  booking,
  onChanged,
}: {
  booking: BookingDetail;
  onChanged: () => void;
}) {
  const initial: Agreement = {
    ...bookingAgreementText(booking),
    address: booking.address || "",
    postcode: booking.postcode || "",
    date: booking.serviceDate || booking.preferredDate || "",
    time: requestedArrivalWindow(booking.preferredTime),
    totalPence: Math.round((booking.totalPrice || 0) * 100),
    changeReason: "",
    paymentPlan: "deposit_after_agreement",
    paymentWindowHours: 48,
  };
  const [view, setView] = useState<View | null>(null),
    [agreement, setAgreement] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [checked, setChecked] = useState(false),
    [paymentAmount, setPaymentAmount] = useState(""),
    [paymentReference, setPaymentReference] = useState(""),
    [paymentMethod, setPaymentMethod] = useState("bank_transfer"),
    [bankDepositReference, setBankDepositReference] = useState(booking.bookingRef || ""),
    [bankDepositReceived, setBankDepositReceived] = useState(false);
  const endpoint = `/api/bookings/${booking.id}?action=journey`;
  useEffect(() => {
    let active = true;
    authFetch<View>(endpoint)
      .then((data) => {
        if (active) {
          setView(data);
          if (data.journey) setAgreement({ ...data.journey.draft, accessNotes: data.journey.draft.accessNotes || "" });
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load booking management.");
      });
    return () => {
      active = false;
    };
  }, [endpoint]);
  async function action(
    operation: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authFetch<View>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          operation,
          revision: view?.journey?.revision ?? 0,
          ...extra,
        }),
      });
      setView(result);
      if (result.journey) setAgreement({ ...result.journey.draft, accessNotes: result.journey.draft.accessNotes || "" });
      setNotice(
        result.deliveries?.some((d) => d.status === "failed")
          ? "Booking saved. A notification or calendar update needs attention; review the delivery history below."
          : operation === "preview"
            ? "Email preview refreshed. Nothing has been sent."
            : operation === "draft"
            ? "Agreement saved. Preview the email before sending."
            : "Booking action saved. Delivery status is shown below.",
      );
      if (operation === "draft" || operation === "preview") setPreview(true);
      if (["send", "complete", "cancel", "manual_payment", "manual_deposit"].includes(operation))
        onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void action("draft", { agreement: { ...agreement, changeReason: agreement.changeReason.trim() || "Booking details prepared in CRM for customer review." } });
  }
  const j = view?.journey;
  const paid = j ? j.paid_pence - j.refunded_pence : 0;
  const locked = busy || !view?.enabled;
  function update(key: keyof Agreement, value: string | number) {
    setAgreement((old) => ({ ...old, [key]: value }));
    setPreview(false);
    setChecked(false);
  }
  return (
    <section
      className="mb-4 rounded-xl border border-sky-200 bg-white p-4 sm:p-6"
      aria-labelledby="journey-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="journey-heading"
            className="text-lg font-semibold text-navy-950"
          >
            Arrange and confirm this booking
          </h2>
          <p className="mt-1 text-sm text-navy-700">
            Agree the details with the customer, then send the £30 deposit request.
            Their appointment is confirmed when the deposit is received.
          </p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-900">
          {statusLabels[j?.state || "draft"]}
        </span>
      </div>
      {!view?.enabled && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Sending is disabled until the booking workspace and test email delivery
          have been checked. Deposit requests and automatic confirmations are not active yet.
        </p>
      )}
      {(!j || j.state === "draft") &&
        (booking.notifications.emailCustomerSent === false ||
          booking.notifications.emailBusinessSent === false) && (
          <button
            className={`${button} mt-3`}
            disabled={locked}
            onClick={() => action("retry_request")}
          >
            Retry failed initial request emails
          </button>
        )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900"
        >
          {notice}
        </p>
      )}
      {j && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-navy-500">Version</dt>
            <dd>{j.offer_version || "Draft"}</dd>
          </div>
          {j.paid_pence > 0 && <div>
            <dt className="text-xs text-navy-500">Paid</dt>
            <dd>{money(j.paid_pence)}</dd>
          </div>}
          {j.refunded_pence > 0 && <div>
            <dt className="text-xs text-navy-500">Refunded</dt>
            <dd>{money(j.refunded_pence)}</dd>
          </div>}
          <div>
            <dt className="text-xs text-navy-500">{j.paid_pence > 0 ? "Balance" : "Total"}</dt>
            <dd>
              {money(
                Math.max(
                  0,
                  (j.snapshot?.totalPence || agreement.totalPence) - paid,
                ),
              )}
            </dd>
          </div>
        </dl>
      )}
      {j?.customer_request && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>Customer request: {j.customer_request.kind}</strong>
          <p>
            {j.customer_request.date} {j.customer_request.time}
          </p>
          <p>{j.customer_request.reason}</p>
          <p className="mt-2">
            Check availability, agree the change, save and send the revised
            details below.
          </p>
        </div>
      )}
      <details className="mt-5" open={!j || j.state === "draft"}>
        <summary className="cursor-pointer font-semibold text-navy-950">
          Edit service, price and appointment
        </summary>
        <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-navy-800">
          <p className="font-semibold">1. Check the details · 2. Preview the email · 3. Send</p>
          <p className="mt-2">Your request details are filled in below. Check the date, arrival time, cleaning list and total. You only need to edit what changed. Extra notes are optional, and blank notes stay out of the email.</p>
          <button type="button" className={`${button} mt-3 bg-white`} disabled={busy}
            onClick={() => {
              setAgreement((old) => fillMissingAgreementText(old, booking));
              setPreview(false);
              setChecked(false);
            }}>
            Fill empty wording from this request
          </button>
          <details className="mt-3">
            <summary className="cursor-pointer underline">Original customer request</summary>
            <p className="mt-2 whitespace-pre-line">{booking.service || "No service details recorded."}</p>
            {booking.notes && <p className="mt-2 whitespace-pre-line">Customer notes: {booking.notes}</p>}
          </details>
        </div>
        <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Service
            <input
              required
              className={field}
              value={agreement.service}
              onChange={(e) => update("service", e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="text-sm">
            Total (£)
            <input
              required
              className={field}
              type="number"
              min="0.01"
              step="0.01"
              value={agreement.totalPence / 100}
              onChange={(e) =>
                update("totalPence", Math.round(Number(e.target.value) * 100))
              }
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Your cleaning includes
            <textarea
              required
              className={field}
              rows={6}
              value={agreement.items}
              onChange={(e) => update("items", e.target.value)}
              maxLength={3000}
            />
            <span className="mt-1 block text-xs text-navy-600">One item or cleaning task per line. Include the rooms, quantities and extras you agreed. Put parking and other access charges in their own section below.</span>
          </label>
          <label className="text-sm">
            Appointment date
            <input
              required
              className={field}
              type="date"
              value={agreement.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Arrival window (London time)
            <input
              required
              className={field}
              placeholder="e.g. 09:00–11:00"
              value={agreement.time}
              onChange={(e) => update("time", e.target.value)}
            />
            <span className="mt-1 block text-xs text-navy-600">Prefilled from the request where possible. Replace it with the arrival window you agreed.</span>
          </label>
          <label className="text-sm">
            Service address
            <textarea
              required
              className={field}
              value={agreement.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Full postcode
            <input
              required
              className={field}
              value={agreement.postcode}
              onChange={(e) => update("postcode", e.target.value)}
              maxLength={12}
            />
          </label>
          <label className="text-sm">Payment arrangement
            <select className={field} value={agreement.paymentPlan || "after_clean"} onChange={(e) => update("paymentPlan", e.target.value)} disabled={["confirmed", "change_pending"].includes(j?.state || "")}>
              <option value="deposit_after_agreement">£30 deposit after agreeing the details</option>
              <option value="after_clean">Confirm directly — payment on the cleaning day</option>
            </select>
          </label>
          {agreement.paymentPlan === "deposit_after_agreement" && <label className="text-sm">Pay within
            <select className={field} value={agreement.paymentWindowHours || 48} onChange={(e) => update("paymentWindowHours", Number(e.target.value))}>
              {[2, 6, 12, 24, 48].map((hours) => <option key={hours} value={hours}>{hours} hours</option>)}
            </select>
            <span className="mt-1 block text-xs text-navy-600">Choose a deadline before the arrival window. The £30 comes off the total; the rest is due on the cleaning day.</span>
          </label>}
          <details className="rounded-xl border border-silver-200 bg-silver-50 p-4 sm:col-span-2">
            <summary className="cursor-pointer font-semibold text-navy-950">Extra notes and preparation — optional</summary>
            <p className="mt-2 text-sm text-navy-600">Suggested wording is ready where available. Leave anything irrelevant blank. Saved notes still appear in the email even when this section is closed.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Additional details (optional)
            <textarea
              className={field}
              rows={3}
              value={agreement.scope}
              onChange={(e) => update("scope", e.target.value)}
              maxLength={3000}
              placeholder="Anything specific to this clean, such as a treatment or an area needing extra care."
            />
            <span className="mt-1 block text-xs text-navy-600">Only add details the cleaning list does not already cover. You can leave this blank.</span>
          </label>
          <label className="text-sm">
            Not included (optional)
            <textarea
              className={field}
              rows={3}
              value={agreement.exclusions}
              onChange={(e) => update("exclusions", e.target.value)}
              maxLength={2000}
              placeholder="Any work you specifically agreed to leave out."
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Parking and access costs (optional)
            <textarea
              className={field}
              rows={3}
              value={agreement.accessNotes}
              onChange={(e) => update("accessNotes", e.target.value)}
              maxLength={2000}
              placeholder="For example: parking arrangements and any agreed Congestion Charge."
            />
            <span className="mt-1 block text-xs text-navy-600">Use one line per arrangement or charge. These are shown separately from the cleaning tasks. This wording does not change the total above.</span>
          </label>
          <label className="text-sm sm:col-span-2">
            Message to help the customer prepare (optional)
            <textarea
              className={field}
              rows={2}
              value={agreement.preparation}
              onChange={(e) => update("preparation", e.target.value)}
            />
            <span className="mt-1 block text-xs text-navy-600">Shown as a separate “Before we arrive” message in the email and booking page.</span>
          </label>
          <label className="text-sm sm:col-span-2">
            Reason for agreed scope, price or changes
            <textarea
              className={field}
              rows={2}
              value={agreement.changeReason}
              onChange={(e) => update("changeReason", e.target.value)}
              placeholder="Record what was agreed during your conversation."
            />
            <span className="mt-1 block text-xs text-navy-600">Optional internal note — not shown to the customer. Leave blank to record that you prepared these details in CRM, or use a shortcut below.</span>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2" aria-label="Internal note shortcuts">
            {["Details agreed by phone with the customer.", "Details agreed by message with the customer.", "Date and arrival window changed at the customer's request."].map((note) => (
              <button key={note} type="button" className={button} disabled={busy}
                onClick={() => update("changeReason", agreement.changeReason ? `${agreement.changeReason}\n${note}` : note)}>
                {note.startsWith("Details agreed by phone") ? "Agreed by phone" : note.startsWith("Details agreed by message") ? "Agreed by message" : "Customer requested a new time"}
              </button>
            ))}
          </div>
            </div>
          </details>
          <p className="text-xs text-navy-600 sm:col-span-2">
            Saving a draft leaves the customer's current offer unchanged.
            Sending changes to a confirmed booking asks for acceptance and keeps the
            original appointment until accepted.
          </p>
          <button
            className={`${button} bg-navy-950 text-white`}
            disabled={
              locked ||
              ["cancelled", "completed", "payment_review"].includes(
                j?.state || "",
              )
            }
          >
            Save agreement and preview email
          </button>
        </form>
      </details>
      {view?.preview && (
        <div className="mt-5 border-t border-silver-200 pt-4">
          <button
            type="button"
            className={button}
            onClick={() =>
              preview
                ? setPreview(false)
                : action("preview")
            }
          >
            {preview ? "Hide" : "Preview"} customer email
          </button>
          {preview && (
            <>
              <p className="my-3 text-sm font-semibold">
                {view.preview.subject}
              </p>
              <iframe
                title="Booking email preview"
                sandbox=""
                srcDoc={view.preview.html}
                className="h-[580px] w-full rounded-lg border border-silver-200"
              />
              <p className="mt-2 text-xs text-navy-600">
                This is a preview. Links in it are disabled. Check the service,
                price, date and arrival window before sending.
              </p>
            </>
          )}
          {!["cancelled", "completed", "payment_review"].includes(
            j?.state || "",
          ) && (
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-5 w-5"
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <span>
                  I checked availability and agreed the saved service, total,
                  date and arrival window with the customer.
                </span>
              </label>
              <button
                className={`${button} bg-sky-700 text-white`}
                disabled={locked || !checked || !preview}
                onClick={() =>
                  action("send", {
                    availabilityConfirmed: checked,
                    ...(agreement.paymentPlan === "deposit_after_agreement" ? { holdUntil: view.previewHoldUntil } : {}),
                  })
                }
              >
                {["confirmed", "change_pending"].includes(j?.state || "")
                  ? "Send revised details for acceptance"
                  : agreement.paymentPlan === "deposit_after_agreement" ? "Send booking details and £30 deposit request" : "Confirm booking and send email"}
              </button>
            </div>
          )}
        </div>
      )}
      {j && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-silver-200 pt-4">
          {j.state === "offered" && j.snapshot?.paymentPlan === "deposit_after_agreement" && (
            <button className={button} disabled={locked || !!j.reminder_sent_at || !!j.customer_request || (!!j.hold_until && new Date(j.hold_until) <= new Date())} onClick={() => action("remind")}>
              {j.reminder_sent_at ? "Deposit reminder sent" : "Send unpaid deposit reminder"}
            </button>
          )}
          {j.state === "payment_review" && (
            <>
              <button
                className={button}
                disabled={locked}
                onClick={() => {
                  const reason = window.prompt(
                    "Record what you checked: payment, current service, price and availability.",
                  );
                  if (
                    reason &&
                    window.confirm(
                      "Confirm these existing arrangements with the credited payment?",
                    )
                  )
                    void action("resolve_payment", {
                      resolution: "confirm",
                      reason,
                      availabilityConfirmed: true,
                    });
                }}
              >
                Confirm after payment review
              </button>
              <button
                className={button}
                disabled={locked}
                onClick={() => {
                  const reason = window.prompt(
                    "Record why this booking should be closed. This does not issue a refund.",
                  );
                  if (reason)
                    void action("resolve_payment", {
                      resolution: "cancel",
                      reason,
                    });
                }}
              >
                Close after payment review
              </button>
            </>
          )}
          {j.state === "confirmed" && (
            <button
              className={`${button} bg-navy-950 text-white`}
              disabled={locked}
              onClick={() => action("complete")}
            >
              Mark clean completed and send balance
            </button>
          )}
          {["offered", "confirmed", "change_pending"].includes(j.state) && (
            <button
              className={`${button} text-red-700`}
              disabled={locked}
              onClick={() => {
                if (
                  window.confirm(
                    "Cancel this appointment and send the customer a cancellation email? This does not issue a refund.",
                  )
                )
                  void action("cancel");
              }}
            >
              Cancel appointment
            </button>
          )}
          {view?.manageUrl && (
            <a
              className={button}
              href={view.manageUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open customer view
            </a>
          )}
          <button
            className={button}
            disabled={locked}
            onClick={() => {
              if (
                window.confirm(
                  "Revoke all existing private booking links? Send a new offer to provide a replacement link.",
                )
              )
                void action("revoke");
            }}
          >
            Revoke private links
          </button>
        </div>
      )}
      {j && ["offered", "expired"].includes(j.state) && j.snapshot?.paymentPlan === "deposit_after_agreement" && (
        <section className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4" aria-labelledby="bank-deposit-heading">
          <h3 id="bank-deposit-heading" className="font-semibold">Received the £30 by bank transfer?</h3>
          <p className="mt-2 text-sm">Check your bank account first. This records £30 against the booking, sends the customer their confirmation, alerts you by email and Telegram, and queues the Calendar update. If the hold expired or the customer requested a change, the payment is recorded for your review before any appointment is confirmed.</p>
          <label className="mt-3 block text-sm">Bank payment reference<input className={field} value={bankDepositReference} onChange={(e) => setBankDepositReference(e.target.value)} /></label>
          <label className="my-4 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={bankDepositReceived} onChange={(e) => setBankDepositReceived(e.target.checked)} />I checked the bank account and £30 has arrived for this booking.</label>
          <button className={`${button} bg-green-800 text-white`} disabled={locked || !bankDepositReceived || !bankDepositReference.trim()} onClick={() => action("manual_deposit", { amountPence: 3000, method: "bank_transfer", reference: bankDepositReference.trim(), receivedConfirmed: bankDepositReceived })}>Record £30 bank deposit and send confirmation</button>
        </section>
      )}
      {j?.state === "completed" && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Record an actual cash, bank or card balance payment
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Amount (£)
              <input
                className={field}
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Method
              <select
                className={field}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card terminal</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm">
              Unique payment reference
              <input
                className={field}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </label>
            <button
              className={button}
              disabled={locked || !paymentAmount || !paymentReference}
              onClick={() =>
                action("manual_payment", {
                  amountPence: Math.round(Number(paymentAmount) * 100),
                  method: paymentMethod,
                  reference: paymentReference,
                })
              }
            >
              Record payment and email receipt
            </button>
          </div>
        </details>
      )}
      {!!view?.notifications?.length && (
        <div className="mt-5">
          <h3 className="font-semibold text-navy-950">
            Email, Telegram and Calendar delivery
          </h3>
          <ul className="mt-2 space-y-2">
            {view.notifications.map((m) => (
              <li key={m.id} className="rounded-lg bg-silver-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {m.channel === "calendar" ? "Google Calendar" : m.channel === "telegram" ? "Your Telegram" : m.audience === "business" ? "Your email" : "Customer email"} · {m.kind.replace(/_/g, " ")} · <strong>{m.status}</strong>
                  </span>
                  {m.status === "failed" && (
                    <button
                      className={button}
                      disabled={locked}
                      onClick={() => action("retry", { messageId: m.id })}
                    >
                      Retry this delivery
                    </button>
                  )}
                </div>
                {m.last_error && (
                  <p className="mt-1 text-red-700">{m.last_error}</p>
                )}
                <p className="mt-1 text-xs text-navy-600">
                  {new Date(m.sent_at || m.created_at).toLocaleString("en-GB")}{" "}
                  · {m.attempts} attempt(s)
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!view?.payments?.length && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Payment and refund references
          </summary>
          <ul className="mt-2 space-y-2">
            {view.payments.map((p) => (
              <li
                key={p.external_id}
                className="rounded-lg bg-silver-100 p-3 text-sm"
              >
                <p>
                  {p.kind.replace(/_/g, " ")} · {money(p.amount_pence)} ·{" "}
                  {new Date(p.created_at).toLocaleString("en-GB")}
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {p.external_id}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!!view?.events?.length && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Agreement and payment history
          </summary>
          <ul className="mt-2 space-y-2">
            {view.events.map((e) => (
              <li
                key={e.id}
                className="border-b border-silver-200 py-2 text-sm"
              >
                <p>
                  {e.event_type.replace(/_/g, " ")} ·{" "}
                  {new Date(e.created_at).toLocaleString("en-GB")}
                </p>
                <details>
                  <summary className="text-xs text-navy-600">
                    Recorded changes · {e.actor}
                  </summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(e.details, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
