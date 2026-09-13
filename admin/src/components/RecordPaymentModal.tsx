import { useState, useRef, useEffect, type FormEvent } from 'react';
import Modal from './Modal';
import { INVOICE_PAYMENT_METHOD_VALUES, type RecordPaymentInput } from '../types/invoice';
import { invoicePaymentMethodLabel } from '../lib/format';
import {
  readPendingInvoicePayment, rememberPendingInvoicePayment, clearPendingInvoicePayment,
  type PendingPaymentState,
} from '../lib/pendingInvoicePayment';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';

interface Props {
  amountDue: number;
  ownerId: string;
  invoiceId: string;
  canRecordNew?: boolean;
  onClose: () => void;
  // The parent resolves the matching saved request, closes and refreshes once.
  onConfirm: (input: RecordPaymentInput) => Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Record payment" opens a form, never a one-click action — the amount
// defaults to the current balance but is always editable, since a partial
// payment is a routine case (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §6).
export default function RecordPaymentModal({ amountDue, ownerId, invoiceId, canRecordNew = true, onClose, onConfirm }: Props) {
  const context = { userId: ownerId, invoiceId };
  const [pending, setPending] = useState<PendingPaymentState>(() => readPendingInvoicePayment(context));
  const recovered = pending.status === 'pending' ? pending.input : null;
  const [amount, setAmount] = useState(() => String(recovered?.amount ?? amountDue));
  const [paymentDate, setPaymentDate] = useState(() => recovered?.paymentDate ?? today());
  const [method, setMethod] = useState<string>(() => recovered?.method ?? 'bank_transfer');
  const [reference, setReference] = useState(() => recovered?.reference ?? '');
  const [notes, setNotes] = useState(() => recovered?.notes ?? '');
  const [sendAcknowledgement, setSendAcknowledgement] = useState(() => recovered?.sendAcknowledgement ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const revoked = useRef(false);

  useEffect(() => {
    const stop = () => { revoked.current = true; };
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT, stop);
    return () => window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, stop);
  }, []);

  const numericAmount = Number(amount);
  const isPartial = pending.status === 'pending' ? pending.input.sendAcknowledgement
    : Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount < amountDue;
  const unresolved = pending.status === 'pending' || pending.status === 'review';

  function discardReviewedRequest() {
    if (!reviewed || inFlight.current || revoked.current) return;
    if (!window.confirm('Clear this unresolved request only after checking payment history. This does not undo any payment already recorded. A later submission will be a new payment.')) return;
    if (!clearPendingInvoicePayment(context)) {
      setError('This browser could not clear the request safely. Keep this page open and check its storage settings.');
      return;
    }
    setPending({ status: 'none' });
    setReviewed(false);
    setError(null);
    setAmount(String(amountDue));
    setPaymentDate(today());
    setMethod('bank_transfer');
    setReference('');
    setNotes('');
    setSendAcknowledgement(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current || revoked.current) return;
    if (pending.status === 'unavailable' || pending.status === 'review') return;

    let input: RecordPaymentInput;
    if (pending.status === 'pending') {
      // Retry the original operation exactly. A newly fetched lower/zero balance
      // must not block lookup of a payment that the server already recorded.
      input = pending.input;
    } else {
      if (!canRecordNew || amountDue <= 0) return;
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setError('Enter a payment amount greater than zero.');
        return;
      }
      if (numericAmount > amountDue) {
        setError('Amount cannot exceed the outstanding balance of £' + amountDue.toFixed(2) + '.');
        return;
      }
      if (!paymentDate) {
        setError('Enter the payment date.');
        return;
      }
      input = {
        operationId: crypto.randomUUID(), amount: numericAmount, paymentDate,
        method, reference: reference.trim(), notes: notes.trim(),
        sendAcknowledgement: isPartial && sendAcknowledgement,
      };
    }

