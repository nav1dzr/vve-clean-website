import { useEffect, useState, type FormEvent } from "react";

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
  preparation: string;
  policyVersion?: string;
};
type Booking = {
  reference: string;
  firstName: string;
  revision: number;
  offerVersion: number;
  state: string;
  agreement: Agreement;
  previousAgreement: Agreement | null;
  holdUntil: string | null;
  paidPence: number;
  refundedPence: number;
  balancePence: number;
  customerRequest: { kind: string; date?: string; time?: string } | null;
  canPayDeposit: boolean;
  canPayBalance: boolean;
  canChange: boolean;
  canAccept: boolean;
};
type Response = { booking?: Booking; checkoutUrl?: string; error?: string };
const money = (p: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    p / 100,
  );
const inputClass =
  "mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900";
const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-semibold disabled:cursor-wait disabled:opacity-50";
const states: Record<string, { title: string; text: string }> = {
  draft: {
    title: "Your request is being arranged",
    text: "The team is reviewing your preferred service and time. No appointment is confirmed yet.",
  },
  offered: {
    title: "One step to confirm your clean",
    text: "Your agreed appointment is provisionally held. A £30 deposit confirms it and is deducted from your total.",
  },
  change_pending: {
    title: "Please review your revised arrangements",
    text: "Your original confirmed appointment remains in place until you accept these changes. Your existing payment stays credited.",
  },
  confirmed: {
    title: "Your booking is confirmed",
    text: "We look forward to helping. Your deposit is included in the amount paid below.",
  },
  expired: {
    title: "Your appointment hold has expired",
    text: "Please contact us to agree a new time. An expired unpaid hold is not a confirmed appointment.",
  },
  cancelled: {
    title: "Your booking is cancelled",
    text: "Your cancellation has been recorded. Any refund is handled separately under the agreed terms; cancellation alone is not proof of a refund.",
  },
  completed: {
    title: "Thank you for choosing VVE Clean",
    text: "Your clean has been marked completed. Any remaining balance is shown below.",
  },
  payment_review: {
    title: "Your payment needs a booking review",
    text: "We have recorded your payment. The team needs to check the latest arrangements before confirming the appointment. Please contact us.",
  },
};

