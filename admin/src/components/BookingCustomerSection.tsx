import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { CustomerListResponse } from '../types/customer';
import ErrorState from './ErrorState';
import CopyReviewLink from './CopyReviewLink';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CustomerListResponse };

const normalisePhone = (value: string | null) => {
  const digits = value?.replace(/\D/g, '') || '';
  return digits.length === 12 && digits.startsWith('44') ? `0${digits.slice(2)}` : digits;
};

// Bookings have no customer_id FK. These are possible matches from the
// customer search, with literal contact matches preferred over substrings.
// Purely a lookup — never creates or links
// anything on its own; "+ Create customer" hands off to the normal
// create-customer form (with its own duplicate-warning check), it does
// not silently create one here.
export default function BookingCustomerSection({
  bookingId, fullName, email, phone, completed = false,
}: {
  bookingId: string; fullName: string | null; email: string | null; phone: string | null; completed?: boolean;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const requestVersion = useRef(0);
  const emailQuery = email?.trim() || '';
  const phoneQuery = phone?.trim() || '';

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    const q = emailQuery || phoneQuery;
    if (!q) {
      setState({ status: 'success', data: { results: [], page: 1, pageSize: 0, totalCount: 0, hasMore: false } });
      return;
    }
    setState({ status: 'loading' });
    try {
      let data = await authFetch<CustomerListResponse>(`/api/customers?q=${encodeURIComponent(q)}&pageSize=5`);
      if (version !== requestVersion.current) return;
      // A manual booking may add an email to an existing phone-only customer.
      // Only exact phone matches are offered by this fallback; it never links records.
      if (emailQuery && data.results.length === 0 && normalisePhone(phoneQuery)) {
        const phoneData = await authFetch<CustomerListResponse>(`/api/customers?q=${encodeURIComponent(phoneQuery)}&pageSize=5`);
        if (version !== requestVersion.current) return;
        const results = phoneData.results.filter((customer) => normalisePhone(customer.phone) === normalisePhone(phoneQuery));
        data = { ...phoneData, results, totalCount: results.length, hasMore: false };
      }
      setState({ status: 'success', data });
    } catch (err) {
      if (version === requestVersion.current) setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not look up customer matches.' });
    }
  }, [emailQuery, phoneQuery]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  const possibleMatches = state.status === 'success' ? state.data.results : [];
  const exactMatches = possibleMatches.filter((customer) =>
    (email?.trim() && customer.email?.trim().toLowerCase() === email.trim().toLowerCase())
    || (normalisePhone(phone) && normalisePhone(customer.phone) === normalisePhone(phone)),
  );
  const matches = exactMatches.length ? exactMatches : possibleMatches;

  const createHref = `/customers/new?fromBookingId=${bookingId}`;

  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Possible customer matches</h2>

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
        <><p className="mb-2 text-sm text-navy-500">Check the contact details before using a customer record. This search does not link or merge records.</p>
        <ul className="space-y-2">
          {matches.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="text-sm font-medium text-navy-950 hover:text-sky-600">
                {c.name}
              </Link>
              <span className="ml-2 text-sm text-navy-500">{c.email || c.phone}</span>
              {completed && <Link to={`/customers/${c.id}/email?template=review`} aria-label={`Prepare review email for ${c.name}`} className="mt-2 flex min-h-11 w-fit items-center rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 hover:bg-silver-100">Prepare review email</Link>}
            </li>
          ))}
        </ul></>
      )}
      {completed && <div className="mt-4 border-t border-silver-200 pt-4"><p className="mb-3 text-sm text-navy-700">For a review email, choose the correct customer record above after checking their details. You will confirm the completed work and preview the message before sending. You can also copy the public link without creating a customer record.</p><CopyReviewLink /></div>}
    </section>
  );
}
