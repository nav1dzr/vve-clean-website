import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { BookingDetail, BalanceUpdateResponse } from '../types/booking';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import StatusControl from '../components/StatusControl';
import BalanceControl from '../components/BalanceControl';
import InternalNotesSection from '../components/InternalNotesSection';
import BookingInvoicesSection from '../components/BookingInvoicesSection';
import BookingCustomerSection from '../components/BookingCustomerSection';
import {
  paymentStatusBadge,
  formatServiceDate,
  formatPreferred,
  formatDateTime,
  telHref,
  whatsappHref,
  mailtoHref,
  copyToClipboard,
} from '../lib/format';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: BookingDetail };

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copied, setCopied] = useState<'address' | 'ref' | null>(null);

  function load() {
    if (!id) return;
    setState({ status: 'loading' });
    authFetch<BookingDetail>(`/api/bookings/${id}`)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'not-found' });
        } else {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load this booking.',
          });
        }
      });
  }

  useEffect(load, [id]);

  function handleStatusUpdated(status: string, updatedAt: string) {
    setState((prev) => (prev.status === 'success' ? { status: 'success', data: { ...prev.data, status, updatedAt } } : prev));
  }

  function handleBalanceUpdated(result: BalanceUpdateResponse) {
    setState((prev) =>
      prev.status === 'success'
        ? {
            status: 'success',
            data: {
              ...prev.data,
              balanceStatus: result.balanceStatus,
              balancePaidAt: result.balancePaidAt,
              balancePaymentMethod: result.balancePaymentMethod,
              updatedAt: result.updatedAt,
            },
          }
        : prev,
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="px-4 py-6 sm:px-6">
        <CardListSkeleton count={1} />
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="px-4 py-6 sm:px-6">
        <EmptyState
          title="Booking not found"
          description="It may have been removed, or the link may be incorrect."
          action={
            <Link to="/bookings" className="text-sm text-sky-600 hover:text-sky-700">
              Back to bookings
            </Link>
          }
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="px-4 py-6 sm:px-6">
        <ErrorState message={state.message} onRetry={load} />
      </div>
    );
  }

  const b = state.data;
  const dateLabel = b.serviceDate ? formatServiceDate(b.serviceDate) : formatPreferred(b.preferredDate, b.preferredTime);
  const tel = telHref(b.phone);
  const wa = whatsappHref(b.phone);
  const mail = mailtoHref(b.email);
  const addressLine = [b.address, b.postcode].filter(Boolean).join(', ');

  async function handleCopy(kind: 'address' | 'ref', text: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div className="px-4 py-6 pb-32 sm:px-6 sm:pb-6">
      <Link to="/bookings" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">
        ← Bookings
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-xl text-navy-950">{b.bookingRef || 'Reference not recorded'}</h1>
          <p className="truncate text-xs text-navy-500">Internal ID: {b.id}</p>
        </div>
        <StatusBadge {...paymentStatusBadge(b.paymentStatus)} />
      </div>

      <Section title="Status">
        <StatusControl bookingId={b.id} status={b.status} onUpdated={handleStatusUpdated} />
      </Section>

      <Section title="Customer">
        <p className="font-medium text-navy-950">{b.fullName || 'Name not recorded'}</p>
        <p className="text-sm text-navy-700">{b.phone || 'Phone not recorded'}</p>
        <p className="text-sm text-navy-700">{b.email || 'Email not recorded'}</p>
        <p className="text-sm text-navy-700">
          {addressLine || 'Address not recorded'}
          {addressLine && (
            <button
              type="button"
              onClick={() => handleCopy('address', addressLine)}
              className="ml-2 text-sky-600 hover:text-sky-700"
            >
              {copied === 'address' ? 'Copied' : 'Copy'}
            </button>
          )}
        </p>
      </Section>

      <Section title="Service">
        <p className="text-sm text-navy-900">{b.service || 'Service not recorded'}</p>
        <p className="text-sm text-navy-700">{dateLabel}</p>
        {b.quoteConfig ? (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-silver-100 p-3 text-xs text-navy-700">
            {JSON.stringify(b.quoteConfig, null, 2)}
          </pre>
        ) : (
          <p className="mt-1 text-sm text-navy-500">Itemised quote unavailable</p>
        )}
      </Section>

      <Section title="Balance">
        <BalanceControl
          bookingId={b.id}
          totalPrice={b.totalPrice}
          depositAmount={b.depositAmount}
          balance={b.balance}
          paymentStatus={b.paymentStatus}
          balanceStatus={b.balanceStatus}
          balancePaidAt={b.balancePaidAt}
          balancePaymentMethod={b.balancePaymentMethod}
          onUpdated={handleBalanceUpdated}
        />
      </Section>

      <BookingCustomerSection bookingId={b.id} fullName={b.fullName} email={b.email} phone={b.phone} />

      <BookingInvoicesSection bookingId={b.id} />

      <Section title="Customer notes">
        <p className="whitespace-pre-wrap text-sm text-navy-700">{b.notes || 'No notes recorded'}</p>
      </Section>

      <InternalNotesSection bookingId={b.id} />

      <Section title="Attribution & source">
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-navy-700">Source</dt>
          <dd className="text-right text-navy-950">{b.attribution.lastSource || 'Not recorded'}</dd>
          <dt className="text-navy-700">Landing page</dt>
          <dd className="truncate text-right text-navy-950">{b.attribution.landingPage || 'Not recorded'}</dd>
          <dt className="text-navy-700">Offer code</dt>
          <dd className="text-right text-navy-950">{b.attribution.offerCode || 'None'}</dd>
        </dl>
      </Section>

      <Section title="Stripe reference">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-navy-700">Session</dt>
            <dd className="truncate text-navy-950">{b.stripe.sessionId || 'Not recorded'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-navy-700">Payment intent</dt>
            <dd className="truncate text-navy-950">{b.stripe.paymentIntentId || 'Not recorded'}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Notifications sent">
        <ul className="flex flex-wrap gap-2 text-xs">
          <NotificationPill label="Customer email" sent={b.notifications.emailCustomerSent} />
          <NotificationPill label="Business email" sent={b.notifications.emailBusinessSent} />
          <NotificationPill label="Telegram" sent={b.notifications.telegramSent} />
          <NotificationPill label="Sheets" sent={b.notifications.sheetsSent} />
        </ul>
      </Section>

      <Section title="Timestamps">
        <p className="text-sm text-navy-700">Created: {formatDateTime(b.createdAt)}</p>
        <p className="text-sm text-navy-700">Updated: {formatDateTime(b.updatedAt)}</p>
      </Section>

      {b.bookingRef && (
        <button
          type="button"
          onClick={() => handleCopy('ref', b.bookingRef as string)}
          className="mb-4 min-h-11 w-full rounded-lg border border-silver-300 text-sm font-medium text-navy-900"
        >
          {copied === 'ref' ? 'Reference copied' : 'Copy booking reference'}
        </button>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 flex gap-2 border-t border-silver-300 bg-white p-3 sm:static sm:inset-auto sm:z-auto sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0">
        <ActionLink href={tel} label="Call" />
        <ActionLink href={wa} label="WhatsApp" external />
        <ActionLink href={mail} label="Email" />
      </div>
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

function NotificationPill({ label, sent }: { label: string; sent: boolean | null }) {
  const className =
    sent === true ? 'bg-green-100 text-green-800' : sent === false ? 'bg-silver-200 text-navy-700' : 'bg-silver-200 text-navy-500';
  const text = sent === true ? `${label} sent` : sent === false ? `${label} not sent` : `${label} unknown`;
  return <li className={`rounded-full px-2.5 py-1 ${className}`}>{text}</li>;
}

function ActionLink({ href, label, external }: { href: string | null; label: string; external?: boolean }) {
  if (!href) {
    return (
      <span className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-silver-200 px-3 text-sm font-medium text-navy-500">
        {label} unavailable
      </span>
    );
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-navy-950 px-3 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
    >
      {label}
    </a>
  );
}
