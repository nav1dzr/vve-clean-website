import { useState, useEffect, type FormEvent } from 'react';
import type {
  InvoiceCustomer, InvoiceDraftInput, InvoiceDraftItemInput, InvoiceServiceContact, PaymentOptionValue,
} from '../types/invoice';
import { PAYMENT_OPTION_VALUES } from '../types/invoice';
import { formatMoney } from '../lib/format';
import { buildBookingRefBase } from '../lib/bookingRef';

const PAYMENT_OPTION_LABELS: Record<PaymentOptionValue, string> = {
  bank_transfer: 'Bank transfer',
  stripe_payment_link: 'Stripe payment link',
  both: 'Both',
};

const MAX_ITEMS = 100;

// Allows: empty, positive integers, decimals up to 2 places.
// Rejects: negatives, letters, multiple decimal points, 3+ decimal places.
const NUMERIC_RE = /^$|^\d+\.?\d{0,2}$/;

type RawItemNumerics = Partial<Record<'qty' | 'price' | 'discount', string>>;

interface FormItem extends InvoiceDraftItemInput {
  key: string;
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `item-${keyCounter}`;
}

function emptyItem(): FormItem {
  return { key: newKey(), description: '', quantity: 1, unitPrice: 0, lineDiscount: 0 };
}

const emptyServiceContact: InvoiceServiceContact = { name: '', email: '', phone: '', address: '', postcode: '' };

export interface InvoiceItemsFormValue {
  customer: InvoiceCustomer;
  items: FormItem[];
  poReference: string;
  issueDate: string;
  dueDate: string;
  serviceDate: string;
  documentDiscount: number;
  depositApplied: number;
  customerNotes: string;
  internalNotes: string;
  paymentTerms: string;
  paymentOption: PaymentOptionValue;
  stripePaymentLinkUrl: string;
  serviceContact: InvoiceServiceContact;
  invoiceRecipientEmail: string;
  receiptRecipientEmail: string;
  billingCustomerId: string | null;
  serviceCustomerId: string | null;
}

export function emptyFormValue(prefill?: Partial<InvoiceItemsFormValue>): InvoiceItemsFormValue {
  return {
    customer: { name: '', email: '', phone: '', address: '', postcode: '' },
    items: [emptyItem()],
    poReference: '',
    issueDate: '',
    dueDate: '',
    serviceDate: '',
    documentDiscount: 0,
    depositApplied: 0,
    customerNotes: '',
    internalNotes: '',
    paymentTerms: 'Payment due within 14 days.',
    paymentOption: 'bank_transfer',
    stripePaymentLinkUrl: '',
    serviceContact: emptyServiceContact,
    invoiceRecipientEmail: '',
    receiptRecipientEmail: '',
    billingCustomerId: null,
    serviceCustomerId: null,
    ...prefill,
  };
}

// Preview-only client-side totals — never authoritative (the server always
// recalculates from raw input on every write, per
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §10). Deliberately simple: no
// pence-rounding rigor needed for a live "roughly what will this cost"
// summary, unlike admin/api/_lib/invoiceCalculations.js.
function previewTotals(value: InvoiceItemsFormValue) {
  const subtotal = value.items.reduce((sum, i) => sum + i.quantity * i.unitPrice - i.lineDiscount, 0);
  const total = Math.max(0, subtotal - value.documentDiscount);
  const amountDue = Math.max(0, total - value.depositApplied);
  return { subtotal, total, amountDue };
}

interface Props {
  initial: InvoiceItemsFormValue;
  onSubmit: (input: InvoiceDraftInput) => Promise<void>;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}

function hasAnyServiceContactField(sc: InvoiceServiceContact): boolean {
  return Boolean(sc.name?.trim() || sc.email?.trim() || sc.phone?.trim() || sc.address?.trim() || sc.postcode?.trim());
}

