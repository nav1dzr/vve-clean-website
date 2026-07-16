import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InvoiceListResponse } from '../types/invoice';
import { invoiceDocumentStatusBadge, invoicePaymentStatusBadge, formatMoney } from '../lib/format';
import StatusBadge from './StatusBadge';
import ErrorState from './ErrorState';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: InvoiceListResponse };

// Financial-documents section for a booking's detail page — the entry
// point for "Create invoice" (ADMIN_CRM_PLAN spec §"Booking and manual
// invoice creation"). Creating an invoice here never rewrites the booking
// itself; it only snapshots trusted fields at creation time
// (admin/src/pages/InvoiceEditorPage.tsx).
export default function BookingInvoicesSection({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  function load() {
    setState({ status: 'loading' });
    authFetch<InvoiceListResponse>(`/api/invoices?bookingId=${bookingId}&pageSize=50`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load invoices.' }),
      );
  }

  useEffect(load, [bookingId]);

  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Invoices</h2>
        <Link
          to={`/invoices/new?bookingId=${bookingId}`}
          className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 transition-colors hover:bg-silver-100 flex items-center"
        >
          + Create invoice
        </Link>
      </div>

      {state.status === 'loading' && <p className="text-sm text-navy-500">Loading invoices…</p>}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.data.results.length === 0 && (
        <p className="text-sm text-navy-500">No invoices for this booking yet.</p>
      )}
      {state.status === 'success' && state.data.results.length > 0 && (
        <ul className="space-y-2">
          {state.data.results.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2 border-t border-silver-200 pt-2 first:border-t-0 first:pt-0">
              <Link to={`/invoices/${inv.id}`} className="min-w-0 text-sm font-medium text-navy-950 hover:text-sky-600">
                {inv.invoiceNumber || 'Draft'}
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge {...invoiceDocumentStatusBadge(inv.documentStatus)} />
                <StatusBadge {...invoicePaymentStatusBadge(inv.paymentStatus)} />
                <span className="text-sm text-navy-700">{formatMoney(inv.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
