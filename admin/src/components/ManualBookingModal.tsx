import { useEffect, useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import type { ManualBookingInput } from '../types/customer';
import { ApiError, authFetch } from '../lib/authFetch';
import type { BookingDetail } from '../types/booking';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';
import { clearPendingManualBooking, readPendingManualBooking, rememberPendingManualBooking } from '../lib/pendingManualBooking';

interface Props {
  onClose: () => void;
  onCreate: (input: ManualBookingInput) => Promise<void>;
  customerEmail?: string | null;
  ownerId: string;
  customerId: string;
}

// For work arranged by phone/WhatsApp/email that never goes through the
// public quote/checkout flow — always a manual record, never touches
// Stripe (see admin/api/_lib/customerLifecycle.js's createManualBooking).
export default function ManualBookingModal(props: Props) {
  return <ManualBookingForm key={`${props.ownerId}:${props.customerId}`} {...props} />;
}

function ManualBookingForm({ onClose, onCreate, customerEmail, ownerId, customerId }: Props) {
  const [recovery, setRecovery] = useState(() => readPendingManualBooking(ownerId, customerId));
  const recovered = recovery.status === 'pending' ? recovery.input : null;
  const [service, setService] = useState(recovered?.service || '');
  const [serviceDate, setServiceDate] = useState(recovered?.serviceDate || '');
  const [totalPrice, setTotalPrice] = useState(recovered?.totalPrice == null ? '' : String(recovered.totalPrice));
  const [notes, setNotes] = useState(recovered?.notes || '');
  const [arrivalWindow, setArrivalWindow] = useState(recovered?.arrivalWindow || '');
  const [paymentPlan, setPaymentPlan] = useState<ManualBookingInput['paymentPlan'] | ''>(recovered?.paymentPlan || '');
  const [email, setEmail] = useState(recovered?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [savedBooking, setSavedBooking] = useState<{ id: string; reference: string } | null>(null);
  const [revoked, setRevoked] = useState(false);
  const revokedRef = useRef(false);
  const pending = useRef<ManualBookingInput | null>(recovered);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = revoked || recovery.status === 'review' || recovery.status === 'unavailable';
  useEffect(() => {
    const clear = () => { revokedRef.current = true; setRevoked(true); };
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT, clear);
    return () => window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, clear);
  }, []);
  const reviewId = recovery.status === 'review' ? recovery.requestId : undefined;
  useEffect(() => {
    if (!reviewId || revoked) return;
    let active = true;
    authFetch<BookingDetail>(`/api/bookings/${reviewId}`).then((booking) => {
      if (active && booking.id === reviewId && booking.quoteConfig?.manualCustomerId === customerId
        && booking.quoteConfig?.manualAdminId === ownerId) {
        setSavedBooking({ id: booking.id, reference: booking.bookingRef || 'Reference not recorded' });
      }
    }).catch(() => { /* Keep the history-review path when lookup is unavailable. */ });
    return () => { active = false; };
  }, [reviewId, revoked, customerId, ownerId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current || revokedRef.current || blocked) return;
    if (!service.trim()) {
      setError('Enter what service this booking is for.');
      return;
    }
    if (!paymentPlan) {
      setError('Choose £30 deposit or no deposit for this booking.');
      return;
    }
    const input: ManualBookingInput = pending.current || {
      requestId: crypto.randomUUID(),
      service: service.trim(), serviceDate: serviceDate || null,
      totalPrice: totalPrice ? Number(totalPrice) : null, notes: notes.trim() || null,
      paymentPlan, arrivalWindow: arrivalWindow.trim() || null,
      ...(!customerEmail && email.trim() ? { email: email.trim() } : {}),
    };
    if (!rememberPendingManualBooking(ownerId, customerId, input)) {
      setRecovery(readPendingManualBooking(ownerId, customerId));
      setError('This browser could not safely keep this booking for recovery. No request was sent. Allow session storage, then check the customer booking history before trying again.');
      return;
    }
    pending.current = input;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(input);
      if (!revokedRef.current) clearPendingManualBooking(ownerId, customerId, input.requestId);
    } catch (err) {
      if (revokedRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not create this booking.');
      if (err instanceof ApiError && err.status === 400 && clearPendingManualBooking(ownerId, customerId, input.requestId)) {
        pending.current = null;
        setRecovery({ status: 'none' });
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  function clearReviewed() {
    if (!reviewed || submittingRef.current || revokedRef.current
      || !window.confirm('Clear this recovery request after checking the customer booking history? Any saved booking will stay unchanged. Creating a booking afterwards starts a different booking, not a retry.')) return;
    if (!clearPendingManualBooking(ownerId, customerId)) return setError('Could not clear this recovery record. Check browser storage before continuing.');
    pending.current = null;
    setRecovery({ status: 'none' });
    setReviewed(false);
    setError(null);
  }

  function startDifferentBooking() {
    if (!savedBooking || submittingRef.current || revokedRef.current) return;
    if (!clearPendingManualBooking(ownerId, customerId, savedBooking.id)) return setError('Could not clear this recovery record. Reopen the form before continuing.');
    pending.current = null;
    setSavedBooking(null);
    setRecovery({ status: 'none' });
    setReviewed(false);
    setError(null);
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  return (
    <Modal titleId="manual-booking-title" title="Create manual booking" onClose={() => { if (!submittingRef.current) onClose(); }}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-sm text-navy-700">
          Add work agreed by phone, message or Checkatrade. Review the details and email on the next screen before sending anything.
        </p>
        {(pending.current || recovery.status === 'review') && <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p>{recovery.status === 'review' ? 'An earlier request could not be safely restored. It may already be saved.' : 'Your original request is kept for a safe retry, including after refreshing. Retry checks the same booking instead of creating another.'}</p>
          <a href={`/customers/${encodeURIComponent(customerId)}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline">Check customer booking history</a>
          {savedBooking && <div className="mt-3 rounded-lg bg-white p-3">
            <p>The earlier booking was saved. Open it to continue; there is no need to create it again.</p>
            <a href={`/bookings/${savedBooking.id}`} onClick={() => { if (!revokedRef.current) clearPendingManualBooking(ownerId, customerId, savedBooking.id); }} className="mt-2 block font-semibold underline">Open saved booking {savedBooking.reference}</a>
            <button type="button" onClick={startDifferentBooking} disabled={submitting || revoked} className="mt-2 min-h-11 rounded-lg border border-amber-600 px-3 font-semibold">Start a different booking</button>
          </div>}
          <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={submitting || revoked} />I checked the booking history and have accounted for any earlier booking.</label>
          <button type="button" disabled={!reviewed || submitting || revoked} onClick={clearReviewed} className="mt-2 min-h-11 rounded-lg border border-amber-600 px-3 font-semibold disabled:opacity-50">Clear reviewed request</button>
        </section>}
        {recovery.status === 'unavailable' && <p role="alert" className="mb-3 text-sm text-red-700">Session storage is unavailable. Allow it and reopen this form so a lost response cannot create duplicate bookings.</p>}
        {revoked && <p role="alert" className="mb-3 text-sm text-red-700">Your account access changed. Sign in again before creating a booking.</p>}
        <fieldset disabled={submitting || !!pending.current || blocked} className="min-w-0">
        <label className="mb-3 block">
          <span className={labelClass}>Service *</span>
          <input type="text" list="manual-booking-services" value={service} onChange={(e) => setService(e.target.value)} placeholder="Choose or type a service" className={inputClass} />
          <datalist id="manual-booking-services">
            {['Carpet cleaning', 'Sofa & upholstery cleaning', 'End of tenancy cleaning', 'After builders cleaning', 'Window cleaning', 'Gutter cleaning', 'Office cleaning'].map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Service date</span>
          <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Arrival window</span>
          <input type="text" value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} maxLength={40} placeholder="e.g. 09:00–11:00" className={inputClass} />
          <span className="mt-1 block text-xs text-navy-600">Optional now. Confirm the arrival window before sending.</span>
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Total price (£)</span>
          <input type="number" min="0" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="mb-3 block">
          <span className={labelClass}>Payment arrangement *</span>
          <select value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value as ManualBookingInput['paymentPlan'] | '')} className={inputClass}>
            <option value="">Choose for this booking…</option>
            <option value="deposit_after_agreement">£30 deposit — confirm after payment</option>
            <option value="after_clean">No deposit — payment on the cleaning day</option>
          </select>
          <span className="mt-1 block text-xs text-navy-600">You can review this choice before sending the booking email.</span>
        </label>
        {!customerEmail && <label className="mb-3 block">
          <span className={labelClass}>Email for booking confirmation (optional)</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-navy-600">This customer has no saved email. Add one to email this booking; otherwise keep it as a manual record.</span>
        </label>}
        <label className="mb-3 block">
          <span className={labelClass}>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />
        </label>
        </fieldset>

        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" disabled={submitting} onClick={onClose} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting || blocked} className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Creating…' : pending.current ? 'Retry same booking' : 'Create booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
