import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { ReceiptListResponse } from '../types/invoice';
import ReceiptCardItem from '../components/ReceiptCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import { formatMoney, formatServiceDate } from '../lib/format';

const PAGE_SIZE = 20;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ReceiptListResponse };

export default function ReceiptListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = Number.parseInt(searchParams.get('page') || '1', 10) || 1;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [localQuery, setLocalQuery] = useState(q);

  function load() {
    setState({ status: 'loading' });
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    qs.set('page', String(page));
    qs.set('pageSize', String(PAGE_SIZE));
    authFetch<ReceiptListResponse>(`/api/receipts?${qs.toString()}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load receipts.' }));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [searchParams]);

  function applySearch() {
    const next = new URLSearchParams(searchParams);
    if (localQuery) next.set('q', localQuery);
    else next.delete('q');
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  }

  const totalPages = state.status === 'success' ? Math.max(1, Math.ceil(state.data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="px-4 py-6 sm:px-6">
      <h1 className="mb-4 font-semibold text-xl text-navy-950">Receipts</h1>

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={localQuery}
          placeholder="Search receipt number or customer…"
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          className="min-h-11 flex-1 rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
        />
        <button type="button" onClick={applySearch} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900">
          Search
        </button>
      </div>

      {state.status === 'loading' && <CardListSkeleton count={5} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.data.results.length === 0 && (
        <EmptyState title="No receipts yet" description="Receipts are created automatically once an invoice is paid in full." />
      )}
      {state.status === 'success' && state.data.results.length > 0 && (
        <>
          <div className="space-y-3 sm:hidden">
            {state.data.results.map((r) => (
              <ReceiptCardItem key={r.id} receipt={r} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-silver-300 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-silver-100 text-navy-700">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Payment date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.data.results.map((r) => (
                  <tr key={r.id} className="border-t border-silver-200 hover:bg-silver-100">
                    <td className="px-4 py-2.5">
                      <Link to={`/receipts/${r.id}`} className="font-medium text-navy-950 hover:text-sky-600">
                        {r.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{r.receiptNumber || '—'}</td>
                    <td className="px-4 py-2.5">{r.paymentDate ? formatServiceDate(r.paymentDate) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(r.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40">
              Previous
            </button>
            <span className="text-sm text-navy-700">Page {page} of {totalPages}</span>
            <button type="button" disabled={!state.data.hasMore} onClick={() => goToPage(page + 1)} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40">
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
