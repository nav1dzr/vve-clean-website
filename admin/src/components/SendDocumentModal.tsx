import { useState, type FormEvent, type ReactNode } from 'react';
import Modal from './Modal';

interface Props {
  titleId: string;
  title: string;
  defaultRecipient: string;
  onClose: () => void;
  onSend: (to: string, message: string) => Promise<void>;
  /** Optional read-only context shown above the form — e.g. a payment
   * reminder's "recipient, invoice number, service, amount due, due date"
   * summary, so the admin can confirm what's about to be sent. */
  summary?: ReactNode;
  /** Overrides the submit button's default "Send"/"Sending…" label pair. */
  submitLabel?: string;
  submittingLabel?: string;
}

// Shared by invoice and receipt detail pages for "send"/"resend"/"send
// payment reminder" — lets the admin correct the recipient for this
// specific send without altering the document's own stored customer email
// (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §9).
export default function SendDocumentModal({
  titleId, title, defaultRecipient, onClose, onSend, summary, submitLabel = 'Send', submittingLabel = 'Sending…',
}: Props) {
  const [to, setTo] = useState(defaultRecipient);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    if (!to.trim()) {
      setError('Enter a recipient email address.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend(to.trim(), message.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this email.');
      setSending(false);
    }
  }

  return (
    <Modal titleId={titleId} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {summary && (
          <div className="mb-3 rounded-lg border border-silver-300 bg-silver-50 p-3 text-sm">
            {summary}
          </div>
        )}

        <label htmlFor="send-to" className="mb-1.5 block text-sm font-medium text-navy-900">
          Send to
        </label>
        <input
          id="send-to"
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mb-3 min-h-11 w-full rounded-lg border border-silver-300 px-3 text-base text-navy-950 outline-none focus:border-sky-500"
        />

        <label htmlFor="send-message" className="mb-1.5 block text-sm font-medium text-navy-900">
          Optional message
        </label>
        <textarea
          id="send-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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
            disabled={sending}
            className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
