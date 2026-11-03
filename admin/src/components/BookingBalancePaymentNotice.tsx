import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';
import { formatMoney } from '../lib/format';
import { reviewBookingPayments, type BookingPaymentHistory, type BookingPaymentReview } from '../lib/bookingPaymentReview';
import type { InvoiceDetail } from '../types/invoice';

type InvoiceFigures = Pick<InvoiceDetail, 'id' | 'updatedAt' | 'documentStatus' | 'depositApplied' | 'amountPaid' | 'amountDue'>;
type PaymentCheck = { sourceKey: string; review: BookingPaymentReview | { status: 'loading' } };

function amount(value: number) {
  return Number.isFinite(value) && value >= 0 ? formatMoney(value) : 'Unavailable';
}

// An authenticated read-only comparison. Amounts may describe the same money:
// this panel never adds the ledgers together or changes an invoice/payment.
export default function BookingBalancePaymentNotice({ bookingId, accountId, invoice }: {
  bookingId: string;
  accountId: string | undefined;
  invoice?: InvoiceFigures;
}) {
  const sourceKey = `${accountId || ''}:${bookingId}:${invoice?.id || ''}:${invoice?.updatedAt || ''}`;
  const [check, setCheck] = useState<PaymentCheck>({ sourceKey, review: { status: 'loading' } });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCheck({ sourceKey, review: { status: 'loading' } });
    authFetch<BookingPaymentHistory>(`/api/bookings/${bookingId}?action=journey`)
      .then((history) => {
        if (!cancelled) setCheck({ sourceKey, review: reviewBookingPayments(history) });
      })
      .catch(() => { if (!cancelled) setCheck({ sourceKey, review: { status: 'unavailable' } }); });
    return () => { cancelled = true; };
  }, [bookingId, sourceKey, retry]);

  if (check.sourceKey !== sourceKey || check.review.status === 'clear') return null;
  const review = check.review;
  return (
    <section aria-label="Linked booking payment review" className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 text-sm text-navy-950">
      <div role="status" className="p-4">
        {review.status === 'loading' ? <p>Checking linked booking payments…</p> : <>
          <p className="font-semibold">{review.status === 'recorded'
            ? review.hasBalancePayment ? 'A balance payment is recorded on this booking' : 'Payments are recorded on this booking'
            : 'Could not check booking payments'}</p>
          <p className="mt-1 leading-6">{review.status === 'recorded'
            ? 'Booking balance payments are not automatically applied to this invoice. Check both records before sending a payment request or recording the same money again.'
            : 'Review the linked booking before issuing or sending this invoice, or recording a payment. You can still save a draft.'}</p>
        </>}
      </div>
      {review.status === 'recorded' && (
        <div className="border-t border-amber-200 bg-white p-4">
          <div className={invoice ? 'grid gap-4 sm:grid-cols-2' : ''}>
            <div>
              <h3 className="mb-2 font-semibold">Booking payment record</h3>
              {review.totals ? <dl className="space-y-2">
                <Figure label="Received" value={amount(review.totals.receivedPence / 100)} />
                <Figure label="Refunded" value={amount(review.totals.refundedPence / 100)} />
                <Figure label="After refunds" value={amount(review.totals.retainedPence / 100)} strong />
              </dl> : <p className="leading-6 text-navy-600">A payment appears in the available history. Open the booking to check the full payment and refund record.</p>}
            </div>
            {invoice && <div className="border-t border-silver-200 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <h3 className="mb-2 font-semibold">{invoice.documentStatus === 'draft' ? 'Saved invoice figures' : 'Invoice payment record'}</h3>
              <dl className="space-y-2">
                <Figure label="Deposit applied" value={amount(invoice.depositApplied)} />
                <Figure label="Other payments recorded" value={amount(invoice.amountPaid)} />
                <Figure label="Invoice amount due" value={amount(invoice.amountDue)} strong />
              </dl>
              {invoice.documentStatus === 'draft' && <p className="mt-2 text-xs leading-5 text-navy-600">Unsaved invoice edits are not included here.</p>}
            </div>}
          </div>
          <p className="mt-4 border-t border-silver-200 pt-3 leading-6 text-navy-700">These records may refer to the same payment. Matching amounts do not prove a link. Review the original payment references before making a correction.</p>
        </div>
      )}
      {review.status !== 'loading' && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-amber-200 px-4 py-2">
        <Link to={`/bookings/${bookingId}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Review booking payments</Link>
        <button type="button" onClick={() => setRetry((attempt) => attempt + 1)} className="min-h-11 rounded-lg px-3 font-medium hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{review.status === 'unavailable' ? 'Retry payment check' : 'Refresh payment check'}</button>
      </div>}
    </section>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
    <dt className="min-w-0 text-navy-700">{label}</dt>
    <dd className="shrink-0 tabular-nums">{value}</dd>
  </div>;
}
