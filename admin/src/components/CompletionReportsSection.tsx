import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';
import type { CompletionReport } from '../types/completionReport';

export default function CompletionReportsSection({ bookingId, customerId }: { bookingId?: string; customerId?: string }) {
  const [reports, setReports] = useState<CompletionReport[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams(bookingId ? { bookingId } : customerId ? { customerId } : {}).toString();
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    authFetch<{ reports: CompletionReport[]; hasMore?: boolean }>(`/api/customers?resource=completion-reports&${query}`)
      .then(({ reports: list, hasMore: more }) => { if (active) { setReports(list); setHasMore(Boolean(more)); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, retry]);
  return <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold text-navy-950">Cleaning completion reports</h2>
      <Link className="flex min-h-11 items-center rounded-lg border border-silver-300 px-3 text-sm font-semibold" to={`/completion-reports?new=1&${query}`}>Create completion report</Link>
    </div>
    <p className="my-3 text-sm text-navy-600">Record the work actually completed and share a report with photographs. Invoices and receipts stay separate.</p>
    {loading && <p role="status" className="text-sm">Loading reports…</p>}
    {error && <div role="alert" className="text-sm text-red-700">{error} <button className="min-h-11 underline" onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
    {!loading && !error && (reports.length ? <ul className="divide-y divide-silver-200">{reports.map(report => <li key={report.id} className="py-3"><Link className="flex justify-between gap-3 text-sm text-navy-950 underline" to={`/completion-reports?id=${encodeURIComponent(report.id)}`}><span>{report.payload.jobReference || report.payload.customerName || 'Cleaning report'} · {report.payload.serviceDate || 'Date not set'}</span><span className="capitalize">{report.status}</span></Link></li>)}</ul> : <p className="text-sm text-navy-500">No reports yet.</p>)}
    {hasMore && <Link className="mt-3 inline-flex min-h-11 items-center text-sm underline" to={`/completion-reports?${query}`}>View all reports</Link>}
  </section>;
}
