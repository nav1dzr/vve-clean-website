import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import { INVOICE_PAYMENT_METHOD_VALUES } from '../types/invoice';
import { invoicePaymentMethodLabel } from '../lib/format';

interface Props {
  amountDue: number;
  onClose: () => void;
  onConfirm: (input: { amount: number; paymentDate: string; method: string; reference: string; notes: string; sendAcknowledgement: boolean }) => Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Record payment" opens a form, never a one-click action — the amount
// defaults to the current balance but is always editable, since a partial
// payment is a routine case (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §6).
export default function RecordPaymentModal({ amountDue, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState(String(amountDue));
  const [paymentDate, setPaymentDate] = useState(today());
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [sendAcknowledgement, setSendAcknowledgement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  // Only a payment that leaves a balance is "partial" — the acknowledgement
  // email's wording ("the remaining balance is £X") only makes sense then;
  // a payment that clears the invoice gets the receipt instead (see
  // InvoiceDetailPage's handleRecordPayment).
  const isPartial = Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount < amountDue;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    if (numericAmount > amountDue) {
      setError(`Amount cannot exceed the outstanding balance of £${amountDue.toFixed(2)}.`);
      return;
    }
    if (!paymentDate) {
      setError('Enter the payment date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        amount: numericAmount, paymentDate, method, reference: reference.trim(), notes: notes.trim(),
        sendAcknowledgement: isPartial && sendAcknowledgement,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this payment.');
      setSubmitting(false);
    }
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1.5 block text-sm font-medium text-navy-900';

  return (
    <Modal titleId="record-payment-title" title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-sm text-navy-700">This is an internal record only — it never charges the customer or touches Stripe.</p>

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
            disabled={submitting}
            className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
