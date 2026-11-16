import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';
import type { InvoiceEmailQueueResponse, InvoiceEmail } from '../types/invoice';
import { formatMoney } from '../lib/format';
import { formatUkInstant } from '../lib/scheduleTime';

const LABELS: Record<string, string> = {
  scheduled: 'Scheduled', sending: 'Sending', held: 'On hold', uncertain: 'Unsure whether it sent',
};

// Every invoice email still waiting for its time or for the owner's decision.
// Renders nothing when scheduled sending is off or the queue is empty.
export default function ScheduledEmailsList() {
  const [emails, setEmails] = useState<InvoiceEmail[]>([]);

  useEffect(() => {
    let active = true;
    authFetch<InvoiceEmailQueueResponse>('/api/invoices?view=emailQueue')
      .then((data) => { if (active && data.enabled) setEmails(data.emails); })
      .catch(() => { /* The invoice list below still loads; each invoice shows its own email status. */ });
    return () => { active = false; };
  }, []);

  if (!emails.length) return null;
  const attention = emails.filter((e) => e.status === 'held' || e.status === 'uncertain');
  const waiting = emails.filter((e) => e.status === 'scheduled' || e.status === 'sending');

  const row = (e: InvoiceEmail, warn: boolean) => (
    <li key={e.id}>
      <Link to={`/invoices/${e.invoiceId}`} className={`block rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${warn ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-silver-300 bg-white text-navy-900 hover:border-sky-400'}`}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-semibold">{e.invoiceNumber || 'Invoice'} · {e.customerName || 'Customer'}</span>
          <span>{typeof e.amountDue === 'number' ? formatMoney(e.amountDue) : ''}</span>
        </span>
        <span className="block text-xs">{LABELS[e.status] || e.status} · {formatUkInstant(e.scheduledFor)} · {e.recipient}{e.reason ? ` · ${e.reason}` : ''}</span>
      </Link>
    </li>
  );

  return (
    <section className="mb-4" aria-labelledby="scheduled-emails-heading">
      <h2 id="scheduled-emails-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Invoice emails</h2>
      {attention.length > 0 && <ul className="mb-2 space-y-2" aria-label="Emails needing your decision">{attention.map((e) => row(e, true))}</ul>}
      {waiting.length > 0 && <ul className="space-y-2" aria-label="Scheduled emails">{waiting.map((e) => row(e, false))}</ul>}
    </section>
  );
}
