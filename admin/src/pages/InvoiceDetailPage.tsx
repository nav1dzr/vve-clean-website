import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authFetch, authFetchBlob, ApiError } from '../lib/authFetch';
import { openPdfBlob } from '../lib/pdf';
import type {
  InvoiceDetail, InvoiceDraftInput, IssueResponse, DownloadUrlResponse,
  RecordPaymentResponse, DuplicateResponse, InvoiceEvent, InvoiceEventsResponse, SendResponse,
  ReceiptListResponse,
} from '../types/invoice';
import InvoiceItemsForm, { emptyFormValue } from '../components/InvoiceItemsForm';
import RecordPaymentModal from '../components/RecordPaymentModal';
import VoidInvoiceModal from '../components/VoidInvoiceModal';
import SendDocumentModal from '../components/SendDocumentModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import {
  invoiceDocumentStatusBadge, invoicePaymentStatusBadge, invoicePaymentMethodLabel, invoiceEventLabel,
  formatMoney, formatDateTime, isInvoiceOverdue,
} from '../lib/format';

const PAYMENT_OPTION_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  stripe_payment_link: 'Stripe payment link',
  both: 'Bank transfer and Stripe payment link',
};

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: InvoiceDetail };

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [events, setEvents] = useState<InvoiceEvent[] | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'payment' | 'void' | 'send' | 'remind'>(null);
  const [pendingAction, setPendingAction] = useState<null | 'issue' | 'delete'>(null);

  function load() {
    if (!id) return;
    setState({ status: 'loading' });
    setReceiptId(null);
    authFetch<InvoiceDetail>(`/api/invoices/${id}`)
      .then((data) => {
        setState({ status: 'success', data });
        authFetch<InvoiceEventsResponse>(`/api/invoices/${id}?action=events`)
          .then((r) => setEvents(r.results))
          .catch(() => setEvents([]));
        // Fully paid — the "send invoice" flow is retired in favour of the
        // receipt (see handleSend's paid-invoice block on the server); look
        // it up so the UI can link straight to it.
        if (data.paymentStatus === 'paid') {
          authFetch<ReceiptListResponse>(`/api/receipts?invoiceId=${id}&pageSize=1`)
            .then((r) => setReceiptId(r.results[0]?.id || null))
            .catch(() => setReceiptId(null));
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setState({ status: 'not-found' });
        else setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this invoice.' });
      });
  }

  useEffect(load, [id]);

  async function handleSaveDraft(input: InvoiceDraftInput) {
    if (!id) return;
    setActionError(null);
    await authFetch(`/api/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    load();
  }

  async function handleIssue() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      await authFetch<IssueResponse>(`/api/invoices/${id}?action=issue`, { method: 'POST' });
      setPendingAction(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not issue this invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDraft() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      navigate('/invoices', { replace: true });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete this draft.');
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await authFetch<DuplicateResponse>(`/api/invoices/${id}?action=duplicate`, { method: 'POST' });
      navigate(`/invoices/${result.invoiceId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not duplicate this invoice.');
      setBusy(false);
    }
  }

  async function handleVoid(reason: string) {
    if (!id) return;
    await authFetch(`/api/invoices/${id}?action=void`, { method: 'POST', body: JSON.stringify({ reason }) });
    setModal(null);
    load();
  }

  async function handlePreview() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      const blob = await authFetchBlob(`/api/invoices/${id}?action=preview`);
      openPdfBlob(blob);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not generate a preview.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await authFetch<DownloadUrlResponse>(`/api/invoices/${id}?action=download`);
      window.open(result.url, '_blank', 'noopener');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not download this invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(to: string, message: string) {
    if (!id || state.status !== 'success') return;
    const action = state.data.sentAt ? 'resend' : 'send';
    await authFetch<SendResponse>(`/api/invoices/${id}?action=${action}`, {
      method: 'POST',
      body: JSON.stringify({ to, message: message || undefined }),
    });
    setModal(null);
    load();
  }

  async function handleRemind(to: string, message: string) {
    if (!id) return;
    await authFetch<SendResponse>(`/api/invoices/${id}?action=remind`, {
      method: 'POST',
      body: JSON.stringify({ to, message: message || undefined }),
    });
    setModal(null);
    load();
  }

  async function handleRecordPayment(input: { amount: number; paymentDate: string; method: string; reference: string; notes: string; sendAcknowledgement: boolean }) {
    if (!id) return;
    const { sendAcknowledgement, ...rest } = input;
    const result = await authFetch<RecordPaymentResponse>(`/api/invoices/${id}?action=payments`, {
      method: 'POST',
      body: JSON.stringify(rest),
    });
    // Best-effort: the payment is already recorded regardless of whether
    // this succeeds — never let an acknowledgement-email failure look like
    // the payment itself failed to save.
    if (sendAcknowledgement && result.paymentStatus === 'partially_paid') {
      try {
        await authFetch(`/api/invoices/${id}?action=paymentAck`, {
          method: 'POST',
          body: JSON.stringify({ paymentId: result.paymentId }),
        });
      } catch {
        // Swallowed deliberately — see comment above. The event log
        // (payment_ack_failed) is the record of this, not a UI error here.
      }
    }
    setModal(null);
    load();
  }

  async function handleReversePayment(paymentId: string) {
    if (!id) return;
    const reason = window.prompt('Reason for reversing this payment?');
    if (!reason || !reason.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await authFetch(`/api/invoices/${id}?action=paymentsReverse&paymentId=${paymentId}`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reverse this payment.');
    } finally {
      setBusy(false);
    }
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
          title="Invoice not found"
          description="It may have been removed, or the link may be incorrect."
          action={<Link to="/invoices" className="text-sm text-sky-600 hover:text-sky-700">Back to invoices</Link>}
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

  const inv = state.data;
  const isDraft = inv.documentStatus === 'draft';
  const overdue = isInvoiceOverdue(inv.documentStatus, inv.amountDue, inv.dueDate);

  if (isDraft) {
    const initial = emptyFormValue({
      customer: inv.customer,
      items: inv.items.map((i) => ({ key: i.id, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineDiscount: i.lineDiscount })),
      poReference: inv.poReference || '',
      issueDate: inv.issueDate || '',
      dueDate: inv.dueDate || '',
      serviceDate: inv.serviceDate || '',
      documentDiscount: inv.documentDiscount,
      depositApplied: inv.depositApplied,
      customerNotes: inv.customerNotes || '',
      internalNotes: inv.internalNotes || '',
      paymentTerms: inv.paymentTerms || '',
      paymentOption: inv.paymentOption,
      stripePaymentLinkUrl: inv.stripePaymentLinkUrl || '',
      serviceContact: {
        name: inv.serviceContact?.name || '',
        email: inv.serviceContact?.email || '',
        phone: inv.serviceContact?.phone || '',
        address: inv.serviceContact?.address || '',
        postcode: inv.serviceContact?.postcode || '',
      },
      invoiceRecipientEmail: inv.invoiceRecipientEmail || '',
      receiptRecipientEmail: inv.receiptRecipientEmail || '',
      billingCustomerId: inv.billingCustomerId,
      serviceCustomerId: inv.serviceCustomerId,
    });

    return (
      <div className="px-4 py-6 pb-32 sm:px-6 sm:pb-6">
        <Link to="/invoices" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">← Invoices</Link>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-semibold text-xl text-navy-950">{inv.customer.name} — draft invoice</h1>
          <StatusBadge {...invoiceDocumentStatusBadge(inv.documentStatus)} />
        </div>

        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            This is a draft — no formal number is allocated yet. Save your changes, then issue it when it&apos;s ready.
          </p>
        </div>

        <InvoiceItemsForm
          initial={initial}
          onSubmit={handleSaveDraft}
          submitLabel="Save changes"
          submitting={busy}
          error={actionError}
          secondaryAction={{ label: 'Preview PDF', onClick: () => void handlePreview(), disabled: busy }}
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPendingAction('issue')}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg border border-navy-950 px-4 text-sm font-semibold text-navy-950 hover:bg-navy-950 hover:text-white disabled:opacity-60"
          >
            Issue invoice
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('delete')}
            disabled={busy}
            className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Delete draft
          </button>
        </div>

        {pendingAction === 'issue' && (
          <ConfirmBox
            message="Issue this invoice? It will be allocated a permanent invoice number and can no longer be edited directly — corrections after this point use “Duplicate as corrected draft”."
            confirmLabel="Issue invoice"
            onCancel={() => setPendingAction(null)}
            onConfirm={() => void handleIssue()}
          />
        )}
        {pendingAction === 'delete' && (
          <ConfirmBox
            message="Delete this draft? This cannot be undone."
            confirmLabel="Delete draft"
            destructive
            onCancel={() => setPendingAction(null)}
            onConfirm={() => void handleDeleteDraft()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-32 sm:px-6 sm:pb-6">
      <Link to="/invoices" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">← Invoices</Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-xl text-navy-950">{inv.invoiceNumber}</h1>
          <p className="text-sm text-navy-700">{inv.customer.name}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge {...invoiceDocumentStatusBadge(inv.documentStatus)} />
          <StatusBadge {...invoicePaymentStatusBadge(inv.paymentStatus)} />
          {overdue && <StatusBadge label="Overdue" className="bg-red-100 text-red-700" />}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p>
      )}

      <Section title="Summary">
        <dl className="space-y-1.5 text-sm">
          <Row label="Total" value={formatMoney(inv.total)} />
          <Row label="Deposit applied" value={formatMoney(inv.depositApplied)} />
          <Row label="Amount paid" value={formatMoney(inv.amountPaid)} />
          <Row label="Amount due" value={formatMoney(inv.amountDue)} strong />
          <Row label="Issue date" value={inv.issueDate || '—'} />
          <Row label="Due date" value={inv.dueDate || '—'} />
          {inv.bookingRefSnapshot && <Row label="Booking ref" value={inv.bookingRefSnapshot} />}
        </dl>
      </Section>

      <Section title="Billing contact">
        <p className="font-medium text-navy-950">{inv.customer.name}</p>
        <p className="text-sm text-navy-700">{inv.customer.email || 'Email not recorded'}</p>
        <p className="text-sm text-navy-700">{inv.customer.phone || 'Phone not recorded'}</p>
        <p className="text-sm text-navy-700">{[inv.customer.address, inv.customer.postcode].filter(Boolean).join(', ') || 'Address not recorded'}</p>
        {(inv.invoiceRecipientEmail || inv.receiptRecipientEmail) && (
          <dl className="mt-2 space-y-1 border-t border-silver-200 pt-2 text-sm">
            {inv.invoiceRecipientEmail && <Row label="Invoice sent to" value={inv.invoiceRecipientEmail} />}
            {inv.receiptRecipientEmail && <Row label="Receipt sent to" value={inv.receiptRecipientEmail} />}
          </dl>
        )}
      </Section>

      {inv.serviceContact && (
        <Section title="Service address">
          {inv.serviceContact.name && <p className="font-medium text-navy-950">{inv.serviceContact.name}</p>}
          {inv.serviceContact.email && <p className="text-sm text-navy-700">{inv.serviceContact.email}</p>}
          {inv.serviceContact.phone && <p className="text-sm text-navy-700">{inv.serviceContact.phone}</p>}
          <p className="text-sm text-navy-700">{[inv.serviceContact.address, inv.serviceContact.postcode].filter(Boolean).join(', ') || 'Address not recorded'}</p>
        </Section>
      )}

      <Section title="Payment instructions">
        <Row label="Payment option" value={PAYMENT_OPTION_LABELS[inv.paymentOption] || inv.paymentOption} />
        {inv.stripePaymentLinkUrl && (
          <p className="mt-2 text-sm">
            <a href={inv.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700">
              Open Stripe payment link ↗
            </a>
          </p>
        )}
        <p className="mt-2 text-xs text-navy-500">Bank details (if configured) appear on the PDF and in the email — not repeated here.</p>
      </Section>

      <Section title="Line items">
        <div className="space-y-2">
          {inv.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 border-t border-silver-200 pt-2 text-sm first:border-t-0 first:pt-0">
              <div>
                <p className="text-navy-950">{item.description}</p>
                <p className="text-xs text-navy-500">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                  {item.lineDiscount ? ` − ${formatMoney(item.lineDiscount)} discount` : ''}
                </p>
              </div>
              <p className="shrink-0 font-medium text-navy-950">{formatMoney(item.lineTotal)}</p>
            </div>
          ))}
        </div>
      </Section>

      {inv.documentStatus === 'issued' && (
        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Preview" onClick={() => void handlePreview()} disabled={busy} />
            <ActionButton label="Download" onClick={() => void handleDownload()} disabled={busy} />
            {inv.paymentStatus === 'paid' ? (
              receiptId && (
                <Link
                  to={`/receipts/${receiptId}`}
                  className="min-h-11 flex items-center rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100"
                >
                  View / send receipt
                </Link>
              )
            ) : (
              <ActionButton label={inv.sentAt ? 'Resend' : 'Send'} onClick={() => setModal('send')} disabled={busy} />
            )}
            <ActionButton label="Record payment" onClick={() => setModal('payment')} disabled={busy || inv.amountDue <= 0} primary />
            {inv.amountDue > 0 && (
              <ActionButton label="Send payment reminder" onClick={() => setModal('remind')} disabled={busy} />
            )}
            <ActionButton label="Duplicate as corrected draft" onClick={() => void handleDuplicate()} disabled={busy} />
            <ActionButton label="Void" onClick={() => setModal('void')} disabled={busy} danger />
          </div>
          {inv.sentAt && inv.paymentStatus !== 'paid' && <p className="mt-2 text-xs text-navy-500">Last sent {formatDateTime(inv.sentAt)}</p>}
        </Section>
      )}

      {(inv.documentStatus === 'void' || inv.documentStatus === 'cancelled') && (
        <Section title="Void reason">
          <p className="text-sm text-navy-700">{inv.voidReason || 'No reason recorded'}</p>
          <div className="mt-2">
            <ActionButton label="Preview" onClick={() => void handlePreview()} disabled={busy} />
          </div>
        </Section>
      )}

      <Section title="Payment history">
        {inv.payments.length === 0 && <p className="text-sm text-navy-500">No payments recorded yet.</p>}
        {inv.payments.length > 0 && (
          <ul className="space-y-3">
            {inv.payments.map((p) => (
              <li key={p.id} className="border-t border-silver-200 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${p.reversedAt ? 'text-navy-500 line-through' : 'text-navy-950'}`}>
                    {formatMoney(p.amount)} · {invoicePaymentMethodLabel(p.method)}
                  </p>
                  {!p.reversedAt && (
                    <button type="button" onClick={() => void handleReversePayment(p.id)} className="text-xs text-red-700 hover:underline">
                      Reverse
                    </button>
                  )}
                </div>
                <p className="text-xs text-navy-500">
                  {p.paymentDate} {p.reference ? `· ${p.reference}` : ''}
                  {p.reversedAt ? ` · reversed: ${p.reversalReason || ''}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
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

      {modal === 'payment' && (
        <RecordPaymentModal amountDue={inv.amountDue} onClose={() => setModal(null)} onConfirm={handleRecordPayment} />
      )}
      {modal === 'void' && <VoidInvoiceModal onClose={() => setModal(null)} onConfirm={handleVoid} />}
      {modal === 'send' && (
        <SendDocumentModal
          titleId="send-invoice-title"
          title={inv.sentAt ? 'Resend invoice' : 'Send invoice'}
          defaultRecipient={inv.customer.email || ''}
          onClose={() => setModal(null)}
          onSend={handleSend}
        />
      )}
      {modal === 'remind' && (
        <SendDocumentModal
          titleId="remind-invoice-title"
          title="Send payment reminder"
          defaultRecipient={inv.customer.email || ''}
          onClose={() => setModal(null)}
          onSend={handleRemind}
          submitLabel="Send reminder"
          submittingLabel="Sending reminder…"
          summary={
            <dl className="space-y-1">
              <Row label="Invoice" value={inv.invoiceNumber || '—'} />
              <Row label="Service" value={inv.items[0]?.description || '—'} />
              <Row label="Amount due" value={formatMoney(inv.amountDue)} strong />
              <Row label="Due date" value={inv.dueDate || '—'} />
            </dl>
          }
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

function ActionButton({
  label, onClick, disabled, primary, danger,
}: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  const base = 'min-h-11 rounded-lg px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60';
  const style = primary
    ? 'bg-navy-950 text-white font-semibold hover:bg-navy-900'
    : danger
      ? 'border border-red-300 text-red-700 hover:bg-red-50'
      : 'border border-silver-300 text-navy-900 hover:bg-silver-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {label}
    </button>
  );
}

function ConfirmBox({
  message, confirmLabel, destructive, onCancel, onConfirm,
}: { message: string; confirmLabel: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div role="alertdialog" aria-label="Confirm action" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="mb-2 text-amber-900">{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-navy-950 hover:bg-navy-900'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
