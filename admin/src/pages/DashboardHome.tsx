import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { DashboardSummary } from '../types/booking';
import BookingCardItem from '../components/BookingCardItem';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import SearchBox from '../components/SearchBox';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: DashboardSummary };

export default function DashboardHome() {
  const [state, setState] = useState<State>({ status: 'loading' });

  function load() {
    setState({ status: 'loading' });
    authFetch<DashboardSummary>('/api/dashboard-summary')
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Could not load the dashboard.',
        }),
      );
  }

  useEffect(load, []);

  return (
    <div className="px-4 py-6 sm:px-6">
      <h1 className="mb-4 font-semibold text-xl text-navy-950">VVE Admin</h1>
      <SearchBox className="mb-6" />

      {state.status === 'loading' && <CardListSkeleton count={3} />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && (
        <div className="space-y-8">
          <Section title="Today" count={state.data.today.count} emptyLabel="No bookings today.">
            {state.data.today.bookings.map((b) => (
              <BookingCardItem key={b.id} booking={b} />
            ))}
          </Section>

          <Section title="Upcoming" count={state.data.upcoming.count} emptyLabel="No upcoming bookings scheduled.">
            {state.data.upcoming.bookings.map((b) => (
              <BookingCardItem key={b.id} booking={b} />
            ))}
          </Section>

          <Section title="Recently booked" count={state.data.recent.count} emptyLabel="No bookings yet.">
            {state.data.recent.bookings.map((b) => (
              <BookingCardItem key={b.id} booking={b} />
            ))}
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Deposits paid" value={String(state.data.depositsPaid.count)} />
            <StatTile
              label="Outstanding balances"
              value={
                state.data.outstandingBalances.dataAvailable
                  ? String(state.data.outstandingBalances.count)
                  : 'No data yet'
              }
            />
          </div>

          {state.data.unscheduledCount > 0 && (
            <p className="text-sm text-navy-700">
              {state.data.unscheduledCount} booking{state.data.unscheduledCount === 1 ? '' : 's'} without a
              structured service date — not shown in Today/Upcoming.{' '}
              <Link to="/bookings" className="text-sky-600 hover:text-sky-700">
                View all bookings
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
        {title} {count > 0 && `(${count})`}
      </h2>
      {count === 0 ? <EmptyState title={emptyLabel} /> : <div className="space-y-3">{children}</div>}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-silver-300 bg-white p-4">
      <p className="text-2xl font-semibold text-navy-950">{value}</p>
      <p className="text-sm text-navy-700">{label}</p>
    </div>
  );
}
