import { Link } from 'react-router-dom';
import type { BookingCard } from '../types/booking';
import {
  bookingStatusBadge,
  paymentStatusBadge,
  balanceStatusBadge,
  formatCurrency,
  formatServiceDate,
  formatPreferred,
} from '../lib/format';
import StatusBadge from './StatusBadge';

// Shared compact card used on the dashboard, search results, and the
// mobile booking list — one component, one set of "list-safe" fields
// (ADMIN_CRM_PLAN.md §16), so the three surfaces stay visually consistent.
export default function BookingCardItem({ booking }: { booking: BookingCard }) {
  const dateLabel = booking.serviceDate
    ? formatServiceDate(booking.serviceDate)
    : formatPreferred(booking.preferredDate, booking.preferredTime);

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="block rounded-xl border border-silver-300 bg-white p-4 transition-colors hover:border-sky-400 focus-visible:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">{booking.fullName || 'Name not recorded'}</p>
          <p className="text-sm text-navy-700">{booking.postcode || 'Postcode not recorded'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge {...bookingStatusBadge(booking.status)} />
          <StatusBadge {...paymentStatusBadge(booking.paymentStatus)} />
          {/* Only shown once balance data actually exists for this booking —
              omitted rather than showing "Balance unavailable" on every
              historical card (ADMIN_CRM_PLAN.md Phase 3 8). */}
          {booking.balanceStatus && <StatusBadge {...balanceStatusBadge(booking.balanceStatus)} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy-700">
        <span>
          {booking.service || 'Service not recorded'} · {dateLabel}
        </span>
        <span className="font-medium text-navy-900">{formatCurrency(booking.totalPrice)}</span>
      </div>
      {booking.bookingRef && <p className="mt-2 text-xs text-navy-500">{booking.bookingRef}</p>}
    </Link>
  );
}
