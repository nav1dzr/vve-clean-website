import { Link } from 'react-router-dom';
import type { CustomerCard } from '../types/customer';
import { customerTypeLabel } from '../lib/format';

export default function CustomerCardItem({ customer }: { customer: CustomerCard }) {
  return (
    <Link
      to={`/customers/${customer.id}`}
      className="block rounded-xl border border-silver-300 bg-white p-4 transition-colors hover:border-sky-400 focus-visible:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">{customer.name}</p>
          <p className="text-sm text-navy-700">{customer.email || customer.phone || 'No contact details'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-silver-200 px-2.5 py-0.5 text-xs font-medium text-navy-900">
          {customerTypeLabel(customer.customerType)}
        </span>
      </div>
      <p className="text-sm text-navy-700">{customer.postcode || 'No postcode on file'}</p>
    </Link>
  );
}
