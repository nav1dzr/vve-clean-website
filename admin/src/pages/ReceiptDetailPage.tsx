import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { ReceiptDetail, InvoiceEvent, InvoiceEventsResponse, DownloadUrlResponse, SendResponse } from '../types/invoice';
import SendDocumentModal from '../components/SendDocumentModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import { formatMoney, formatDateTime, invoicePaymentMethodLabel, invoiceEventLabel } from '../lib/format';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ReceiptDetail };

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [events, setEvents] = useState<InvoiceEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  function load() {
    if (!id) return;
    setState({ status: 'loading' });
    authFetch<ReceiptDetail>(`/api/receipts/${id}`)
      .then((data) => {
        setState({ status: 'success', data });
        authFetch<InvoiceEventsResponse>(`/api/receipts/${id}/events`)
          .then((r) => setEvents(r.results))
          .catch(() => setEvents([]));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setState({ status: 'not-found' });
        else setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this receipt.' });
      });
  }

  useEffect(load, [id]);

  async function handleDownload() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await authFetch<DownloadUrlResponse>(`/api/receipts/${id}/download`);
      window.open(result.url, '_blank', 'noopener');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not download this receipt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(to: string, message: string) {
    if (!id || state.status !== 'success') return;
    const action = state.data.sentAt ? 'resend' : 'send';
    await authFetch<SendResponse>(`/api/receipts/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ to, message: message || undefined }),
    });
    setSendOpen(false);
    load();
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
          title="Receipt not found"
          description="It may have been removed, or the link may be incorrect."
          action={<Link to="/receipts" className="text-sm text-sky-600 hover:text-sky-700">Back to receipts</Link>}
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

  const r = state.data;

  return (
    <div className="px-4 py-6 sm:px-6">
      <Link to="/receipts" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">← Receipts</Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-semibold text-xl text-navy-950">{r.receiptNumber}</h1>
          <p className="text-sm text-navy-700">{r.customer.name}</p>
        </div>
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Paid in full</span>
      </div>

      {actionError && <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p>}

      <Section title="Payment">
        <dl className="space-y-1.5 text-sm">
          <Row label="Invoice" value={r.invoiceNumberSnapshot || '—'} />
          <Row label="Invoice total" value={formatMoney(r.invoiceTotal)} />
          <Row label="Amount received" value={formatMoney(r.totalPaid)} strong />
          <Row label="Payment date" value={r.paymentDate || '—'} />
          <Row label="Payment method" value={invoicePaymentMethodLabel(r.paymentMethod)} />
          {r.paymentReference && <Row label="Reference" value={r.paymentReference} />}
        </dl>
      </Section>

      <Section title="Customer">
        <p className="font-medium text-navy-950">{r.customer.name}</p>
        <p className="text-sm text-navy-700">{r.customer.email || 'Email not recorded'}</p>
        <p className="text-sm text-navy-700">{r.customer.phone || 'Phone not recorded'}</p>
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleDownload()} disabled={busy} className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100 disabled:opacity-60">
            Download
          </button>
          <button type="button" onClick={() => setSendOpen(true)} disabled={busy} className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100 disabled:opacity-60">
            {r.sentAt ? 'Resend' : 'Send'}
          </button>
          {r.invoiceId && (
            <Link to={`/invoices/${r.invoiceId}`} className="min-h-11 flex items-center rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100">
              View invoice
            </Link>
          )}
        </div>
        {r.sentAt && <p className="mt-2 text-xs text-navy-500">Last sent {formatDateTime(r.sentAt)}</p>}
      </Section>

      <Section title="History">
        {events === null && <p className="text-sm text-navy-500">Loading…</p>}
        {events !== null && events.length === 0 && <p className="text-sm text-navy-500">No history yet.</p>}
        {events !== null && events.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 text-navy-700">
                <span>{invoiceEventLabel(e.eventType)}</span>
                <span className="text-xs text-navy-500">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {sendOpen && (
        <SendDocumentModal
          titleId="send-receipt-title"
          title={r.sentAt ? 'Resend receipt' : 'Send receipt'}
          defaultRecipient={r.customer.email || ''}
          onClose={() => setSendOpen(false)}
          onSend={handleSend}
        />
      )}
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
