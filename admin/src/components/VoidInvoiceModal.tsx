import { useState, type FormEvent } from 'react';
import Modal from './Modal';

interface Props {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function VoidInvoiceModal({ onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
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
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
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
          needs correcting instead, use &ldquo;Duplicate as corrected draft&rdquo;.
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
