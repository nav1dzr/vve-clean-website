import { Link } from 'react-router-dom';
import type { InvoiceCard } from '../types/invoice';
import { invoiceDocumentStatusBadge, invoicePaymentStatusBadge, formatMoney, isInvoiceOverdue } from '../lib/format';
import StatusBadge from './StatusBadge';

export default function InvoiceCardItem({ invoice }: { invoice: InvoiceCard }) {
  const overdue = isInvoiceOverdue(invoice.documentStatus, invoice.amountDue, invoice.dueDate);

  return (
    <Link
      to={`/invoices/${invoice.id}`}
      className="block rounded-xl border border-silver-300 bg-white p-4 transition-colors hover:border-sky-400 focus-visible:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">{invoice.customerName}</p>
          <p className="text-sm text-navy-700">{invoice.invoiceNumber || 'Draft — no number yet'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge {...invoiceDocumentStatusBadge(invoice.documentStatus)} />
          <StatusBadge {...invoicePaymentStatusBadge(invoice.paymentStatus)} />
          {overdue && <StatusBadge label="Overdue" className="bg-red-100 text-red-700" />}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy-700">
        <span>Due {invoice.dueDate || 'not set'}</span>
        <span className="font-medium text-navy-900">
          {formatMoney(invoice.amountDue)} due of {formatMoney(invoice.total)}
        </span>
      </div>
    </Link>
  );
}
