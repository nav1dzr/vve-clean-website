import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { BookingListResponse } from '../types/booking';
import {
  BOOKING_STATUS_VALUES, PAYMENT_STATUS_VALUES, BALANCE_STATUS_VALUES, SORT_VALUES, type SortValue,
} from '../types/booking';
import BookingCardItem from '../components/BookingCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import {
  bookingStatusBadge, paymentStatusBadge, balanceStatusBadge, formatCurrency, formatServiceDate, formatPreferred,
} from '../lib/format';

const SORT_LABELS: Record<SortValue, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  service_date: 'Service date',
  highest_value: 'Highest value',
};

const PAGE_SIZE = 20;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: BookingListResponse };

function readFilters(params: URLSearchParams) {
  return {
    status: params.get('status') || '',
    paymentStatus: params.get('paymentStatus') || '',
    balanceStatus: params.get('balanceStatus') || '',
    service: params.get('service') || '',
    source: params.get('source') || '',
    postcode: params.get('postcode') || '',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
    sort: (params.get('sort') as SortValue) || 'newest',
    page: Number.parseInt(params.get('page') || '1', 10) || 1,
  };
}

export default function BookingListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  function load() {
    setState({ status: 'loading' });
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.paymentStatus) qs.set('paymentStatus', filters.paymentStatus);
    if (filters.balanceStatus) qs.set('balanceStatus', filters.balanceStatus);
    if (filters.service) qs.set('service', filters.service);
    if (filters.source) qs.set('source', filters.source);
    if (filters.postcode) qs.set('postcode', filters.postcode);
    if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) qs.set('dateTo', filters.dateTo);
    qs.set('sort', filters.sort);
    qs.set('page', String(filters.page));
    qs.set('pageSize', String(PAGE_SIZE));

    authFetch<BookingListResponse>(`/api/bookings?${qs.toString()}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load bookings.' }),
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

  const totalPages =
    state.status === 'success' ? Math.max(1, Math.ceil(state.data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-xl text-navy-950">Bookings</h1>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 sm:hidden"
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? 'Hide filters' : 'Filters'}
        </button>
      </div>

      <div
        className={`mb-6 grid grid-cols-1 gap-3 rounded-xl border border-silver-300 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4 ${
          filtersOpen ? 'grid' : 'hidden sm:grid'
        }`}
      >
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => updateFilter('status', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...BOOKING_STATUS_VALUES.map((s) => ({ value: s, label: bookingStatusBadge(s).label })),
          ]}
        />
        <FilterSelect
          label="Payment status"
          value={filters.paymentStatus}
          onChange={(v) => updateFilter('paymentStatus', v)}
          options={[
            { value: '', label: 'All payment statuses' },
            ...PAYMENT_STATUS_VALUES.map((s) => ({ value: s, label: paymentStatusBadge(s).label })),
          ]}
        />
        <FilterSelect
          label="Balance status"
          value={filters.balanceStatus}
          onChange={(v) => updateFilter('balanceStatus', v)}
          options={[
            { value: '', label: 'All balance statuses' },
            ...BALANCE_STATUS_VALUES.map((s) => ({ value: s, label: balanceStatusBadge(s).label })),
          ]}
        />
        <TextFilter label="Service" value={filters.service} onChange={(v) => updateFilter('service', v)} placeholder="e.g. end_of_tenancy" />
        <TextFilter label="Source" value={filters.source} onChange={(v) => updateFilter('source', v)} placeholder="e.g. google" />
        <TextFilter label="Postcode" value={filters.postcode} onChange={(v) => updateFilter('postcode', v)} placeholder="e.g. N15" />
        <DateFilter label="From" value={filters.dateFrom} onChange={(v) => updateFilter('dateFrom', v)} />
        <DateFilter label="To" value={filters.dateTo} onChange={(v) => updateFilter('dateTo', v)} />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          onChange={(v) => updateFilter('sort', v)}
          options={SORT_VALUES.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        />
      </div>

      {state.status === 'loading' && <CardListSkeleton count={5} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.data.results.length === 0 && (
        <EmptyState title="No bookings match these filters" description="Try clearing a filter or widening the date range." />
      )}
      {state.status === 'success' && state.data.results.length > 0 && (
        <>
          <div className="space-y-3 sm:hidden">
            {state.data.results.map((b) => (
              <BookingCardItem key={b.id} booking={b} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-silver-300 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-silver-100 text-navy-700">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Postcode</th>
                  <th className="px-4 py-2.5 font-medium">Service</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Balance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {state.data.results.map((b) => {
                  const dateLabel = b.serviceDate
                    ? formatServiceDate(b.serviceDate)
                    : formatPreferred(b.preferredDate, b.preferredTime);
                  const statusBadge = bookingStatusBadge(b.status);
                  const payBadge = paymentStatusBadge(b.paymentStatus);
                  const balBadge = b.balanceStatus ? balanceStatusBadge(b.balanceStatus) : null;
                  return (
                    <tr key={b.id} className="border-t border-silver-200 hover:bg-silver-100">
                      <td className="px-4 py-2.5">
                        <Link to={`/bookings/${b.id}`} className="font-medium text-navy-950 hover:text-sky-600">
                          {b.fullName || 'Name not recorded'}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{b.postcode || '—'}</td>
                      <td className="px-4 py-2.5">{b.service || '—'}</td>
                      <td className="px-4 py-2.5">{dateLabel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${payBadge.className}`}>
                          {payBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {balBadge && (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${balBadge.className}`}>
                            {balBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(b.totalPrice)}</td>
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
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-sm text-navy-900">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <label className="text-sm text-navy-900">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type="text"
        value={local}
        placeholder={placeholder}
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
    </label>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm text-navy-900">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
      />
    </label>
  );
}
