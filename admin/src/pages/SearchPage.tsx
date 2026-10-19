import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
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
  const query = (searchParams.get('q') || '').trim();
  const [input, setInput] = useState(query);
  const [state, setState] = useState<State>({ status: 'idle' });
  const requestVersion = useRef(0);

  const runSearch = useCallback((q: string) => {
    const version = ++requestVersion.current;
    const trimmed = q.trim();
    if (!trimmed) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    authFetch<SearchResponse>('/api/search', { method: 'POST', body: JSON.stringify({ q: trimmed }) })
      .then((data) => {
        if (version === requestVersion.current) setState({ status: 'success', results: data.results, query: trimmed });
      })
      .catch((err) => {
        if (version === requestVersion.current) setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Search failed.' });
      });
  }, []);

  useEffect(() => {
    setInput(query);
    runSearch(query);
    return () => { requestVersion.current += 1; };
  }, [query, runSearch]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed === query) {
      runSearch(trimmed);
    } else {
      requestVersion.current += 1;
      setSearchParams(trimmed ? { q: trimmed } : {});
    }
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
      {state.status === 'error' && <ErrorState message={state.message} onRetry={() => runSearch(query)} />}
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
