import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InvoiceDetail, InvoiceDraftInput } from '../types/invoice';
import type { BookingDetail } from '../types/booking';
import type { CustomerDetail } from '../types/customer';
import InvoiceItemsForm, { emptyFormValue, type InvoiceItemsFormValue } from '../components/InvoiceItemsForm';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';

type PrefillState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; value: InvoiceItemsFormValue; bookingId: string | null; bookingRefSnapshot: string | null };

// /invoices/new — optionally prefilled from a booking via ?bookingId=, or
// from an existing customer via ?customerId= (used by the "Create invoice"
// quick action on the customer detail page). The booking prefill
// deliberately stays conservative: rather than guessing a line-item
// breakdown from the booking's free-form quote_config (whose shape isn't
// fixed/known here), it creates a single line item from the booking's
// service label and total price, which the admin edits/expands as needed —
// safer than fabricating an incorrect itemisation. The customer prefill
// only carries the customer's contact details across and links
// billingCustomerId — it never invents line items.
export default function InvoiceEditorPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const customerId = searchParams.get('customerId');
  const navigate = useNavigate();
  const [prefill, setPrefill] = useState<PrefillState>(bookingId || customerId ? { status: 'loading' } : { status: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      setPrefill({ status: 'loading' });
      authFetch<BookingDetail>(`/api/bookings/${bookingId}`)
        .then((b) => {
          setPrefill({
            status: 'ready',
            bookingId,
            bookingRefSnapshot: b.bookingRef || null,
            value: emptyFormValue({
              customer: {
                name: b.fullName || '',
                email: b.email || '',
                phone: b.phone || '',
                address: b.address || '',
                postcode: b.postcode || '',
              },
              items: [{
                key: 'prefill-1',
                description: b.service || 'Cleaning service',
                quantity: 1,
                unitPrice: b.totalPrice || 0,
                lineDiscount: 0,
              }],
              serviceDate: b.serviceDate || '',
              depositApplied: b.depositAmount || 0,
            }),
          });
        })
        .catch((err) => setPrefill({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load the booking to prefill from.' }));
      return;
    }
    if (customerId) {
      setPrefill({ status: 'loading' });
      authFetch<CustomerDetail>(`/api/customers/${customerId}`)
        .then((c) => {
          setPrefill({
            status: 'ready',
            bookingId: null,
            bookingRefSnapshot: null,
            value: emptyFormValue({
              customer: { name: c.name, email: c.email, phone: c.phone, address: c.address, postcode: c.postcode },
              billingCustomerId: c.id,
            }),
          });
        })
        .catch((err) => setPrefill({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this customer to prefill from.' }));
    }
  }, [bookingId, customerId]);

  async function handleSubmit(input: InvoiceDraftInput) {
    setSubmitting(true);
    setError(null);
    try {
      const created = await authFetch<InvoiceDetail>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          bookingId: prefill.status === 'ready' ? prefill.bookingId ?? undefined : undefined,
          bookingRefSnapshot: prefill.status === 'ready' ? prefill.bookingRefSnapshot ?? undefined : undefined,
        }),
      });
      navigate(`/invoices/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this invoice.');
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <Link to="/invoices" className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">
        ← Invoices
      </Link>
      <h1 className="mb-4 font-semibold text-xl text-navy-950">New invoice</h1>

      {prefill.status === 'loading' && <CardListSkeleton count={1} />}
      {prefill.status === 'error' && <ErrorState message={prefill.message} onRetry={() => setPrefill({ status: 'none' })} />}
      {(prefill.status === 'none' || prefill.status === 'ready') && (
        <InvoiceItemsForm
          initial={prefill.status === 'ready' ? prefill.value : emptyFormValue()}
          onSubmit={handleSubmit}
          submitLabel="Save draft"
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}
