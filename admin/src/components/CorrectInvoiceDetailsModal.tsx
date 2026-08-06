import { useState, type FormEvent } from 'react';
import type { InvoiceDetail, InvoiceServiceContact } from '../types/invoice';
import { ApiError } from '../lib/authFetch';
import Modal from './Modal';
import StructuredAddressFields from './StructuredAddressFields';

export interface InvoiceContactCorrectionInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    postcode: string;
  };
  serviceContact: InvoiceServiceContact;
  invoiceRecipientEmail: string;
  receiptRecipientEmail: string;
}

interface Props {
  invoice: InvoiceDetail;
  onClose: () => void;
  onConfirm: (input: InvoiceContactCorrectionInput) => Promise<void>;
}

const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

export default function CorrectInvoiceDetailsModal({ invoice, onClose, onConfirm }: Props) {
  const [customer, setCustomer] = useState({
    name: invoice.customer.name,
    email: invoice.customer.email || '',
    phone: invoice.customer.phone || '',
    address: invoice.customer.address || '',
    postcode: invoice.customer.postcode || '',
  });
  const [serviceContact, setServiceContact] = useState<InvoiceServiceContact>({
    name: invoice.serviceContact?.name || '',
    email: invoice.serviceContact?.email || '',
    phone: invoice.serviceContact?.phone || '',
    address: invoice.serviceContact?.address || '',
    postcode: invoice.serviceContact?.postcode || '',
  });
  const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState(invoice.invoiceRecipientEmail || '');
  const [receiptRecipientEmail, setReceiptRecipientEmail] = useState(invoice.receiptRecipientEmail || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({ customer, serviceContact, invoiceRecipientEmail, receiptRecipientEmail });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this correction. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Modal titleId="correct-invoice-details-title" title="Correct customer or address details" onClose={onClose} wide>
      <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-navy-800">
        <p className="font-semibold text-navy-950">For typos and contact changes only</p>
        <p className="mt-1">The invoice number stays the same. A new PDF version is created, and prices, services and payments cannot change here.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-navy-950">Billing contact</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label htmlFor="correction-customer-name" className="sm:col-span-2">
              <span className={labelClass}>Customer or company name</span>
              <input id="correction-customer-name" required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className={inputClass} />
            </label>
            <label htmlFor="correction-customer-email">
              <span className={labelClass}>Email</span>
              <input id="correction-customer-email" type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className={inputClass} />
            </label>
            <label htmlFor="correction-customer-phone">
              <span className={labelClass}>Phone</span>
              <input id="correction-customer-phone" type="tel" autoComplete="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className={inputClass} />
            </label>
            <StructuredAddressFields
              idPrefix="correction-billing"
              address={customer.address}
              postcode={customer.postcode}
              onAddressChange={(address) => setCustomer({ ...customer, address })}
              onPostcodeChange={(postcode) => setCustomer({ ...customer, postcode })}
              legend="Billing address"
            />
          </div>
        </fieldset>

        <details className="rounded-xl border border-silver-300 bg-silver-50 p-3" open={!!invoice.serviceContact}>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-navy-950">Service contact or address (if different)</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label htmlFor="correction-service-name" className="sm:col-span-2">
              <span className={labelClass}>Contact name</span>
              <input id="correction-service-name" value={serviceContact.name || ''} onChange={(e) => setServiceContact({ ...serviceContact, name: e.target.value })} className={inputClass} />
            </label>
            <label htmlFor="correction-service-email">
              <span className={labelClass}>Email</span>
              <input id="correction-service-email" type="email" value={serviceContact.email || ''} onChange={(e) => setServiceContact({ ...serviceContact, email: e.target.value })} className={inputClass} />
            </label>
            <label htmlFor="correction-service-phone">
              <span className={labelClass}>Phone</span>
              <input id="correction-service-phone" type="tel" value={serviceContact.phone || ''} onChange={(e) => setServiceContact({ ...serviceContact, phone: e.target.value })} className={inputClass} />
            </label>
            <StructuredAddressFields
              idPrefix="correction-service"
              address={serviceContact.address || ''}
              postcode={serviceContact.postcode || ''}
              onAddressChange={(address) => setServiceContact({ ...serviceContact, address })}
              onPostcodeChange={(postcode) => setServiceContact({ ...serviceContact, postcode })}
              legend="Service address"
            />
          </div>
        </details>

        <details className="rounded-xl border border-silver-300 bg-silver-50 p-3" open={!!(invoice.invoiceRecipientEmail || invoice.receiptRecipientEmail)}>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-navy-950">Delivery emails (optional)</summary>
          <p className="mb-3 mt-1 text-xs text-navy-600">Use these only when documents should go somewhere other than the billing email.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label htmlFor="correction-invoice-recipient">
              <span className={labelClass}>Invoice delivery email</span>
              <input id="correction-invoice-recipient" type="email" value={invoiceRecipientEmail} onChange={(e) => setInvoiceRecipientEmail(e.target.value)} className={inputClass} />
            </label>
            <label htmlFor="correction-receipt-recipient">
              <span className={labelClass}>Receipt delivery email</span>
              <input id="correction-receipt-recipient" type="email" value={receiptRecipientEmail} onChange={(e) => setReceiptRecipientEmail(e.target.value)} className={inputClass} />
            </label>
          </div>
        </details>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 hover:bg-silver-100 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Saving correction…' : 'Save correction & regenerate PDF'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
