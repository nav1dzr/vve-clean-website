import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { CustomerHistoryResponse } from '../types/customer';
import type { ManualBookingInput, ManualBookingResponse } from '../types/customer';
import { customerTypeLabel } from '../lib/format';
import ManualBookingModal from '../components/ManualBookingModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import {
  formatMoney, formatDateTime, telHref, whatsappHref, mailtoHref,
  bookingStatusBadge, invoiceDocumentStatusBadge, invoicePaymentStatusBadge,
} from '../lib/format';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CustomerHistoryResponse };

// Customer detail + derived history. Bookings are matched by email/phone
// (not a hard FK — see admin/api/_lib/customerLifecycle.js's header for
// why); invoices/receipts are matched by the exact billing/service
// customer link. Never renders a confirmation token or any credential —
// every list here comes from the same explicit-allowlist card mappers used
// on the bookings/invoices/receipts list pages themselves.
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    setState({ status: 'loading' });
    authFetch<CustomerHistoryResponse>(`/api/customers/${id}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setState({ status: 'not-found' });
        else setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this customer.' });
      });
  }

  useEffect(load, [id]);

  async function handleCreateBooking(input: ManualBookingInput) {
    if (!id) return;
    const result = await authFetch<ManualBookingResponse>(`/api/customers/${id}?action=bookings`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setShowBookingModal(false);
    navigate(`/bookings/${result.bookingId}`);
  }

  if (state.status === 'loading') {
    return <div className="px-4 py-6 sm:px-6"><CardListSkeleton count={1} /></div>;
  }
  if (state.status === 'not-found') {
    return (
      <div className="px-4 py-6 sm:px-6">
        <EmptyState title="Customer not found" description="It may have been removed, or the link may be incorrect." action={<Link to="/customers" className="text-sm text-sky-600 hover:text-sky-700">Back to customers</Link>} />
      </div>
    );
  }
  if (state.status === 'error') {
    return <div className="px-4 py-6 sm:px-6"><ErrorState message={state.message} onRetry={load} /></div>;
  }

  const c = state.data;
  const tel = telHref(c.phone);
  const whatsapp = whatsappHref(c.phone);
  const mail = mailtoHref(c.email);

  return (
    <div className="px-4 py-6 sm:px-6">
      <Link to="/customers" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">← Customers</Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-semibold text-xl text-navy-950">{c.name}</h1>
          <p className="text-sm text-navy-700">{customerTypeLabel(c.customerType)}</p>
        </div>
        <Link to={`/customers/${c.id}/edit`} className="min-h-11 flex items-center rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100">
          Edit
        </Link>
      </div>

      {actionError && <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p>}

      <Section title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <QuickAction label="Call" href={tel} disabled={!tel} />
          <QuickAction label="WhatsApp" href={whatsapp} disabled={!whatsapp} />
          <QuickAction label="Email" href={mail} disabled={!mail} />
          <button type="button" onClick={() => { setActionError(null); setShowBookingModal(true); }} className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100">
            Create booking
          </button>
          <Link to={`/invoices/new?customerId=${c.id}`} className="min-h-11 flex items-center rounded-lg bg-navy-950 px-3.5 text-sm font-semibold text-white hover:bg-navy-900">
            Create invoice
          </Link>
        </div>
      </Section>

      <Section title="Contact details">
        <dl className="space-y-1.5 text-sm">
          <Row label="Email" value={c.email || 'Not recorded'} />
          <Row label="Phone" value={c.phone || 'Not recorded'} />
          <Row label="Address" value={[c.address, c.postcode].filter(Boolean).join(', ') || 'Not recorded'} />
          <Row label="Source" value={c.source.replace('_', ' ')} />
          <Row label="Preferred contact" value={c.preferredContactMethod || 'Not specified'} />
        </dl>
      </Section>

      <Section title="Balances">
        <dl className="space-y-1.5 text-sm">
          <Row label="Outstanding balance" value={formatMoney(c.outstandingBalance)} strong />
          <Row label="Total paid" value={formatMoney(c.totalPaid)} />
        </dl>
        <p className="mt-1 text-xs text-navy-500">Calculated from issued, non-void invoices only.</p>
      </Section>

      {c.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-sm text-navy-700">{c.notes}</p>
        </Section>
      )}

      <Section title={`Bookings (${c.bookings.length})`}>
        {c.bookings.length === 0 && <p className="text-sm text-navy-500">No bookings matched to this customer yet.</p>}
        {c.bookings.length > 0 && (
          <ul className="space-y-2">
            {c.bookings.map((b) => (
              <li key={b.id} className="border-t border-silver-200 pt-2 first:border-t-0 first:pt-0">
                <Link to={`/bookings/${b.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-sky-600">
                  <span>{b.bookingRef || b.service || 'Booking'}</span>
                  <StatusBadge {...bookingStatusBadge(b.status)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Invoices (${c.invoices.length})`}>
        {c.invoices.length === 0 && <p className="text-sm text-navy-500">No invoices for this customer yet.</p>}
        {c.invoices.length > 0 && (
          <ul className="space-y-2">
            {c.invoices.map((i) => (
              <li key={i.id} className="border-t border-silver-200 pt-2 first:border-t-0 first:pt-0">
                <Link to={`/invoices/${i.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-sky-600">
                  <span>{i.invoiceNumber || 'Draft'}</span>
                  <span className="flex gap-1">
                    <StatusBadge {...invoiceDocumentStatusBadge(i.documentStatus)} />
                    <StatusBadge {...invoicePaymentStatusBadge(i.paymentStatus)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Receipts (${c.receipts.length})`}>
        {c.receipts.length === 0 && <p className="text-sm text-navy-500">No receipts for this customer yet.</p>}
        {c.receipts.length > 0 && (
          <ul className="space-y-2">
            {c.receipts.map((r) => (
              <li key={r.id} className="border-t border-silver-200 pt-2 first:border-t-0 first:pt-0">
                <Link to={`/receipts/${r.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-sky-600">
                  <span>{r.receiptNumber}</span>
                  <span className="text-navy-700">{formatMoney(r.totalPaid)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs text-navy-500">Customer added {formatDateTime(c.createdAt)}</p>

      {showBookingModal && <ManualBookingModal onClose={() => setShowBookingModal(false)} onCreate={handleCreateBooking} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-navy-700">{label}</dt>
      <dd className={strong ? 'font-semibold text-navy-950' : 'text-navy-950'}>{value}</dd>
    </div>
  );
}

function QuickAction({ label, href, disabled }: { label: string; href: string | null; disabled: boolean }) {
  const className = 'min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100 disabled:opacity-40';
  if (disabled || !href) {
    return <button type="button" disabled className={className}>{label}</button>;
  }
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} className={`${className} flex items-center`}>
      {label}
    </a>
  );
}
