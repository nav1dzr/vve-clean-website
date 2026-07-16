import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import type { ManualBookingInput } from '../types/customer';

interface Props {
  onClose: () => void;
  onCreate: (input: ManualBookingInput) => Promise<void>;
}

// For work arranged by phone/WhatsApp/email that never goes through the
// public quote/checkout flow — always a manual record, never touches
// Stripe (see admin/api/_lib/customerLifecycle.js's createManualBooking).
export default function ManualBookingModal({ onClose, onCreate }: Props) {
  const [service, setService] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!service.trim()) {
      setError('Enter what service this booking is for.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        service: service.trim(),
        serviceDate: serviceDate || null,
        totalPrice: totalPrice ? Number(totalPrice) : null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this booking.');
      setSubmitting(false);
    }
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  return (
    <Modal titleId="manual-booking-title" title="Create manual booking" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-sm text-navy-700">
          This creates a booking record only — it never charges a card or touches Stripe.
        </p>
        <label className="mb-3 block">
          <span className={labelClass}>Service *</span>
          <input type="text" value={service} onChange={(e) => setService(e.target.value)} className={inputClass} />
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Service date</span>
          <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Total price (£)</span>
          <input type="number" min="0" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />
        </label>

        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
