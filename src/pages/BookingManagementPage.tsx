import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock3, MapPin } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { applyRouteMetadata } from "../lib/routeMetadata";
import { bookingContent, friendlyBookingDate } from "../../admin/shared/bookingPresentation.js";

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
  accessNotes?: string;
  policyVersion?: string;
  paymentPlan?: string;
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
  paymentInstructions?: {
    due: "after_clean" | "deposit";
    bank: { accountName: string; sortCode: string; accountNumber: string; reference: string } | null;
  } | null;
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
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600 disabled:cursor-wait disabled:opacity-50";
const states: Record<string, { title: string; text: string }> = {
  draft: {
    title: "Your request is being arranged",
    text: "The team is reviewing your preferred service and time. No appointment is confirmed yet.",
  },
  offered: {
    title: "Please check your booking details",
    text: "Check your cleaning, date and arrival time below. If anything needs changing, let us know before we confirm your appointment.",
  },
  change_pending: {
    title: "Please review your revised arrangements",
    text: "Your original confirmed appointment remains in place until you accept these changes. Your existing payment stays credited.",
  },
  confirmed: {
    title: "Your clean is booked",
    text: "You're all set. Your appointment details are below. We look forward to seeing you.",
  },
  expired: {
    title: "Your appointment hold has expired",
    text: "Please contact us to agree a new time. This expired hold is not a confirmed appointment.",
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

function depositAvailable(booking: Booking | null) {
  return !!booking && booking.canPayDeposit && booking.state === "offered" &&
    booking.agreement.paymentPlan === "deposit_after_agreement" && !booking.customerRequest &&
    booking.paidPence === 0 && !!booking.holdUntil && new Date(booking.holdUntil) > new Date();
}

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
  const [payFromEmail] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.hash.slice(1)).get("pay") === "deposit");
  const automaticCheckoutAttempted = useRef(false);
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
      if (!data.booking) throw new Error("We could not load your booking details. Please refresh or contact the team.");
      setBooking(data.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking unavailable.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    applyRouteMetadata("/manage-booking");
    if (token) void refresh();
    else {
      setError(
        "Open the private booking link in your VVE Clean email. If you need a new link, contact the team.",
      );
      setLoading(false);
    }
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
            ? "Your cancellation request is with the team. We will email you when it is confirmed."
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
  useEffect(() => {
    if (!payFromEmail || loading || !booking || automaticCheckoutAttempted.current) return;
    automaticCheckoutAttempted.current = true;
    if (depositAvailable(booking)) void act("checkout");
    // Only an explicit Pay link in the email initiates checkout, once. A normal
    // booking link remains read-only. The server rechecks the saved agreement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payFromEmail, loading, booking]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (panel) void act(panel, { confirm: confirmed, date, time, reason });
  }
  const summary = states[booking?.state || "draft"] || {
    title: "Please check your booking with the team",
    text: "We could not display the current appointment status. Contact VVE Clean before making further arrangements.",
  };
  const expired =
    booking?.state === "offered" &&
    booking.holdUntil &&
    new Date(booking.holdUntil) <= new Date();
  const depositPayable = depositAvailable(booking);
  const content = booking ? bookingContent(booking.agreement) : null;
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-5 px-1">
          <a href="/" className="inline-block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600" aria-label="VVE Clean home">
            <BrandLogo compact />
          </a>
          <p className="text-right text-sm text-slate-600">Your private<br className="sm:hidden" /> booking page</p>
        </header>
        {(!booking || loading) && (
          <h1 className="mt-7 text-3xl font-bold leading-tight">Manage your booking</h1>
        )}
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
                disabled={busy || loading}
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
        {booking && content && !loading && (
          <>
            <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-sky-100 bg-sky-50 px-5 py-7 sm:px-8 sm:py-8">
                <p className="break-words text-sm font-medium text-royal-700">
                  Booking {booking.reference}
                </p>
                <h1 className="mt-3 text-2xl font-bold leading-tight text-navy-950 sm:text-3xl">
                  {expired ? "Please check your appointment with the team" : summary.title}
                </h1>
                <p className="mt-3 max-w-xl leading-relaxed text-slate-700">
                  {expired
                    ? "Please contact the team to check whether this appointment can still be held."
                    : depositPayable
                      ? "Happy with the details below? Pay the £30 deposit to secure your slot. If you need a different time or any changes, let us know first."
                    : summary.text}
                </p>
              </div>
              <div className="p-5 sm:p-8">
                <dl className="grid gap-5 border-b border-slate-200 pb-6 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-royal-600" />
                    <div>
                      <dt className="text-sm text-slate-600">Appointment date</dt>
                      <dd className="mt-1 font-semibold text-navy-950">
                        {friendlyBookingDate(booking.agreement.date)}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-royal-600" />
                    <div>
                      <dt className="text-sm text-slate-600">Arrival window</dt>
                      <dd className="mt-1 font-semibold text-navy-950">
                        {booking.agreement.time}{" "}
                        <span className="text-sm font-normal text-slate-600">(London time)</span>
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-royal-600" />
                    <div>
                      <dt className="text-sm text-slate-600">Service address</dt>
                      <dd className="mt-1 leading-relaxed">
                        {booking.agreement.address}, {booking.agreement.postcode}
                      </dd>
                    </div>
                  </div>
                </dl>
                <section className="mt-6" aria-labelledby="cleaning-heading">
                  <h2 id="cleaning-heading" className="text-xl font-semibold text-navy-950">Your cleaning includes</h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">{booking.agreement.service}</p>
                  <ul className="mt-4 space-y-3">
                    {content.cleaning.map((item, index) => (
                      <li key={`${index}-${item}`} className="flex items-start gap-3 leading-relaxed text-slate-700">
                        <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-success" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                {content.access.length > 0 && (
                  <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="access-heading">
                    <h3 id="access-heading" className="font-semibold">Parking and access costs</h3>
                    <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
                      {content.access.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                    </ul>
                  </section>
                )}
                {content.details && (
                  <div className="mt-5">
                    <h3 className="font-semibold">Additional details</h3>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">
                      {content.details}
                    </p>
                  </div>
                )}
                {content.exclusions && (
                  <div className="mt-5">
                    <h3 className="font-semibold">Not included</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {content.exclusions}
                    </p>
                  </div>
                )}
                {booking.previousAgreement && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-semibold">
                      Your existing confirmed arrangement
                    </h3>
                    <p className="mt-2">
                      {friendlyBookingDate(booking.previousAgreement.date)} ·{" "}
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
                <section className="mt-7 rounded-2xl border border-sky-100 bg-sky-50 p-5" aria-labelledby="payment-heading">
                  <h2 id="payment-heading" className="font-semibold text-navy-950">{depositPayable ? "Secure your appointment" : "Payment summary"}</h2>
                  <dl className="mt-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt>Total</dt>
                      <dd className="shrink-0 font-semibold">
                        {money(booking.agreement.totalPence)}
                      </dd>
                    </div>
                    {depositPayable && (
                      <div className="flex items-baseline justify-between gap-4 text-royal-700">
                        <dt className="font-semibold">Deposit due now</dt>
                        <dd className="shrink-0 text-xl font-bold">£30.00</dd>
                      </div>
                    )}
                    {booking.paidPence > 0 && (
                      <div className="flex items-baseline justify-between gap-4">
                        <dt>Paid</dt>
                        <dd className="shrink-0">{money(booking.paidPence)}</dd>
                      </div>
                    )}
                    {booking.refundedPence > 0 && (
                      <div className="flex items-baseline justify-between gap-4">
                        <dt>Refunded</dt>
                        <dd className="shrink-0">{money(booking.refundedPence)}</dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-4 border-t border-sky-200 pt-3">
                      <dt>
                        {booking.state === "cancelled"
                          ? "Unpaid part of original quote"
                          : depositPayable ? "Balance after deposit" : "Remaining balance"}
                      </dt>
                      <dd className="shrink-0 font-semibold">
                        {money(depositPayable ? Math.max(0, booking.agreement.totalPence - 3000) : booking.balancePence)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {booking.state === "cancelled"
                      ? "The unpaid part of your quote is not a cancellation charge. Contact us about any refund due under the agreed terms."
                      : depositPayable
                        ? "Your deposit is part of the total. The balance shown will be due on the day of your clean once the deposit is received."
                        : ["confirmed", "completed", "change_pending"].includes(booking.state) && booking.balancePence > 0
                          ? "The remaining balance is due on the day of your clean. Any payment received is already included above."
                          : ["confirmed", "completed"].includes(booking.state) && booking.balancePence === 0 && booking.paidPence > 0 && booking.refundedPence === 0
                            ? "Your total is paid in full. Thank you."
                            : "Please check the appointment details with the team before making a payment."}
                  </p>
                  {depositPayable && booking.holdUntil && (
                    <p className="mt-3 text-sm font-semibold text-navy-950">
                      Please pay by {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(booking.holdUntil))} (London time).
                    </p>
                  )}
                  {(depositPayable || booking.canPayBalance) && (
                    <button
                      disabled={busy}
                      onClick={() => act("checkout")}
                      className={`${buttonClass} mt-5 w-full bg-royal-500 text-white hover:bg-royal-600`}
                    >
                      {busy
                        ? "Preparing…"
                        : depositPayable ? "Pay £30 deposit by card" : `Pay ${money(booking.balancePence)} remaining balance`}
                    </button>
                  )}
                </section>
                {booking.paymentInstructions && (depositPayable || ["confirmed", "completed"].includes(booking.state)) && booking.balancePence > 0 && (
                  <section className="mt-4 rounded-2xl border border-slate-200 p-5" aria-labelledby="bank-payment-heading">
                    <h3 id="bank-payment-heading" className="font-semibold">{depositPayable ? "Prefer a bank transfer?" : "Bank transfer details"}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {depositPayable ? "Transfer £30 with the reference below. We'll email your confirmation once we've checked receipt." : booking.state === "completed"
                        ? "Use these details to pay your remaining balance."
                        : "Your appointment is confirmed; no payment is needed now. Use these details on the day of your clean. Card payment will be available here once the team marks the clean complete."}
                    </p>
                    {booking.paymentInstructions.bank ? (
                      <>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                          {Object.entries({ "Account name": booking.paymentInstructions.bank.accountName, "Sort code": booking.paymentInstructions.bank.sortCode, "Account number": booking.paymentInstructions.bank.accountNumber, "Payment reference": booking.paymentInstructions.bank.reference }).map(([label, value]) => (
                            <div key={label} className={label === "Payment reference" ? "col-span-2 rounded-lg bg-slate-50 p-3" : "min-w-0"}><dt className="text-slate-600">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>
                          ))}
                        </dl>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">Already transferred? Please don’t pay again while we check receipt.</p>
                      </>
                    ) : <p className="mt-3 text-sm">Please contact the team for bank-transfer details.</p>}
                  </section>
                )}
                {booking.canAccept && (
                  <button
                    disabled={busy}
                    onClick={() => act("accept_change", { confirm: true })}
                    className={`${buttonClass} mt-5 w-full bg-royal-500 text-white hover:bg-royal-600`}
                  >
                    Accept these revised arrangements
                  </button>
                )}
                {booking.customerRequest?.kind === "reschedule" && (
                  <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4">
                    Your request for {friendlyBookingDate(booking.customerRequest.date || "")} ·{" "}
                    {booking.customerRequest.time} is with the team. Your
                    existing appointment has not changed.
                  </p>
                )}
                {booking.customerRequest?.kind === "cancel" && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4">Your cancellation request is with the team. Payment is paused until we have reviewed it.</p>}
                {booking.canChange && (
                  <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:gap-3">
                    <button
                      disabled={busy}
                      className={`${buttonClass} flex-1 border border-slate-300 bg-white text-royal-700 hover:bg-slate-50`}
                      onClick={() => {
                        setPanel("reschedule");
                        setConfirmed(false);
                      }}
                    >
                      Request another time
                    </button>
                    <button
                      disabled={busy}
                      className={`${buttonClass} flex-1 bg-white text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-red-700`}
                      onClick={() => {
                        setPanel("cancel");
                        setConfirmed(false);
                      }}
                    >
                      Request cancellation
                    </button>
                  </div>
                )}
                {booking.agreement.preparation && !["cancelled", "completed"].includes(booking.state) && (
                  <aside className="mt-6 rounded-xl border-l-4 border-sky-200 bg-slate-50 p-4">
                    <h3 className="font-semibold">Getting ready for your clean</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {booking.agreement.preparation}
                    </p>
                  </aside>
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
                    ? "Request cancellation"
                    : "Request a different time"}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  {panel === "cancel"
                    ? "Send your cancellation request to the team. We will email you when the cancellation is confirmed. Any refund is reviewed separately; this request does not issue a refund."
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
                        ? "Send cancellation request"
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
          <p className="mt-2">
            <a href="https://wa.me/447845451111" className="font-semibold text-blue-800 underline">
              Message us on WhatsApp
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
