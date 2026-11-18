import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';

interface AttentionSummary {
  today: string;
  recentJobsFrom: string;
  yesterday: string;
  emailQueueEnabled: boolean;
  counts: Record<string, number | null>;
}

interface Item { key: string; label: (n: number) => string; href: string; urgent?: boolean }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The owner's next jobs, most time-sensitive first. Each line is a link to
// the place where it is dealt with. Nothing here changes any record.
export default function NeedsAttention() {
  const [summary, setSummary] = useState<AttentionSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const version = useRef(0);

  const load = useCallback(() => {
    const current = ++version.current;
    setFailed(false);
    authFetch<AttentionSummary>('/api/dashboard-summary?view=attention')
      .then((data) => {
        if (current !== version.current) return;
        // Anything other than the expected shape is treated as unavailable.
        if (data && typeof data === 'object' && data.counts && typeof data.counts === 'object') setSummary(data);
        else setFailed(true);
      })
      .catch(() => { if (current === version.current) setFailed(true); });
  }, []);

  useEffect(() => {
    load();
    return () => { version.current += 1; };
  }, [load]);

  if (failed) {
    return (
      <section className="mb-6 rounded-xl border border-silver-300 bg-white p-4 text-sm text-navy-700" aria-label="Needs attention">
        <p>Could not load your to-do list. Your bookings below are unaffected.</p>
        <button type="button" onClick={load} className="mt-2 min-h-11 rounded-lg border border-silver-300 px-3 font-semibold text-navy-900">Reload to-do list</button>
      </section>
    );
  }
  if (!summary) return null;

  const items: Item[] = [
    { key: 'emailsNeedingAttention', label: (n) => `${plural(n, 'invoice email needs', 'invoice emails need')} your decision`, href: '/invoices', urgent: true },
    { key: 'newEnquiries', label: (n) => `${plural(n, 'new enquiry', 'new enquiries')} to answer`, href: '/enquiries' },
    { key: 'requestsToReview', label: (n) => `${plural(n, 'booking request', 'booking requests')} to review and agree`, href: '/bookings?status=new&paymentStatus=pending_payment' },
    { key: 'depositsAwaited', label: (n) => `${plural(n, 'booking is', 'bookings are')} waiting for a deposit`, href: '/bookings?status=new&paymentStatus=pending_payment' },
    { key: 'jobsToComplete', label: (n) => `${plural(n, 'recent job', 'recent jobs')} not marked completed`, href: `/bookings?dateFrom=${summary.recentJobsFrom}&dateTo=${summary.yesterday}&sort=service_date` },
    { key: 'invoicesNotEmailed', label: (n) => `${plural(n, 'invoice', 'invoices')} issued but not emailed`, href: '/invoices?delivery=unsent' },
    { key: 'invoicesOverdue', label: (n) => `${plural(n, 'invoice is', 'invoices are')} overdue`, href: '/invoices?overdue=1', urgent: true },
  ];
  const active = items.filter((item) => (summary.counts[item.key] ?? 0) > 0);
  const unavailable = items.filter((item) => summary.counts[item.key] === null && (item.key !== 'emailsNeedingAttention' || summary.emailQueueEnabled));
  const scheduled = summary.counts.emailsScheduled ?? 0;
  const unpaid = summary.counts.invoicesUnpaid;

  return (
    <section className="mb-6 rounded-xl border border-silver-300 bg-white p-4" aria-labelledby="needs-attention-heading">
      <h2 id="needs-attention-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Needs attention</h2>
      {active.length === 0 && unavailable.length === 0 && <p className="text-sm text-navy-700">Nothing is waiting for you right now.</p>}
      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((item) => (
            <li key={item.key}>
              <Link to={item.href} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${item.urgent ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-silver-300 text-navy-950 hover:bg-silver-100'}`}>
                <span>{item.label(summary.counts[item.key] as number)}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {unavailable.length > 0 && (
        <p className="mt-2 text-xs text-navy-600">{unavailable.length === 1 ? 'One check' : `${unavailable.length} checks`} could not be loaded just now, so this list may be incomplete.</p>
      )}
      <p className="mt-3 text-sm text-navy-700">
        {typeof unpaid === 'number' && <Link to="/invoices?paymentStatus=unpaid&documentStatus=issued" className="text-sky-700 underline">{plural(unpaid, 'invoice', 'invoices')} awaiting payment</Link>}
        {typeof unpaid === 'number' && scheduled > 0 && ' · '}
        {scheduled > 0 && <Link to="/invoices" className="text-sky-700 underline">{plural(scheduled, 'email', 'emails')} scheduled</Link>}
      </p>
    </section>
  );
}
