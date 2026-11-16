import { useState } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InvoiceEmail, InvoiceEmailActionResponse } from '../types/invoice';
import { formatUkInstant } from '../lib/scheduleTime';

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  emails: InvoiceEmail[];
  onChanged: (notice: string) => void;
  onEditTime: (email: InvoiceEmail) => void;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent', uncertain: 'Unsure', held: 'On hold', cancelled: 'Not sent',
};

// Shows the email that is waiting (if any) with its actions, then the history
// of every send for this invoice: who, when and what happened.
export default function InvoiceEmailPanel({ invoiceId, invoiceNumber, emails, onChanged, onEditTime }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = emails.find((e) => ['scheduled', 'sending', 'held', 'uncertain'].includes(e.status));
  const past = emails.filter((e) => e !== open);

  async function act(op: string, id: string, notice: string, confirmText?: string) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authFetch<InvoiceEmailActionResponse>(`/api/invoices/${invoiceId}?action=emailQueue`, {
        method: 'POST', body: JSON.stringify({ op, id }),
      });
      onChanged(result.outcome === 'sent' ? `Sent to ${result.email.recipient}.` : result.warning || notice);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this. Reload to check the email status.');
    } finally {
      setBusy(false);
    }
  }

  if (!emails.length) return null;
  const button = 'min-h-11 rounded-lg border px-3 text-sm font-medium disabled:opacity-60';

  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4" aria-labelledby="invoice-emails-heading">
      <h2 id="invoice-emails-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Invoice emails</h2>

      {open?.status === 'scheduled' && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-navy-900">
          <p><strong>Scheduled for {formatUkInstant(open.scheduledFor)}</strong> (UK time) to {open.recipient}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onEditTime(open)} className={`${button} border-sky-300 bg-white`}>Edit time</button>
            <button type="button" disabled={busy} onClick={() => void act('sendExisting', open.id, 'Email sent.', `Send this invoice to ${open.recipient} now?`)} className={`${button} border-sky-300 bg-white`}>Send now</button>
            <button type="button" disabled={busy} onClick={() => void act('cancel', open.id, 'Scheduled email cancelled. Nothing was sent.', 'Cancel this scheduled email? Nothing will be sent.')} className={`${button} border-red-300 bg-white text-red-700`}>Cancel schedule</button>
          </div>
        </div>
      )}

      {open?.status === 'held' && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Email on hold — nothing was sent</p>
          <p className="mt-1">{open.reason} It was due {formatUkInstant(open.scheduledFor)} to {open.recipient}. Check the invoice above, then choose what to do.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void act('sendExisting', open.id, 'Email sent.', `Send this invoice as it is now to ${open.recipient}?`)} className={`${button} border-amber-400 bg-white`}>Send now</button>
            <button type="button" disabled={busy} onClick={() => onEditTime(open)} className={`${button} border-amber-400 bg-white`}>Choose a new time</button>
            <button type="button" disabled={busy} onClick={() => void act('cancel', open.id, 'Email cancelled. Nothing was sent.')} className={`${button} border-amber-400 bg-white`}>Cancel it</button>
          </div>
        </div>
      )}

      {open?.status === 'uncertain' && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">We could not confirm this email was sent</p>
          <p className="mt-1">It was attempted {formatUkInstant(open.attemptedAt)} to {open.recipient}. Open Sent mail in Gmail and look for {invoiceNumber}. It will not be sent again unless you say so.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void act('markSent', open.id, 'Recorded as sent.')} className={`${button} border-amber-400 bg-white`}>It did send</button>
            <button type="button" disabled={busy} onClick={() => void act('markNotSent', open.id, 'Recorded as not sent. You can now send it again.', 'Confirm you checked Sent mail and this invoice is not there?')} className={`${button} border-amber-400 bg-white`}>It did not send</button>
          </div>
        </div>
      )}

      {open?.status === 'sending' && (
        <p role="status" className="rounded-lg bg-silver-100 p-3 text-sm text-navy-800">Sending to {open.recipient}… Reload in a moment to see the result.</p>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      {past.length > 0 && (
        <ul className={`space-y-2 text-sm ${open ? 'mt-3 border-t border-silver-200 pt-3' : ''}`}>
          {past.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-navy-800">
                <strong className="font-medium text-navy-950">{STATUS_LABELS[e.status] || e.status}</strong> · {e.recipient}
                {e.reason && <span className="block text-xs text-navy-600">{e.reason}</span>}
              </span>
              <span className="shrink-0 text-xs text-navy-500">{formatUkInstant(e.sentAt || e.scheduledFor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
