import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "../lib/authFetch";
import type { BookingDetail } from "../types/booking";

type Agreement = {
  service: string;
  items: string;
  scope: string;
  exclusions: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  totalPence: number;
  changeReason: string;
  preparation: string;
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
  "mt-1 block min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-sm text-navy-950";
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
    service: booking.service || "",
    items: booking.service || "",
    scope: "",
    exclusions: "",
    address: booking.address || "",
    postcode: booking.postcode || "",
    date: booking.serviceDate || booking.preferredDate || "",
    time: booking.preferredTime || "",
    totalPence: Math.round((booking.totalPrice || 0) * 100),
    changeReason: "",
    preparation: "",
  };
  const [view, setView] = useState<View | null>(null),
    [agreement, setAgreement] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [checked, setChecked] = useState(false),
    [deadline, setDeadline] = useState(""),
    [paymentAmount, setPaymentAmount] = useState(""),
    [paymentReference, setPaymentReference] = useState(""),
    [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const endpoint = `/api/bookings/${booking.id}?action=journey`;
  useEffect(() => {
    let active = true;
    authFetch<View>(endpoint)
      .then((data) => {
        if (active) {
          setView(data);
          if (data.journey) setAgreement(data.journey.draft);
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
      if (result.journey) setAgreement(result.journey.draft);
      setNotice(
        result.deliveries?.some((d) => d.status === "failed")
          ? "Booking saved. An email could not be delivered; review and retry below."
          : operation === "draft"
            ? "Agreement saved. Preview the email before sending."
            : "Booking action saved. Delivery status is shown below.",
      );
      if (operation === "draft" || operation === "preview") setPreview(true);
      if (["send", "complete", "cancel", "manual_payment"].includes(operation))
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
    void action("draft", { agreement });
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
            Agree the details, send a £30 deposit request, then track payment
            and customer changes here.
          </p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-900">
          {statusLabels[j?.state || "draft"]}
        </span>
      </div>
      {!view?.enabled && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Sending is disabled until the booking migration, Stripe test payment
          and test email delivery have been checked.
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
          <div>
            <dt className="text-xs text-navy-500">Paid</dt>
            <dd>{money(j.paid_pence)}</dd>
          </div>
          <div>
            <dt className="text-xs text-navy-500">Refunded</dt>
            <dd>{money(j.refunded_pence)}</dd>
          </div>
          <div>
            <dt className="text-xs text-navy-500">Balance</dt>
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
            Agreed total (£)
            <input
              required
              className={field}
              type="number"
              min="30"
              step="0.01"
              value={agreement.totalPence / 100}
              onChange={(e) =>
                update("totalPence", Math.round(Number(e.target.value) * 100))
              }
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Included items and quantities
            <textarea
              required
              className={field}
              rows={3}
              value={agreement.items}
              onChange={(e) => update("items", e.target.value)}
              maxLength={3000}
            />
          </label>
          <label className="text-sm">
            Included scope
            <textarea
              className={field}
              rows={3}
              value={agreement.scope}
              onChange={(e) => update("scope", e.target.value)}
              maxLength={3000}
            />
          </label>
          <label className="text-sm">
            Exclusions / agreed access costs
            <textarea
              className={field}
              rows={3}
              value={agreement.exclusions}
              onChange={(e) => update("exclusions", e.target.value)}
              maxLength={2000}
            />
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
          <label className="text-sm sm:col-span-2">
            Preparation / access instructions
            <textarea
              className={field}
              rows={2}
              value={agreement.preparation}
              onChange={(e) => update("preparation", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Reason for agreed scope, price or changes
            <textarea
              required
              className={field}
              rows={2}
              value={agreement.changeReason}
              onChange={(e) => update("changeReason", e.target.value)}
              placeholder="Record what was agreed during your conversation."
            />
          </label>
          <p className="text-xs text-navy-600 sm:col-span-2">
            Saving a draft leaves the customer's current offer unchanged.
            Sending a revised paid booking asks for acceptance and keeps the
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
                : action(
                    "preview",
                    deadline
                      ? { holdUntil: new Date(deadline).toISOString() }
                      : {},
                  )
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
                This is a preview. Links in it are disabled. Check the final
                deadline before sending.
              </p>
            </>
          )}
          {!["cancelled", "completed", "payment_review"].includes(
            j?.state || "",
          ) && (
            <div className="mt-4 space-y-3">
              {paid < 3000 && (
                <label className="block text-sm">
                  Payment deadline (optional; default 48 hours)
                  <input
                    className={`${field} max-w-sm`}
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(e.target.value);
                      setPreview(false);
                      setChecked(false);
                    }}
                  />
                  <span className="mt-1 block text-xs text-navy-600">
                    Your device's local time. Choose an explicit deadline before
                    arrival for near-term jobs.
                  </span>
                </label>
              )}
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
                    ...(view.previewHoldUntil && paid < 3000
                      ? { holdUntil: view.previewHoldUntil }
                      : {}),
                  })
                }
              >
                {paid >= 3000
                  ? "Send revised details for acceptance"
                  : "Send £30 deposit request"}
              </button>
            </div>
          )}
        </div>
      )}
      {j && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-silver-200 pt-4">
          {j.state === "offered" && (
            <>
              <button
                className={button}
                disabled={locked}
                onClick={() => action("remind")}
              >
                Send deposit reminder
              </button>
              {j.hold_until && new Date(j.hold_until) < new Date() && (
                <button
                  className={button}
                  disabled={locked}
                  onClick={() => action("expire")}
                >
                  Close expired hold
                </button>
              )}
            </>
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
            Email delivery history
          </h3>
          <ul className="mt-2 space-y-2">
            {view.notifications.map((m) => (
              <li key={m.id} className="rounded-lg bg-silver-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {m.kind.replace(/_/g, " ")} · <strong>{m.status}</strong>
                  </span>
                  {m.status === "failed" && (
                    <button
                      className={button}
                      disabled={locked}
                      onClick={() => action("retry", { messageId: m.id })}
                    >
                      Retry this email
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
