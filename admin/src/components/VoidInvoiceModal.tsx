import { useState, type FormEvent } from 'react';
import Modal from './Modal';

interface Props {
  onClose: () => void;
  onConfirm: (reason: string, acknowledgePayments: boolean) => Promise<void>;
  /** True when money or a receipt is recorded against the invoice. */
  hasPayments?: boolean;
}

export default function VoidInvoiceModal({ onClose, onConfirm, hasPayments = false }: Props) {
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A reason is required to void an invoice.');
      return;
    }
    if (hasPayments && !acknowledged) {
      setError('Tick the box to confirm you have checked the payment history.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed, hasPayments && acknowledged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void this invoice.');
      setSubmitting(false);
    }
  }

  return (
    <Modal titleId="void-invoice-title" title="Void this invoice" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-sm text-navy-700">
          The invoice number stays permanently retired — it is never reused. This cannot be undone; if the invoice
          needs correcting instead, use &ldquo;Adjust services or price&rdquo;.
        </p>
        <label htmlFor="void-reason" className="mb-1.5 block text-sm font-medium text-navy-900">
          Reason *
        </label>
        <textarea
          id="void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500"
        />

        {hasPayments && (
          <label className="mt-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>This invoice has a recorded payment or receipt. Voiding does not refund the customer or reverse the payment, and the receipt can no longer be emailed. I have checked the payment history.</span>
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
            className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Voiding…' : 'Void invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
