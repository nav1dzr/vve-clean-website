import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';

type PaymentCheck = {
  sourceKey: string;
  status: 'loading' | 'clear' | 'recorded' | 'unavailable';
};

type BookingPaymentHistory = {
  journey?: unknown;
  payments?: { kind?: string; amount_pence?: number }[];
};

// Shared by new invoices and saved drafts. This is read-only guidance, not
// reconciliation between the booking and invoice payment ledgers.
export default function BookingBalancePaymentNotice({ bookingId, accountId }: { bookingId: string; accountId: string | undefined }) {
  const sourceKey = `${accountId || ''}:${bookingId}`;
  const [check, setCheck] = useState<PaymentCheck>({ sourceKey, status: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCheck({ sourceKey, status: 'loading' });
    authFetch<BookingPaymentHistory>(`/api/bookings/${bookingId}?action=journey`)
      .then((history) => {
        if (cancelled) return;
        const payments = Array.isArray(history.payments) ? history.payments : null;
        const hasBalancePayment = payments?.some((payment) =>
          (payment?.kind === 'manual_balance' || payment?.kind === 'balance')
          && Number.isFinite(payment.amount_pence) && Number(payment.amount_pence) > 0,
        );
        setCheck({ sourceKey, status: hasBalancePayment ? 'recorded' : payments || history.journey === null ? 'clear' : 'unavailable' });
      })
      .catch(() => { if (!cancelled) setCheck({ sourceKey, status: 'unavailable' }); });
    return () => { cancelled = true; };
  }, [bookingId, sourceKey, retry]);

  if (check.sourceKey !== sourceKey || check.status === 'clear') return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      {check.status === 'loading' ? <p>Checking linked booking payments…</p> : <>
        <p className="font-semibold">{check.status === 'recorded' ? 'A balance payment is recorded on this booking' : 'Could not check booking payments'}</p>
        <p className="mt-1">{check.status === 'recorded'
          ? 'Booking balance payments are not automatically applied to this invoice. Check the payment and any refunds before issuing or sending this invoice, or recording the same money again.'
          : 'Review the linked booking before issuing or sending this invoice, or recording a payment. You can still save a draft.'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link to={`/bookings/${bookingId}`} className="font-medium underline underline-offset-2 hover:text-amber-800">Review booking payments</Link>
          {check.status === 'unavailable' && <button type="button" onClick={() => setRetry((attempt) => attempt + 1)} className="rounded-lg border border-amber-300 px-3 py-2 font-medium hover:bg-amber-100">Retry payment check</button>}
        </div>
      </>}
    </div>
  );
}
