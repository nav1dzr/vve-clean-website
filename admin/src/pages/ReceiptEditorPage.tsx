import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StructuredAddressFields from '../components/StructuredAddressFields';
import { authFetch, ApiError } from '../lib/authFetch';
import { invoicePaymentMethodLabel } from '../lib/format';
import {
  INVOICE_PAYMENT_METHOD_VALUES,
  type CreateReceiptResponse,
  type StandaloneReceiptInput,
} from '../types/invoice';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceiptEditorPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', postcode: '' });
  const [serviceDescription, setServiceDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<(typeof INVOICE_PAYMENT_METHOD_VALUES)[number]>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!customer.name.trim()) return setError('Customer name is required.');
    if (!customer.email.trim() && !customer.phone.trim()) return setError('Add an email address or phone number.');
    if (!serviceDescription.trim()) return setError('Describe what the customer paid for.');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter the amount already received.');
    if (!confirmed) return setError('Confirm that the payment has already been received.');

    const input: StandaloneReceiptInput = {
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

    setSubmitting(true);
    setError(null);
    try {
      const result = await authFetch<CreateReceiptResponse>('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      navigate(`/receipts/${result.receiptId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this receipt.');
      setSubmitting(false);
    }
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
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
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

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-silver-300 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:shadow-none">
          <button type="submit" disabled={submitting || !confirmed} className="min-h-12 w-full rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {submitting ? 'Creating receipt…' : 'Create final receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}
