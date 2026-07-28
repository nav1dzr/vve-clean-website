import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { CustomerListResponse } from '../types/customer';
import ErrorState from './ErrorState';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CustomerListResponse };

// "View linked customer" for a booking's detail page — bookings have no
// customer_id FK by design (see customerLifecycle.js's header), so the
// link is found the same way a customer's own booking history is: by
// matching email/phone. Purely a lookup — never creates or links
// anything on its own; "+ Create customer" hands off to the normal
// create-customer form (with its own duplicate-warning check), it does
// not silently create one here.
export default function BookingCustomerSection({
  bookingId, fullName, email, phone,
}: {
  bookingId: string; fullName: string | null; email: string | null; phone: string | null;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const q = email || phone;

  function load() {
    if (!q) {
      setState({ status: 'success', data: { results: [], page: 1, pageSize: 0, totalCount: 0, hasMore: false } });
      return;
    }
    setState({ status: 'loading' });
    authFetch<CustomerListResponse>(`/api/customers?q=${encodeURIComponent(q)}&pageSize=5`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not look up the linked customer.' }),
      );
  }

  useEffect(load, [q]);

  const createHref = `/customers/new?fromBookingId=${bookingId}`;

  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Linked customer</h2>

      {state.status === 'loading' && <p className="text-sm text-navy-500">Looking up customer record…</p>}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}

      {state.status === 'success' && state.data.results.length === 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-navy-500">No customer record found for {fullName || 'this booking'} yet.</p>
          <Link
            to={createHref}
            className="min-h-11 shrink-0 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 transition-colors hover:bg-silver-100 flex items-center"
          >
            + Create customer
          </Link>
        </div>
      )}

      {state.status === 'success' && state.data.results.length > 0 && (
        <ul className="space-y-2">
          {state.data.results.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="text-sm font-medium text-navy-950 hover:text-sky-600">
                {c.name}
              </Link>
              <span className="ml-2 text-sm text-navy-500">{c.email || c.phone}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
