import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { SearchResponse, BookingCard } from '../types/booking';
import BookingCardItem from '../components/BookingCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; results: BookingCard[]; query: string };

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [input, setInput] = useState(initialQ);
  const [state, setState] = useState<State>({ status: 'idle' });

  function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    authFetch<SearchResponse>('/api/search', { method: 'POST', body: JSON.stringify({ q: trimmed }) })
      .then((data) => setState({ status: 'success', results: data.results, query: trimmed }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Search failed.' }),
      );
  }

  useEffect(() => {
    if (initialQ) runSearch(initialQ);
    // Only run on mount for the query already in the URL — subsequent
    // searches are submit-triggered, not on every keystroke or param change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});
    runSearch(trimmed);
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <h1 className="mb-4 font-semibold text-xl text-navy-950">Search</h1>

      <form onSubmit={handleSubmit} role="search" className="mb-6">
        <label htmlFor="search-input" className="sr-only">
          Search name, phone, postcode, address, or booking reference
        </label>
        <input
          id="search-input"
          type="search"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search name, phone, postcode, address, reference…"
          className="min-h-11 w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2.5 text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </form>

      {state.status === 'idle' && (
        <EmptyState
          title="Search for a customer"
          description="Try a name, phone number, postcode, address, or booking reference."
        />
      )}
      {state.status === 'loading' && <CardListSkeleton count={4} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={() => runSearch(input)} />}
      {state.status === 'success' && state.results.length === 0 && (
        <EmptyState
          title="No matches"
          description={`No results for "${state.query}". Try a different name, phone, or postcode.`}
        />
      )}
      {state.status === 'success' && state.results.length > 0 && (
        <div className="space-y-3">
          {state.results.map((b) => (
            <BookingCardItem key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