function privateToken() {
  if (typeof window === "undefined") return "";
  const hashToken = new URLSearchParams(window.location.hash.slice(1)).get(
    "token",
  );
  if (hashToken) {
    try {
      sessionStorage.setItem("vve-private-booking-token", hashToken);
    } catch {
      /* The token remains in memory if storage is unavailable. */
    }
    window.history.replaceState(null, "", window.location.pathname);
    return hashToken;
  }
  try {
    return sessionStorage.getItem("vve-private-booking-token") || "";
  } catch {
    return "";
  }
}
export default function BookingManagementPage() {
  const [token] = useState(privateToken),
    [booking, setBooking] = useState<Booking | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState<"reschedule" | "cancel" | null>(null),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  async function request(
    operation?: string,
    extra: Record<string, unknown> = {},
  ) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/booking-management", {
        method: operation ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(operation ? { "Content-Type": "application/json" } : {}),
        },
        body: operation
          ? JSON.stringify({ operation, revision: booking?.revision, ...extra })
          : undefined,
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      const data = (await response.json()) as Response;
      if (!response.ok)
        throw new Error(
          data.error ||
            "We could not load your booking. Please contact the team.",
        );
      return data;
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          "The connection timed out. Refresh your booking to check its latest status before trying again.",
        );
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await request();
      if (data.booking) setBooking(data.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking unavailable.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    document.title = "Manage your booking | VVE Clean";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.appendChild(referrer);
    if (token) void refresh();
    else {
      setError(
        "Open the private booking link in your VVE Clean email. If you need a new link, contact the team.",
      );
      setLoading(false);
    }
    return () => {
      meta.remove();
      referrer.remove();
    };
    // The bearer token is captured once from the email fragment and removed
    // from the address bar before any links or customer actions are rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  async function act(operation: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(operation, extra);
      if (result.checkoutUrl) {
        const url = new URL(result.checkoutUrl);
        if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
          throw new Error(
            "Payment link could not be verified. Please contact us.",
          );
        window.location.assign(url.href);
        return;
      }
      if (result.booking) setBooking(result.booking);
      setPanel(null);
      setConfirmed(false);
      setNotice(
        operation === "reschedule"
          ? "Your rescheduling request is saved. We will contact you after checking availability."
          : operation === "cancel"
            ? "Your cancellation is saved. Check the booking status and your email for the details."
            : "Your revised arrangements have been accepted.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (panel) void act(panel, { confirm: confirmed, date, time, reason });
  }
  const summary = states[booking?.state || "draft"];
  const expired =
    booking?.state === "offered" &&
    booking.holdUntil &&
    new Date(booking.holdUntil) <= new Date();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="inline-block text-2xl font-bold text-slate-950"
          aria-label="VVE Clean home"
        >
          VVE <span className="text-blue-700">Clean</span>
        </a>
        <p className="mt-2 text-sm text-slate-600">Your private booking page</p>
        {loading && (
          <p role="status" className="mt-8 rounded-2xl bg-white p-6">
            Loading your booking…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
          >
            <p>{error}</p>
            {token && (
              <button
                type="button"
                onClick={refresh}
                className="mt-3 font-semibold underline"
                disabled={busy}
              >
                Refresh booking
              </button>
            )}
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950"
          >
            {notice}
          </p>
        )}
        {booking && !loading && (
          <>
            <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 px-6 py-8 text-white sm:px-8">
                <p className="text-sm text-blue-200">
                  Booking {booking.reference} · Version {booking.offerVersion}
                </p>
                <h1 className="mt-3 text-3xl font-bold leading-tight">
                  {expired ? "Your payment deadline has passed" : summary.title}
                </h1>
                <p className="mt-3 max-w-xl leading-relaxed text-slate-200">
                  {expired
                    ? "Please contact the team to check whether this appointment can still be held."
                    : summary.text}
                </p>
              </div>
              <div className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold">
                  {booking.agreement.service}
                </h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">
                  {booking.agreement.items}
                </p>
                <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">Appointment date</dt>
                    <dd className="mt-1 font-semibold">
                      {booking.agreement.date}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Arrival window</dt>
                    <dd className="mt-1 font-semibold">
                      {booking.agreement.time}{" "}
                      <span className="text-sm font-normal">(London time)</span>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Service address</dt>
                    <dd className="mt-1">
                      {booking.agreement.address}, {booking.agreement.postcode}
                    </dd>
                  </div>
                </dl>
                {booking.agreement.scope && (
                  <div className="mt-5">
                    <h3 className="font-semibold">Included scope</h3>
                    <p className="mt-2 whitespace-pre-line text-slate-700">
                      {booking.agreement.scope}
                    </p>
                  </div>
                )}
                {booking.agreement.exclusions && (
                  <div className="mt-5">
                    <h3 className="font-semibold">
                      Exclusions and agreed access costs
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-slate-700">
                      {booking.agreement.exclusions}
                    </p>
                  </div>
                )}
                {booking.agreement.preparation && (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <h3 className="font-semibold">
                      Getting ready for your clean
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-slate-700">
                      {booking.agreement.preparation}
                    </p>
                  </div>
                )}
                {booking.previousAgreement && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-semibold">
                      Your existing confirmed arrangement
                    </h3>
                    <p className="mt-2">
                      {booking.previousAgreement.date} ·{" "}
                      {booking.previousAgreement.time}
                    </p>
                    <p>
                      {booking.previousAgreement.service} ·{" "}
                      {money(booking.previousAgreement.totalPence)}
                    </p>
                    <p className="mt-2 text-sm">
                      This remains in place until you accept the revised details
                      above.
                    </p>
                  </div>
                )}
                <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                  <div className="flex justify-between">
                    <dt>Agreed total</dt>
                    <dd className="font-semibold">
                      {money(booking.agreement.totalPence)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Paid so far</dt>
                    <dd>{money(booking.paidPence)}</dd>
                  </div>
                  {booking.refundedPence > 0 && (
                    <div className="flex justify-between">
                      <dt>Refunded</dt>
                      <dd>{money(booking.refundedPence)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-lg">
                    <dt>
                      {booking.state === "cancelled"
                        ? "Unpaid part of original quote"
                        : "Remaining balance"}
                    </dt>
                    <dd className="font-semibold">
                      {money(booking.balancePence)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-sm text-slate-600">
                  {booking.state === "cancelled"
                    ? "The unpaid part of your quote is not a cancellation charge. Contact us about any refund due under the agreed terms."
                    : "The £30 deposit forms part of the agreed total. The remaining balance is due after the clean."}
                </p>
                {booking.state === "offered" && booking.holdUntil && (
                  <p className="mt-5 rounded-xl bg-blue-50 p-4 leading-relaxed text-blue-950">
                    Deposit deadline:{" "}
                    <strong>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/London",
                        dateStyle: "full",
                        timeStyle: "short",
                      }).format(new Date(booking.holdUntil))}{" "}
                      (London time)
                    </strong>
                    .
                  </p>
                )}
                {(booking.canPayDeposit || booking.canPayBalance) && (
                  <button
                    disabled={busy}
                    onClick={() => act("checkout")}
                    className={`${buttonClass} mt-5 w-full bg-blue-700 text-white hover:bg-blue-800`}
                  >
                    {busy
                      ? "Preparing…"
                      : booking.canPayDeposit
                        ? "Pay £30 deposit"
                        : `Pay ${money(booking.balancePence)} remaining balance`}
                  </button>
                )}
                {booking.canAccept && (
                  <button
                    disabled={busy}
                    onClick={() => act("accept_change", { confirm: true })}
                    className={`${buttonClass} mt-5 w-full bg-blue-700 text-white`}
                  >
                    Accept these revised arrangements
                  </button>
                )}
                {booking.customerRequest?.kind === "reschedule" && (
                  <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4">
                    Your request for {booking.customerRequest.date} ·{" "}
                    {booking.customerRequest.time} is with the team. Your
                    existing appointment has not changed.
                  </p>
                )}
                {booking.canChange && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      disabled={busy}
                      className={`${buttonClass} flex-1 border border-slate-300 bg-white`}
                      onClick={() => {
                        setPanel("reschedule");
                        setConfirmed(false);
                      }}
                    >
                      Request another time
                    </button>
                    <button
                      disabled={busy}
                      className={`${buttonClass} flex-1 border border-slate-300 bg-white text-red-700`}
                      onClick={() => {
                        setPanel("cancel");
                        setConfirmed(false);
                      }}
                    >
                      Cancel appointment
                    </button>
                  </div>
                )}
                <p className="mt-5 text-xs text-slate-500">
                  Agreement terms:{" "}
                  <a
                    className="underline"
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View terms
                  </a>
                  {booking.agreement.policyVersion
                    ? ` · version ${booking.agreement.policyVersion}`
                    : ""}
                  . Keep this link private.
                </p>
              </div>
            </section>
            {panel && (
              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-2xl font-semibold">
                  {panel === "cancel"
                    ? "Confirm cancellation"
                    : "Request a different time"}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  {panel === "cancel"
                    ? "This cancels your appointment. Any refund is reviewed separately under the agreed terms. No new cancellation fee is added by this page."
                    : "Tell us what works for you. We will check availability before changing your appointment."}
                </p>
                <form className="mt-5 space-y-4" onSubmit={submit}>
                  {panel === "reschedule" && (
                    <>
                      <label className="block">
                        Preferred date
                        <input
                          required
                          type="date"
                          className={inputClass}
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        Preferred arrival window
                        <input
                          required
                          className={inputClass}
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          maxLength={80}
                        />
                      </label>
                    </>
                  )}
                  <label className="block">
                    {panel === "cancel"
                      ? "Reason (optional)"
                      : "Anything else we should know (optional)"}
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={1000}
                    />
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      required
                      className="mt-1 h-5 w-5"
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>
                      {panel === "cancel"
                        ? "I want to cancel this appointment."
                        : "I understand the team must confirm availability before my appointment changes."}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={busy || !confirmed}
                      className={`${buttonClass} ${panel === "cancel" ? "bg-red-700" : "bg-blue-700"} text-white`}
                    >
                      {panel === "cancel"
                        ? "Confirm cancellation"
                        : "Send rescheduling request"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={`${buttonClass} border border-slate-300`}
                      onClick={() => setPanel(null)}
                    >
                      Keep current booking
                    </button>
                  </div>
                </form>
              </section>
            )}
          </>
        )}
        <footer className="mt-8 text-center leading-relaxed text-slate-600">
          <p>
            Need a hand?{" "}
            <a
              className="font-semibold text-blue-800 underline"
              href="tel:02080502233"
            >
              020 8050 2233
            </a>
          </p>
          <p>
            <a href="mailto:contact@vveclean.co.uk" className="underline">
              contact@vveclean.co.uk
            </a>
          </p>
          <p className="mt-3 text-xs">
            Opening this page does not charge you or change your appointment.
          </p>
        </footer>
      </div>
    </main>
  );
}
