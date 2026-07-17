import { Link } from 'react-router-dom';
import type { ReceiptCard } from '../types/invoice';
import { formatMoney, formatServiceDate } from '../lib/format';

export default function ReceiptCardItem({ receipt }: { receipt: ReceiptCard }) {
  return (
    <Link
      to={`/receipts/${receipt.id}`}
      className="block rounded-xl border border-silver-300 bg-white p-4 transition-colors hover:border-sky-400 focus-visible:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">{receipt.customerName}</p>
          <p className="text-sm text-navy-700">{receipt.receiptNumber || 'Receipt'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Paid</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy-700">
        <span>{receipt.paymentDate ? formatServiceDate(receipt.paymentDate) : 'Date not recorded'}</span>
        <span className="font-medium text-navy-900">{formatMoney(receipt.totalPaid)}</span>
      </div>
    </Link>
  );
}
