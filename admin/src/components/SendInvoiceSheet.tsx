import { useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InvoiceDetail, InvoiceEmail, InvoiceEmailActionResponse } from '../types/invoice';
import { formatMoney } from '../lib/format';
import { suggestSendTimes, formatUkDateTime, formatUkDate, SEND_TIME_OPTIONS, londonNow, addDays } from '../lib/scheduleTime';

interface Props {
  invoice: InvoiceDetail;
  /** Start on "Schedule send" (e.g. straight after "Issue and schedule email"). */
  startScheduled?: boolean;
  /** When set, the sheet only changes the time of this waiting email. */
  reschedule?: InvoiceEmail;
  onClose: () => void;
  onDone: (result: InvoiceEmailActionResponse, summary: string) => void;
}

// Sends or schedules the email for an ISSUED invoice. Saving a draft, issuing
// an invoice and emailing it are three separate steps; this is only the third.
export default function SendInvoiceSheet({ invoice, startScheduled = false, reschedule, onClose, onDone }: Props) {
  const suggestions = useRef(suggestSendTimes()).current;
  // One id for the life of this sheet: a second tap or a retry after a lost
  // response is the same email to the server, never another one.
  const requestId = useRef(crypto.randomUUID()).current;
  const [mode, setMode] = useState<'now' | 'schedule'>(startScheduled || reschedule ? 'schedule' : 'now');
  const [to, setTo] = useState(reschedule?.recipient || invoice.invoiceRecipientEmail || invoice.customer.email || '');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(suggestions[0].date);
  const [time, setTime] = useState(suggestions[0].time);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const today = londonNow().date;
  const whenLabel = formatUkDateTime(date, time);
  const instructions = invoice.paymentInstructions;
  const paymentSummary = !instructions ? 'Not available'
    : instructions.paymentOption === 'both' ? 'Bank transfer and card link'
    : instructions.paymentOption === 'bank_transfer' ? 'Bank transfer' : 'Card link';
  const submitLabel = reschedule ? `Move to ${whenLabel}`
    : mode === 'now' ? 'Send now' : `Schedule for ${whenLabel}`;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    if (!reschedule && !to.trim()) { setError('Enter a recipient email address.'); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = reschedule
        ? { op: 'reschedule', id: reschedule.id, date, time }
        : mode === 'now'
          ? { op: 'sendNow', id: requestId, to: to.trim(), message: message.trim() || undefined }
          : { op: 'schedule', id: requestId, date, time, to: to.trim(), message: message.trim() || undefined };
      const result = await authFetch<InvoiceEmailActionResponse>(`/api/invoices/${invoice.id}?action=emailQueue`, {
        method: 'POST', body: JSON.stringify(body),
      });
      const summary = result.outcome === 'sent' ? `Sent to ${result.email.recipient}.`
        : result.outcome === 'uncertain' || result.outcome === 'held' ? (result.warning || 'This email needs your attention.')
        : `Email scheduled for ${whenLabel} (UK time) to ${result.email.recipient}.`;
      onDone(result, summary);
    } catch (err) {
      setError(err instanceof ApiError
        ? (err.status === 0 ? `${err.message} If you try again, the same request is reused, so the customer cannot receive it twice.` : err.message)
        : 'Could not complete this. Nothing was sent.');
      setBusy(false);
      inFlight.current = false;
    }
  }

  const fieldClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1.5 block text-sm font-medium text-navy-900';

  return (
    <Modal titleId="send-invoice-sheet-title" title={reschedule ? 'Change the send time' : `Send invoice ${invoice.invoiceNumber || ''}`} onClose={onClose}>
      <form onSubmit={submit}>
        <dl className="mb-4 space-y-1.5 rounded-lg border border-silver-300 bg-silver-50 p-3 text-sm">
          <SummaryRow label="Subject" value={`Invoice ${invoice.invoiceNumber || ''} from VVE Clean`} />
          <SummaryRow label="Amount due" value={formatMoney(invoice.amountDue)} strong />
          <SummaryRow label="Invoice total" value={formatMoney(invoice.total)} />
          {invoice.depositApplied > 0 && <SummaryRow label="Deposit already paid" value={formatMoney(invoice.depositApplied)} />}
          <SummaryRow label="Due date" value={formatUkDate(invoice.dueDate)} />
          <SummaryRow label="Attached" value={`${invoice.invoiceNumber || 'Invoice'}.pdf`} />
          <SummaryRow label="Payment details" value={paymentSummary} />
        </dl>

        {!reschedule && (
          <>
            <label htmlFor="send-sheet-to" className={labelClass}>Send to</label>
            <input id="send-sheet-to" type="email" required autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} className={`mb-3 ${fieldClass}`} />

            <label htmlFor="send-sheet-message" className={labelClass}>Message (optional)</label>
            <textarea id="send-sheet-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={2000}
              className="mb-4 w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />

            <fieldset className="mb-3">
              <legend className={labelClass}>When</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['now', 'Send now'], ['schedule', 'Schedule send']] as const).map(([value, label]) => (
                  <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold ${mode === value ? 'border-navy-950 bg-navy-950 text-white' : 'border-silver-300 text-navy-900'}`}>
                    <input type="radio" name="send-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {mode === 'schedule' && (
          <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s.label} type="button" onClick={() => { setDate(s.date); setTime(s.time); }}
                  aria-pressed={date === s.date && time === s.time}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${date === s.date && time === s.time ? 'border-sky-700 bg-sky-700 text-white' : 'border-sky-300 bg-white text-navy-900'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-medium text-navy-900">Date
                <input type="date" required value={date} min={today} max={addDays(today, 60)} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${fieldClass}`} />
              </label>
              <label className="text-sm font-medium text-navy-900">Time
                <select value={time} onChange={(e) => setTime(e.target.value)} className={`mt-1 ${fieldClass}`}>
                  {SEND_TIME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-2 text-sm text-navy-800">
              <strong>{whenLabel}</strong> UK time. It goes within a few minutes of that time. If the invoice is paid, changed or voided first, the email is held or cancelled and nothing is sent.
            </p>
          </div>
        )}

        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}

        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-navy-700">{label}</dt>
      <dd className={`min-w-0 break-words text-right ${strong ? 'font-semibold text-navy-950' : 'text-navy-950'}`}>{value}</dd>
    </div>
  );
}
