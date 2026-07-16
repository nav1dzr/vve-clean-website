import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { CustomerListResponse, CustomerSortValue } from '../types/customer';
import { CUSTOMER_TYPE_VALUES, CUSTOMER_SOURCE_VALUES, CUSTOMER_SORT_VALUES } from '../types/customer';
import { customerTypeLabel } from '../lib/format';
import CustomerCardItem from '../components/CustomerCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';

const SORT_LABELS: Record<CustomerSortValue, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'Name (A–Z)',
};

const PAGE_SIZE = 20;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CustomerListResponse };

function readFilters(params: URLSearchParams) {
  return {
    customerType: params.get('customerType') || '',
    source: params.get('source') || '',
    q: params.get('q') || '',
    sort: (params.get('sort') as CustomerSortValue) || 'newest',
    page: Number.parseInt(params.get('page') || '1', 10) || 1,
  };
}

export default function CustomerListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  function load() {
    setState({ status: 'loading' });
    const qs = new URLSearchParams();
    if (filters.customerType) qs.set('customerType', filters.customerType);
    if (filters.source) qs.set('source', filters.source);
    if (filters.q) qs.set('q', filters.q);
    qs.set('sort', filters.sort);
    qs.set('page', String(filters.page));
    qs.set('pageSize', String(PAGE_SIZE));

    authFetch<CustomerListResponse>(`/api/customers?${qs.toString()}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load customers.' }));
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
        <h1 className="font-semibold text-xl text-navy-950">Customers</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/customers/new"
            className="min-h-11 rounded-lg bg-navy-950 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy-900 flex items-center"
          >
            + New customer
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

      <div className={`mb-6 grid grid-cols-1 gap-3 rounded-xl border border-silver-300 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 ${filtersOpen ? 'grid' : 'hidden sm:grid'}`}>
        <label className="text-sm text-navy-900">
          <span className="mb-1 block font-medium">Search</span>
          <SearchInput value={filters.q} onChange={(v) => updateFilter('q', v)} />
        </label>
        <FilterSelect
          label="Type"
          value={filters.customerType}
          onChange={(v) => updateFilter('customerType', v)}
          options={[{ value: '', label: 'All types' }, ...CUSTOMER_TYPE_VALUES.map((t) => ({ value: t, label: customerTypeLabel(t) }))]}
        />
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={(v) => updateFilter('source', v)}
          options={[{ value: '', label: 'All sources' }, ...CUSTOMER_SOURCE_VALUES.map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          onChange={(v) => updateFilter('sort', v)}
          options={CUSTOMER_SORT_VALUES.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        />
      </div>

      {state.status === 'loading' && <CardListSkeleton count={5} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.data.results.length === 0 && (
        <EmptyState
          title="No customers match these filters"
          description="Try clearing a filter, or add a new customer."
          action={<Link to="/customers/new" className="text-sm text-sky-600 hover:text-sky-700">+ New customer</Link>}
        />
      )}
      {state.status === 'success' && state.data.results.length > 0 && (
        <>
          <div className="space-y-3">
            {state.data.results.map((c) => (
              <CustomerCardItem key={c.id} customer={c} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button type="button" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40">
              Previous
            </button>
            <span className="text-sm text-navy-700">Page {filters.page} of {totalPages}</span>
            <button type="button" disabled={!state.data.hasMore} onClick={() => goToPage(filters.page + 1)} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-40">
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
      placeholder="Name, email, phone, postcode…"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange(local); } }}
      className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-navy-950 outline-none focus:border-sky-500"
    />
  );
}