    // Never send a request unless its exact identity survives modal close/reload.
    if (!rememberPendingInvoicePayment(context, input)) {
      setPending(readPendingInvoicePayment(context));
      setError('The request could not be kept safely in this browser tab. No payment request was sent. Allow tab storage or resolve earlier unconfirmed requests before continuing.');
      return;
    }
    setPending({ status: 'pending', input });
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(input);
      if (revoked.current) return;
    } catch (err) {
      if (revoked.current) return;
      setError(err instanceof Error ? err.message : 'The payment response could not be confirmed. Review the request before continuing.');
    } finally {
      inFlight.current = false;
      if (!revoked.current) setSubmitting(false);
    }
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1.5 block text-sm font-medium text-navy-900';

  return (
    <Modal titleId="record-payment-title" title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-sm text-navy-700">This is an internal record only — it never charges the customer or touches Stripe.</p>

        {unresolved && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">An earlier payment request has not been confirmed in this tab.</p>
            <p className="mt-1">
              {pending.status === 'pending'
                ? 'Its details are locked to avoid recording the same money twice. Retry the same request, or close this form and review payment history before clearing it.'
                : 'The saved request expired or could not be read. Its personal details were removed. Review payment history before clearing this warning or recording anything new.'}
            </p>
            <button type="button" onClick={onClose} className="mt-2 min-h-11 rounded-lg border border-amber-400 px-3 font-medium">
              Close and review payment history
            </button>
            <label className="mt-3 flex items-start gap-2">
              <input type="checkbox" checked={reviewed} disabled={submitting} onChange={(e) => setReviewed(e.target.checked)} className="mt-1 h-4 w-4" />
              I have checked the invoice payment history and reviewed whether this request was already recorded.
            </label>
            <button type="button" disabled={!reviewed || submitting} onClick={discardReviewedRequest} className="mt-2 min-h-11 rounded-lg border border-amber-400 px-3 font-medium disabled:opacity-50">
              Clear reviewed request
            </button>
          </div>
        )}
        {pending.status === 'unavailable' && (
          <p role="alert" className="mb-3 text-sm text-red-600">This browser cannot preserve a payment request safely. Allow tab storage before recording payments.</p>
        )}
        {!canRecordNew && !unresolved && (
          <p className="mb-3 text-sm text-navy-700">No new payment can be recorded for this invoice in its current state.</p>
        )}
        <fieldset disabled={submitting || pending.status !== 'none' || !canRecordNew} className="min-w-0">
        <label htmlFor="payment-amount" className="mb-1.5 block text-sm font-medium text-navy-900">
          Amount (£) — outstanding balance is £{amountDue.toFixed(2)}
        </label>
        <input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`mb-3 ${inputClass}`} />

        <label htmlFor="payment-date" className={labelClass}>Payment date</label>
        <input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={`mb-3 ${inputClass}`} />

        <label htmlFor="payment-method" className={labelClass}>Method</label>
        <select id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)} className={`mb-3 ${inputClass}`}>
          {INVOICE_PAYMENT_METHOD_VALUES.map((m) => (
            <option key={m} value={m}>{invoicePaymentMethodLabel(m)}</option>
          ))}
        </select>

        <label htmlFor="payment-reference" className={labelClass}>Reference (optional)</label>
        <input id="payment-reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={`mb-3 ${inputClass}`} />

        <label htmlFor="payment-notes" className={labelClass}>Internal note (optional)</label>
        <textarea id="payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />

        {isPartial && (
          <label className="mt-3 flex items-start gap-2 text-sm text-navy-900">
            <input
              type="checkbox"
              checked={sendAcknowledgement}
              onChange={(e) => setSendAcknowledgement(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-silver-300"
            />
            <span>
              Send payment acknowledgement email to the customer
              <span className="block text-xs text-navy-500">Confirms the amount received and the remaining balance. This is a partial payment — the final receipt is only sent once the invoice is paid in full.</span>
            </span>
          </label>
        )}

        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || pending.status === 'unavailable' || pending.status === 'review' || (pending.status === 'none' && (!canRecordNew || amountDue <= 0))}
            className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Recording…' : pending.status === 'pending' ? 'Retry same request' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