export default function InvoiceItemsForm({ initial, onSubmit, submitLabel, submitting, error, secondaryAction }: Props) {
  const [value, setValue] = useState<InvoiceItemsFormValue>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serviceContactEnabled, setServiceContactEnabled] = useState(() => hasAnyServiceContactField(initial.serviceContact));
  // Whether the admin has directly typed into the booking-reference field
  // (or a value was already prefilled in) — once true, postcode/service-date
  // changes never auto-populate it again. The Auto-fill button resets this,
  // so "regenerate" resumes automatic tracking rather than being a one-shot.
  const [refManuallyEdited, setRefManuallyEdited] = useState(() => Boolean(initial.poReference));

  // Raw string state for each item's numeric inputs while the user is actively
  // editing. Undefined means "display the committed number from FormItem".
  // Avoids the controlled-input problem where Number('') = 0 re-inserts zero
  // immediately after the user clears the field with Backspace or Delete.
  // Qty and Discount have the identical bug, so the same fix covers all three.
  const [rawNumerics, setRawNumerics] = useState<Record<string, RawItemNumerics>>({});

  // Returns spread-ready props for a numeric text input with live validation.
  function numericField(
    itemKey: string,
    field: 'qty' | 'price' | 'discount',
    numericValue: number,
    applyPatch: (v: number) => void,
  ): React.InputHTMLAttributes<HTMLInputElement> {
    const raw = rawNumerics[itemKey]?.[field];
    return {
      type: 'text',
      inputMode: 'decimal',
      value: raw !== undefined ? raw : String(numericValue),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        if (!NUMERIC_RE.test(v)) return;
        setRawNumerics((m) => ({ ...m, [itemKey]: { ...m[itemKey], [field]: v } }));
        const n = parseFloat(v);
        if (Number.isFinite(n)) applyPatch(n);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setRawNumerics((m) => {
          const entry = m[itemKey];
          if (!entry) return m;
          const next = { ...entry };
          delete next[field];
          if (Object.keys(next).length === 0) {
            const result = { ...m };
            delete result[itemKey];
            return result;
          }
          return { ...m, [itemKey]: next };
        });
        const n = parseFloat(v);
        applyPatch(Number.isFinite(n) ? n : 0);
      },
    };
  }

  const totals = previewTotals(value);

  // Prefills the booking reference once postcode + service date are both
  // available, in the same POSTCODE+DDMMYY style as buildManualBookingRef
  // (admin/api/_lib/customerLifecycle.js) — never overwrites a value the
  // admin has manually typed. Purely a convenience default on a free-text
  // field; does not touch invoice-number generation (the atomic
  // next_document_number() RPC, unrelated and untouched).
  useEffect(() => {
    if (refManuallyEdited) return;
    if (!value.customer.postcode || !value.serviceDate) return;
    const suggested = buildBookingRefBase(value.customer.postcode, value.serviceDate);
    if (suggested) setValue((v) => ({ ...v, poReference: suggested }));
  }, [value.customer.postcode, value.serviceDate, refManuallyEdited]);

  function updateItem(key: string, patch: Partial<FormItem>) {
    setValue((v) => ({ ...v, items: v.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  }

  function addItem() {
    if (value.items.length >= MAX_ITEMS) return;
    setValue((v) => ({ ...v, items: [...v.items, emptyItem()] }));
  }

  function removeItem(key: string) {
    setValue((v) => (v.items.length <= 1 ? v : { ...v, items: v.items.filter((i) => i.key !== key) }));
  }

  function moveItem(key: string, direction: -1 | 1) {
    setValue((v) => {
      const index = v.items.findIndex((i) => i.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= v.items.length) return v;
      const items = [...v.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...v, items };
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    if (!value.customer.name.trim()) {
      setValidationError('Customer name is required.');
      return;
    }
    if (!value.customer.email?.trim() && !value.customer.phone?.trim()) {
      setValidationError('Enter at least a customer email or phone number.');
      return;
    }
    if (value.items.length === 0 || value.items.some((i) => !i.description.trim())) {
      setValidationError('Every line item needs a description.');
      return;
    }
    if (value.items.some((i) => !(i.quantity > 0))) {
      setValidationError('Every line item needs a quantity greater than zero.');
      return;
    }
    const requiresStripeLink = value.paymentOption === 'stripe_payment_link' || value.paymentOption === 'both';
    if (requiresStripeLink && !value.stripePaymentLinkUrl.trim()) {
      setValidationError('Enter a Stripe payment-link URL, or choose a different payment option.');
      return;
    }

    const serviceContact = serviceContactEnabled
      ? {
        name: value.serviceContact.name?.trim() || null,
        email: value.serviceContact.email?.trim() || null,
        phone: value.serviceContact.phone?.trim() || null,
        address: value.serviceContact.address?.trim() || null,
        postcode: value.serviceContact.postcode?.trim() || null,
      }
      : null;

    const input: InvoiceDraftInput = {
      customer: {
        name: value.customer.name.trim(),
        email: value.customer.email?.trim() || null,
        phone: value.customer.phone?.trim() || null,
        address: value.customer.address?.trim() || null,
        postcode: value.customer.postcode?.trim() || null,
      },
      items: value.items.map(({ description, quantity, unitPrice, lineDiscount }) => ({
        description: description.trim(), quantity, unitPrice, lineDiscount,
      })),
      poReference: value.poReference.trim() || null,
      issueDate: value.issueDate || null,
      dueDate: value.dueDate || null,
      serviceDate: value.serviceDate || null,
      documentDiscount: value.documentDiscount || 0,
      depositApplied: value.depositApplied || 0,
      customerNotes: value.customerNotes.trim() || null,
      internalNotes: value.internalNotes.trim() || null,
      paymentTerms: value.paymentTerms.trim() || null,
      paymentOption: value.paymentOption,
      stripePaymentLinkUrl: requiresStripeLink ? value.stripePaymentLinkUrl.trim() : null,
      serviceContact,
      invoiceRecipientEmail: value.invoiceRecipientEmail.trim() || null,
      receiptRecipientEmail: value.receiptRecipientEmail.trim() || null,
      billingCustomerId: value.billingCustomerId,
      serviceCustomerId: serviceContactEnabled ? value.serviceCustomerId : null,
    };

    await onSubmit(input);
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  return (
    <form onSubmit={handleSubmit}>
      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Customer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Name *</span>
            <input
              type="text"
              value={value.customer.name}
              onChange={(e) => setValue((v) => ({ ...v, customer: { ...v.customer, name: e.target.value } }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={value.customer.email ?? ''}
              onChange={(e) => setValue((v) => ({ ...v, customer: { ...v.customer, email: e.target.value } }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input
              type="tel"
              value={value.customer.phone ?? ''}
              onChange={(e) => setValue((v) => ({ ...v, customer: { ...v.customer, phone: e.target.value } }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Postcode</span>
            <input
              type="text"
              value={value.customer.postcode ?? ''}
              onChange={(e) => setValue((v) => ({ ...v, customer: { ...v.customer, postcode: e.target.value } }))}
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Address</span>
            <input
              type="text"
              value={value.customer.address ?? ''}
              onChange={(e) => setValue((v) => ({ ...v, customer: { ...v.customer, address: e.target.value } }))}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Dates & reference</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>
            <span className={labelClass}>Issue date</span>
            <input type="date" value={value.issueDate} onChange={(e) => setValue((v) => ({ ...v, issueDate: e.target.value }))} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Due date</span>
            <input type="date" value={value.dueDate} onChange={(e) => setValue((v) => ({ ...v, dueDate: e.target.value }))} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Service date</span>
            <input type="date" value={value.serviceDate} onChange={(e) => setValue((v) => ({ ...v, serviceDate: e.target.value }))} className={inputClass} />
          </label>
          <label className="sm:col-span-3">
            <span className={labelClass}>Booking reference</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={value.poReference}
                onChange={(e) => {
                  setRefManuallyEdited(true);
                  setValue((v) => ({ ...v, poReference: e.target.value }));
                }}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  const suggested = buildBookingRefBase(value.customer.postcode, value.serviceDate);
                  if (suggested) setValue((v) => ({ ...v, poReference: suggested }));
                  setRefManuallyEdited(false);
                }}
                disabled={!value.customer.postcode || !value.serviceDate}
                title={!value.customer.postcode || !value.serviceDate ? 'Set a postcode and service date first' : 'Fill in from postcode + service date'}
                className="shrink-0 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Auto-fill
              </button>
            </div>
          </label>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Line items</h2>
          <button type="button" onClick={addItem} className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 hover:bg-silver-100">
            + Add item
          </button>
        </div>

        <div className="space-y-3">
          {value.items.map((item, index) => (
            <div key={item.key} className="rounded-lg border border-silver-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-navy-500">Item {index + 1}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveItem(item.key, -1)} disabled={index === 0} className="min-h-8 min-w-8 rounded border border-silver-300 text-xs text-navy-700 disabled:opacity-30" aria-label={`Move item ${index + 1} up`}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveItem(item.key, 1)} disabled={index === value.items.length - 1} className="min-h-8 min-w-8 rounded border border-silver-300 text-xs text-navy-700 disabled:opacity-30" aria-label={`Move item ${index + 1} down`}>
                    ↓
                  </button>
                  <button type="button" onClick={() => removeItem(item.key)} disabled={value.items.length <= 1} className="min-h-8 rounded border border-silver-300 px-2 text-xs text-red-700 disabled:opacity-30">
                    Remove
                  </button>
                </div>
              </div>
              <label className="mb-2 block">
                <span className={labelClass}>Description</span>
                <input type="text" value={item.description} onChange={(e) => updateItem(item.key, { description: e.target.value })} className={inputClass} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className={labelClass}>Qty</span>
                  <input {...numericField(item.key, 'qty', item.quantity, (v) => updateItem(item.key, { quantity: v }))} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Unit price (£)</span>
                  <input {...numericField(item.key, 'price', item.unitPrice, (v) => updateItem(item.key, { unitPrice: v }))} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Discount (£)</span>
                  <input {...numericField(item.key, 'discount', item.lineDiscount, (v) => updateItem(item.key, { lineDiscount: v }))} className={inputClass} />
                </label>
              </div>
              <p className="mt-2 text-right text-sm text-navy-700">
                Line total: <span className="font-medium text-navy-950">{formatMoney(item.quantity * item.unitPrice - item.lineDiscount)}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Payment options</h2>
        <p className="mb-3 text-sm text-navy-700">How should the customer pay? Shown on the PDF and in the invoice email.</p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {PAYMENT_OPTION_VALUES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-navy-900">
              <input
                type="radio"
                name="paymentOption"
                checked={value.paymentOption === option}
                onChange={() => setValue((v) => ({ ...v, paymentOption: option }))}
              />
              {PAYMENT_OPTION_LABELS[option]}
            </label>
          ))}
        </div>
        {(value.paymentOption === 'stripe_payment_link' || value.paymentOption === 'both') && (
          <label>
            <span className={labelClass}>Stripe payment-link URL *</span>
            <input
              type="url"
              placeholder="https://buy.stripe.com/…"
              value={value.stripePaymentLinkUrl}
              onChange={(e) => setValue((v) => ({ ...v, stripePaymentLinkUrl: e.target.value }))}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-navy-500">Must be a buy.stripe.com or checkout.stripe.com link. This never creates a charge automatically.</span>
          </label>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Service address & recipients</h2>
        <label className="mb-3 flex items-center gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            checked={serviceContactEnabled}
            onChange={(e) => setServiceContactEnabled(e.target.checked)}
          />
          The service was for a different person/address than the billing contact above
        </label>
        {serviceContactEnabled && (
          <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-silver-200 p-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Service contact name</span>
              <input type="text" value={value.serviceContact.name ?? ''} onChange={(e) => setValue((v) => ({ ...v, serviceContact: { ...v.serviceContact, name: e.target.value } }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Service contact email</span>
              <input type="email" value={value.serviceContact.email ?? ''} onChange={(e) => setValue((v) => ({ ...v, serviceContact: { ...v.serviceContact, email: e.target.value } }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Service contact phone</span>
              <input type="tel" value={value.serviceContact.phone ?? ''} onChange={(e) => setValue((v) => ({ ...v, serviceContact: { ...v.serviceContact, phone: e.target.value } }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Service postcode</span>
              <input type="text" value={value.serviceContact.postcode ?? ''} onChange={(e) => setValue((v) => ({ ...v, serviceContact: { ...v.serviceContact, postcode: e.target.value } }))} className={inputClass} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Service address</span>
              <input type="text" value={value.serviceContact.address ?? ''} onChange={(e) => setValue((v) => ({ ...v, serviceContact: { ...v.serviceContact, address: e.target.value } }))} className={inputClass} />
            </label>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Invoice recipient email (optional override)</span>
            <input type="email" placeholder={value.customer.email || 'Defaults to billing email'} value={value.invoiceRecipientEmail} onChange={(e) => setValue((v) => ({ ...v, invoiceRecipientEmail: e.target.value }))} className={inputClass} />
            <span className="mt-1 block text-xs text-navy-500">e.g. send the invoice to an agency instead of the tenant.</span>
          </label>
          <label>
            <span className={labelClass}>Receipt recipient email (optional override)</span>
            <input type="email" placeholder={value.customer.email || 'Defaults to billing email'} value={value.receiptRecipientEmail} onChange={(e) => setValue((v) => ({ ...v, receiptRecipientEmail: e.target.value }))} className={inputClass} />
            <span className="mt-1 block text-xs text-navy-500">e.g. send the receipt to a landlord instead.</span>
          </label>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Discount, deposit & notes</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Document discount (£)</span>
            <input type="number" min="0" step="0.01" value={value.documentDiscount} onChange={(e) => setValue((v) => ({ ...v, documentDiscount: Number(e.target.value) }))} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Deposit already paid (£)</span>
            <input type="number" min="0" step="0.01" value={value.depositApplied} onChange={(e) => setValue((v) => ({ ...v, depositApplied: Number(e.target.value) }))} className={inputClass} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Payment terms</span>
            <input type="text" value={value.paymentTerms} onChange={(e) => setValue((v) => ({ ...v, paymentTerms: e.target.value }))} className={inputClass} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Customer notes (printed on the invoice)</span>
            <textarea value={value.customerNotes} onChange={(e) => setValue((v) => ({ ...v, customerNotes: e.target.value }))} rows={2} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Internal notes (never printed)</span>
            <textarea value={value.internalNotes} onChange={(e) => setValue((v) => ({ ...v, internalNotes: e.target.value }))} rows={2} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />
          </label>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Summary (preview — server recalculates on save)</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-navy-700">Subtotal</dt><dd className="text-navy-950">{formatMoney(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-navy-700">Total</dt><dd className="text-navy-950">{formatMoney(totals.total)}</dd></div>
          <div className="flex justify-between font-semibold"><dt className="text-navy-900">Amount due</dt><dd className="text-navy-950">{formatMoney(totals.amountDue)}</dd></div>
        </dl>
      </section>

      {(validationError || error) && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {validationError || error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900 disabled:opacity-60"
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 flex-1 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
