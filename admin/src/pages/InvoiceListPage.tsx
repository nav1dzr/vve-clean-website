import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InvoiceListResponse, InvoiceSortValue } from '../types/invoice';
import { INVOICE_DOCUMENT_STATUS_VALUES, INVOICE_PAYMENT_STATUS_VALUES, INVOICE_SORT_VALUES } from '../types/invoice';
import InvoiceCardItem from '../components/InvoiceCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import { invoiceDocumentStatusBadge, invoicePaymentStatusBadge, formatMoney, isInvoiceOverdue } from '../lib/format';
import StatusBadge from '../components/StatusBadge';

const SORT_LABELS: Record<InvoiceSortValue, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  due_soonest: 'Due soonest',
  highest_total: 'Highest total',
  highest_outstanding: 'Highest outstanding',
};

const PAGE_SIZE = 20;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: InvoiceListResponse };

function readFilters(params: URLSearchParams) {
  return {
    documentStatus: params.get('documentStatus') || '',
    paymentStatus: params.get('paymentStatus') || '',
    q: params.get('q') || '',
    dueFrom: params.get('dueFrom') || '',
    dueTo: params.get('dueTo') || '',
    sort: (params.get('sort') as InvoiceSortValue) || 'newest',
    page: Number.parseInt(params.get('page') || '1', 10) || 1,
  };
}

export default function InvoiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  function load() {
    setState({ status: 'loading' });
    const qs = new URLSearchParams();
    if (filters.documentStatus) qs.set('documentStatus', filters.documentStatus);
    if (filters.paymentStatus) qs.set('paymentStatus', filters.paymentStatus);
    if (filters.q) qs.set('q', filters.q);
    if (filters.dueFrom) qs.set('dueFrom', filters.dueFrom);
    if (filters.dueTo) qs.set('dueTo', filters.dueTo);
    qs.set('sort', filters.sort);
    qs.set('page', String(filters.page));
    qs.set('pageSize', String(PAGE_SIZE));

    authFetch<InvoiceListResponse>(`/api/invoices?${qs.toString()}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load invoices.' }),
      );
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [searchParams]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
  }

  const totalPages = state.status === 'success' ? Math.max(1, Math.ceil(state.data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-semibold text-xl text-navy-950">Invoices</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/invoices/new"
            className="min-h-11 rounded-lg bg-navy-950 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy-900 flex items-center"
          >
            + New invoice
          </Link>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 sm:hidden"
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
        </div>
      </div>

      <div
        className={`mb-6 grid grid-cols-1 gap-3 rounded-xl border border-silver-300 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4 ${
          filtersOpen ? 'grid' : 'hidden sm:grid'
        }`}
      >
        <label className="text-sm text-navy-900">
          <span className="mb-1 block font-medium">Search</span>
          <SearchInput value={filters.q} onChange={(v) => updateFilter('q', v)} />
        </label>
        <FilterSelect
          label="Status"
          value={filters.documentStatus}
          onChange={(v) => updateFilter('documentStatus', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...INVOICE_DOCUMENT_STATUS_VALUES.map((s) => ({ value: s, label: invoiceDocumentStatusBadge(s).label })),
          ]}
        />
        <FilterSelect
          label="Payment status"
          value={filters.paymentStatus}
          onChange={(v) => updateFilter('paymentStatus', v)}
          options={[
            { value: '', label: 'All payment statuses' },
            ...INVOICE_PAYMENT_STATUS_VALUES.map((s) => ({ value: s, label: invoicePaymentStatusBadge(s).label })),
          ]}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          onChange={(v) => updateFilter('sort', v)}
          options={INVOICE_SORT_VALUES.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        />
        <label className="text-sm text-navy-900">
          <span className="mb-1 block font-medium">Due from</span>
          <input type="date" value={filters.dueFrom} onChange={(e) => updateFilter('dueFrom', e.target.value)} className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500" />
        </label>
        <label className="text-sm text-navy-900">
          <span className="mb-1 block font-medium">Due to</span>
          <input type="date" value={filters.dueTo} onChange={(e) => updateFilter('dueTo', e.target.value)} className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500" />
        </label>
      </div>

      {state.status === 'loading' && <CardListSkeleton count={5} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.data.results.length === 0 && (
        <EmptyState
          title="No invoices match these filters"
          description="Try clearing a filter, or create a new invoice."
          action={
            <Link to="/invoices/new" className="text-sm text-sky-600 hover:text-sky-700">
              + New invoice
            </Link>
          }
        />
      )}
      {state.status === 'success' && state.data.results.length > 0 && (
        <>
          <div className="space-y-3 sm:hidden">
            {state.data.results.map((inv) => (
              <InvoiceCardItem key={inv.id} invoice={inv} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-silver-300 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-silver-100 text-navy-700">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Due date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {state.data.results.map((inv) => {
                  const statusBadge = invoiceDocumentStatusBadge(inv.documentStatus);
                  const payBadge = invoicePaymentStatusBadge(inv.paymentStatus);
                  const overdue = isInvoiceOverdue(inv.documentStatus, inv.amountDue, inv.dueDate);
                  return (
                    <tr key={inv.id} className="border-t border-silver-200 hover:bg-silver-100">
                      <td className="px-4 py-2.5">
                        <Link to={`/invoices/${inv.id}`} className="font-medium text-navy-950 hover:text-sky-600">
                          {inv.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{inv.invoiceNumber || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge {...statusBadge} />
                          {overdue && <StatusBadge label="Overdue" className="bg-red-100 text-red-700" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge {...payBadge} /></td>
                      <td className="px-4 py-2.5">{inv.dueDate || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(inv.total)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatMoney(inv.amountDue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => goToPage(filters.page - 1)}
              className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-navy-700">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={!state.data.hasMore}
              onClick={() => goToPage(filters.page + 1)}
              className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="text-sm text-navy-900">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <input
      type="text"
      value={local}
      placeholder="Number, customer, email, postcode…"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onChange(local);
        }
      }}
      className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
    />
  );
}
