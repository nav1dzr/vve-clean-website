import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import StructuredAddressFields from '../components/StructuredAddressFields';
import { authFetch, ApiError } from '../lib/authFetch';
import { invoicePaymentMethodLabel } from '../lib/format';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';
import { clearStandaloneReceiptDraft, readStandaloneReceiptDraft, writeStandaloneReceiptDraft, type StandaloneReceiptDraft } from '../lib/standaloneReceiptDraft';
import { clearPendingStandaloneReceipt, readPendingStandaloneReceipt, rememberPendingStandaloneReceipt, type PendingReceiptState } from '../lib/pendingStandaloneReceipt';
import {
  INVOICE_PAYMENT_METHOD_VALUES,
  type CreateReceiptResponse,
  type ReceiptDetail,
  type StandaloneReceiptInput,
} from '../types/invoice';

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function ReceiptEditorPage() {
  const { admin } = useAuth();
  if (!admin?.id) return <p role="alert">Sign in to create a receipt.</p>;
  return <ReceiptEditorForm key={admin.id} ownerId={admin.id} />;
}

function ReceiptEditorForm({ ownerId }: { ownerId: string }) {
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState<PendingReceiptState>(() => readPendingStandaloneReceipt(ownerId));
  const recoveredInput = recovery.status === 'pending' ? recovery.input : null;
  // Submitted operations always take precedence over an older unsent form.
  const [draftAtOpen] = useState(() => recovery.status === 'none' ? readStandaloneReceiptDraft(ownerId) : null);
  const restoredDraft = draftAtOpen?.status === 'restored' ? draftAtOpen.draft : null;
  const [initialDate] = useState(today);
  const [customer, setCustomer] = useState(() => ({ name: recoveredInput?.customer.name || restoredDraft?.customer.name || '', email: recoveredInput?.customer.email || restoredDraft?.customer.email || '', phone: recoveredInput?.customer.phone || restoredDraft?.customer.phone || '', address: recoveredInput?.customer.address || restoredDraft?.customer.address || '', postcode: recoveredInput?.customer.postcode || restoredDraft?.customer.postcode || '' }));
  const [serviceDescription, setServiceDescription] = useState(recoveredInput?.serviceDescription || restoredDraft?.serviceDescription || '');
  const [amount, setAmount] = useState(recoveredInput ? String(recoveredInput.amount) : restoredDraft?.amount || '');
  const [paymentDate, setPaymentDate] = useState(recoveredInput?.paymentDate || restoredDraft?.paymentDate || initialDate);
  const [paymentMethod, setPaymentMethod] = useState<(typeof INVOICE_PAYMENT_METHOD_VALUES)[number]>(recoveredInput?.paymentMethod || restoredDraft?.paymentMethod || 'bank_transfer');
  const [paymentReference, setPaymentReference] = useState(recoveredInput?.paymentReference || restoredDraft?.paymentReference || '');
  const [showRestoredDraft, setShowRestoredDraft] = useState(!!restoredDraft);
  const [draftStorageAvailable, setDraftStorageAvailable] = useState(draftAtOpen?.status !== 'unavailable');
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const [confirmed, setConfirmed] = useState(!!recoveredInput);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedReceipts, setReviewedReceipts] = useState(false);
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'checking' | 'missing' | 'error'>('idle');
  const [lookupRetry, setLookupRetry] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const pendingInput = useRef<StandaloneReceiptInput | null>(recoveredInput);
  const submittingRef = useRef(false);
  const revokedRef = useRef(false);
  const activeRef = useRef(true);
  const recoveryBlocked = recovery.status === 'review' || recovery.status === 'unavailable' || revoked || !!savedReceiptId;
  const draftStopped = useRef(false);
  const draftWritten = useRef(!!restoredDraft);
  const draft: StandaloneReceiptDraft = { customer, serviceDescription, amount, paymentDate, paymentMethod, paymentReference };
  const hasDraftContent = Object.values(customer).some(Boolean) || !!serviceDescription || !!amount || !!paymentReference || paymentMethod !== 'bank_transfer' || paymentDate !== today();
  const draftFingerprint = JSON.stringify(draft);
  const latestDraft = useRef({ draft, hasDraftContent, blocked: true });
  latestDraft.current = { draft, hasDraftContent, blocked: recoveryBlocked || !!pendingInput.current || submitting };

  useEffect(() => {
    const latest = latestDraft.current;
    if (!draftStopped.current && !revokedRef.current && !latest.blocked && (latest.hasDraftContent || draftWritten.current)) {
      const saved = writeStandaloneReceiptDraft(ownerId, latest.draft);
      if (saved) draftWritten.current = true;
      setDraftStorageAvailable(saved);
    }
  }, [ownerId, draftFingerprint, recoveryBlocked, submitting]);

  useEffect(() => {
    const persist = () => {
      const latest = latestDraft.current;
      if (!draftStopped.current && !revokedRef.current && !latest.blocked && (latest.hasDraftContent || draftWritten.current)) {
        const saved = writeStandaloneReceiptDraft(ownerId, latest.draft);
        if (saved) draftWritten.current = true;
        setDraftStorageAvailable(saved);
      }
    };
    const hide = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [ownerId]);


  useEffect(() => {
    activeRef.current = true;
    const onAccessCleared = () => { revokedRef.current = true; setRevoked(true); };
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT, onAccessCleared);
    return () => { activeRef.current = false; window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, onAccessCleared); };
  }, []);

  const reviewRequestId = recovery.status === 'review' ? recovery.requestId : undefined;
  useEffect(() => {
    if (!reviewRequestId || revoked) return;
    let active = true;
    setLookup('checking');
    setReviewedReceipts(false);
    void authFetch<ReceiptDetail>(`/api/receipts?id=${encodeURIComponent(reviewRequestId)}`)
      .then((receipt) => {
        if (!active || revokedRef.current) return;
        if (receipt.id !== reviewRequestId || receipt.source !== 'standalone' || receipt.createdByAdminId !== ownerId) {
          setLookup('error');
          return;
        }
        setSavedReceiptId(receipt.id);
        if (clearStandaloneReceiptDraft(ownerId) && clearPendingStandaloneReceipt(ownerId, reviewRequestId)) {
          setRecovery({ status: 'none' });
          setError(null);
        } else {
          setError('Your saved receipt was found, but this browser could not clear its recovery record. Open it below; do not create another for this payment.');
        }
      })
      .catch((err) => {
        if (active && !revokedRef.current) setLookup(err instanceof ApiError && err.status === 404 ? 'missing' : 'error');
      });
    return () => { active = false; };
  }, [ownerId, reviewRequestId, lookupRetry, revoked]);

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || revokedRef.current || recoveryBlocked) return;
    const numericAmount = Number(amount);
    if (!customer.name.trim()) return setError('Customer name is required.');
    if (!customer.email.trim() && !customer.phone.trim()) return setError('Add an email address or phone number.');
    if (!serviceDescription.trim()) return setError('Describe what the customer paid for.');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter the amount already received.');
    // Keep an uncertain request unchanged so the server can recover its
    // original receipt; only new submissions must pass today's date limit.
    if (!pendingInput.current && !paymentDate) return setError('Enter the payment date.');
    if (!pendingInput.current && paymentDate > today()) return setError('Payment date cannot be in the future (London time).');
    if (!confirmed) return setError('Confirm that the payment has already been received.');

    const input: StandaloneReceiptInput = pendingInput.current || {
      requestId: crypto.randomUUID(),
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim() || null,
        phone: customer.phone.trim() || null,
        address: customer.address.trim() || null,
        postcode: customer.postcode.trim() || null,
      },
      serviceDescription: serviceDescription.trim(),
      amount: numericAmount,
      paymentDate,
      paymentMethod,
      paymentReference: paymentReference.trim() || null,
    };

    if (!rememberPendingStandaloneReceipt(ownerId, input)) {
      setRecovery(readPendingStandaloneReceipt(ownerId));
      setError('This browser could not safely keep the receipt for recovery. No new request was sent. Allow session storage, then reload and check Receipts before trying again.');
      return;
    }
    pendingInput.current = input;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authFetch<CreateReceiptResponse>('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!activeRef.current || revokedRef.current) return;
      if (!clearStandaloneReceiptDraft(ownerId) || !clearPendingStandaloneReceipt(ownerId, input.requestId)) {
        setSavedReceiptId(result.receiptId);
        setError('The receipt was saved, but this browser could not clear its recovery record. Open the saved receipt below. Do not create another for this payment.');
        return;
      }
      draftStopped.current = true;
      navigate(`/receipts/${result.receiptId}`);
    } catch (err) {
      if (!activeRef.current || revokedRef.current) return;
      setError(err instanceof ApiError ? err.message : 'Could not create this receipt.');
      if (err instanceof ApiError && err.status === 400 && clearPendingStandaloneReceipt(ownerId, input.requestId)) {
        pendingInput.current = null;
        setRecovery({ status: 'none' });
      }
    } finally {
      submittingRef.current = false;
      if (activeRef.current && !revokedRef.current) setSubmitting(false);
    }
  }

  function discardUnsentDraft() {
    if (!confirmDiscardDraft || recoveryBlocked || pendingInput.current || submitting || revokedRef.current) return;
    if (!clearStandaloneReceiptDraft(ownerId)) {
      setDraftStorageAvailable(false);
      return;
    }
    draftWritten.current = false;
    setCustomer({ name: '', email: '', phone: '', address: '', postcode: '' });
    setServiceDescription(''); setAmount(''); setPaymentDate(today());
    setPaymentMethod('bank_transfer'); setPaymentReference(''); setConfirmed(false);
    setShowRestoredDraft(false); setConfirmDiscardDraft(false); setError(null);
  }

  function discardReviewedAttempt() {
    if (revokedRef.current || recovery.status !== 'review' || !reviewedReceipts || (reviewRequestId && lookup !== 'missing')
      || !window.confirm('Only continue if you checked Receipts and this payment has no receipt. Clear this old recovery record?')) return;
    if (!clearPendingStandaloneReceipt(ownerId)) return setError('The recovery record could not be cleared. Check browser storage before continuing.');
    setRecovery({ status: 'none' });
    setReviewedReceipts(false);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/receipts" className="mb-3 inline-block text-sm font-medium text-sky-600 hover:text-sky-700">← Receipts</Link>
      <div className="mb-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Payment received</p>
        <h1 className="text-2xl font-semibold text-navy-950">Create a receipt</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-navy-700">For customers who have already paid and do not need an invoice first.</p>
      </div>

      <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
        This creates a final receipt only. It does not charge a card, create a balance, or change Stripe.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {revoked && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your account access changed. Sign in again before creating a receipt.</p>}
        {recovery.status === 'unavailable' && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Browser storage is unavailable. Receipt creation is paused so a lost connection cannot create duplicates. Allow session storage and reload this page.</p>}
        {recovery.status === 'review' && !savedReceiptId && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p role="alert">An earlier receipt request {recovery.reason === 'expired' ? 'is more than 24 hours old' : 'could not be recovered safely'}. It may already have been saved. Check Receipts before starting another.</p>
          {reviewRequestId && lookup === 'checking' && <p role="status" className="mt-2">Checking the original receipt…</p>}
          {reviewRequestId && lookup === 'error' && <div className="mt-2"><p>We could not verify the original receipt. Your recovery record is kept safely.</p><button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => setLookupRetry((value) => value + 1)} disabled={revoked}>Retry receipt check</button></div>}
          {reviewRequestId && lookup === 'missing' && <p className="mt-2">The original receipt was not found. Check the Receipts list too before clearing this recovery record.</p>}
          <Link to="/receipts" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline">Check Receipts</Link>
          <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={reviewedReceipts} onChange={(event) => setReviewedReceipts(event.target.checked)} disabled={revoked || (!!reviewRequestId && lookup !== 'missing')} />I checked Receipts and this payment has no receipt.</label>
          <button type="button" onClick={discardReviewedAttempt} disabled={!reviewedReceipts || revoked || (!!reviewRequestId && lookup !== 'missing')} className="mt-3 min-h-11 rounded-lg border border-amber-700 px-3 font-semibold disabled:opacity-50">Clear reviewed recovery record</button>
        </section>}
        {!pendingInput.current && !recoveryBlocked && <section className="rounded-xl border border-silver-200 bg-silver-50 p-3 text-sm text-navy-800">
          {showRestoredDraft && <p className="mb-1 font-medium">Restored your unsent receipt. Check the details and confirm the payment was received before creating it.</p>}
          {(draftAtOpen?.status === 'expired' || draftAtOpen?.status === 'invalid') && <p className="mb-1">The earlier unsent draft expired or could not be read. No receipt was created from it.</p>}
          <p role="status">{draftStorageAvailable ? 'Unsent details are kept in this browser tab for up to 24 hours. Signing out clears them.' : 'This browser cannot keep a draft copy. Keep this page open and copy any details you need before leaving.'}</p>
          {hasDraftContent && !confirmDiscardDraft && <button type="button" onClick={() => setConfirmDiscardDraft(true)} className="mt-2 min-h-11 font-semibold underline">Discard unsent draft</button>}
          {confirmDiscardDraft && <div className="mt-2"><p>Discard these unsent details? This does not change any saved receipt.</p><div className="flex flex-wrap gap-4"><button type="button" onClick={discardUnsentDraft} className="min-h-11 font-semibold text-red-700 underline">Discard this draft</button><button type="button" onClick={() => setConfirmDiscardDraft(false)} className="min-h-11 font-semibold underline">Keep editing</button></div></div>}
        </section>}
        <fieldset disabled={submitting || !!pendingInput.current || recoveryBlocked} className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-950">1. Customer</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelClass}>Customer name *</span>
              <input type="text" autoComplete="name" value={customer.name} onChange={(e) => setCustomer((v) => ({ ...v, name: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Email</span>
              <input type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer((v) => ({ ...v, email: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Phone</span>
              <input type="tel" autoComplete="tel" value={customer.phone} onChange={(e) => setCustomer((v) => ({ ...v, phone: e.target.value }))} className={inputClass} />
            </label>
            <p className="-mt-1 text-xs text-navy-500 sm:col-span-2">Add at least an email address or phone number.</p>
            <StructuredAddressFields
              idPrefix="receipt-customer"
              address={customer.address}
              postcode={customer.postcode}
              onAddressChange={(address) => setCustomer((v) => ({ ...v, address }))}
              onPostcodeChange={(postcode) => setCustomer((v) => ({ ...v, postcode }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-950">2. Payment</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelClass}>What did they pay for? *</span>
              <textarea rows={3} maxLength={500} value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="e.g. End of tenancy cleaning — 2-bedroom flat" className="w-full rounded-lg border border-silver-300 px-3 py-2.5 text-base text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
            </label>
            <label>
              <span className={labelClass}>Amount received (£) *</span>
              <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Payment date *</span>
              <input type="date" value={paymentDate} max={today()} onFocus={(e) => { e.currentTarget.max = today(); }} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Payment method *</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} className={inputClass}>
                {INVOICE_PAYMENT_METHOD_VALUES.map((method) => <option key={method} value={method}>{invoicePaymentMethodLabel(method)}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Reference</span>
              <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Optional" className={inputClass} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-navy-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 rounded border-silver-400 text-sky-600 focus:ring-sky-500" />
            <span>
              <span className="block text-sm font-semibold text-navy-950">I confirm this payment has already been received.</span>
              <span className="mt-1 block text-xs leading-5 text-navy-600">Receipts are final payment records, so check the customer, service and amount before creating one.</span>
            </span>
          </label>
        </section>

        </fieldset>
        {pendingInput.current && !savedReceiptId && !revoked && <p className="text-sm text-navy-700">Your original details are kept for a safe retry, including after refreshing this page. Retry to check or finish the same receipt, or check the Receipts list before starting another.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {savedReceiptId && <Link to={`/receipts/${savedReceiptId}`} className="inline-block min-h-11 font-semibold text-sky-700 underline">Open saved receipt</Link>}
        {savedReceiptId && recovery.status === 'none' && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900"><p>The original receipt is already saved. Its recovery record has been cleared.</p><button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => setSavedReceiptId(null)} disabled={revoked}>Create a different receipt</button></div>}

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-silver-300 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:shadow-none">
          <button type="submit" disabled={submitting || !confirmed || recoveryBlocked} className="min-h-12 w-full rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {submitting ? 'Creating receipt…' : pendingInput.current ? 'Retry same receipt' : 'Create final receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}
