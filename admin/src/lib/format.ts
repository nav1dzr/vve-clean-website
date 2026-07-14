// Honest formatting for historical data that may be missing (ADMIN_CRM_PLAN.md
// Phase 2 §12). Every function here returns a clear, human label instead of
// "£undefined", "Invalid Date", "£NaN", or a blank string — never guesses.

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not recorded';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

// service_date is a real `date` column (validated by Postgres) — safe to
// parse. A null value means the booking simply has no structured date yet.
export function formatServiceDate(value: string | null | undefined): string {
  if (!value) return 'Date not structured';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Date not structured';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// created_at/updated_at are always-populated timestamptz columns.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// preferred_date/preferred_time are free text, not a real date type — shown
// as-is (never re-parsed, which is what would risk "Invalid Date").
export function formatPreferred(
  preferredDate: string | null | undefined,
  preferredTime: string | null | undefined,
): string {
  const parts = [preferredDate, preferredTime].filter((v): v is string => Boolean(v && v.trim()));
  if (parts.length === 0) return 'Not recorded';
  return parts.join(' · ');
}

interface Badge {
  label: string;
  className: string;
}

const BOOKING_STATUS: Record<string, Badge> = {
  new: { label: 'New', className: 'bg-silver-200 text-navy-900' },
  confirmed: { label: 'Confirmed', className: 'bg-sky-100 text-sky-700' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700' },
  in_progress: { label: 'In progress', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  rescheduled: { label: 'Rescheduled', className: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  no_show: { label: 'No-show', className: 'bg-red-100 text-red-700' },
};

export function bookingStatusBadge(status: string | null | undefined): Badge {
  if (status && BOOKING_STATUS[status]) return BOOKING_STATUS[status];
  return { label: 'Status unknown', className: 'bg-silver-200 text-navy-700' };
}

const PAYMENT_STATUS: Record<string, Badge> = {
  pending_payment: { label: 'Pending payment', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
};

export function paymentStatusBadge(status: string | null | undefined): Badge {
  if (status && PAYMENT_STATUS[status]) return PAYMENT_STATUS[status];
  return { label: 'Payment status unknown', className: 'bg-silver-200 text-navy-700' };
}

const BALANCE_STATUS: Record<string, Badge> = {
  not_due: { label: 'Not due', className: 'bg-silver-200 text-navy-900' },
  outstanding: { label: 'Outstanding', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  waived: { label: 'Waived', className: 'bg-silver-200 text-navy-900' },
};

export function balanceStatusBadge(status: string | null | undefined): Badge {
  if (status && BALANCE_STATUS[status]) return BALANCE_STATUS[status];
  return { label: 'Balance unavailable', className: 'bg-silver-200 text-navy-700' };
}

// Strips everything except digits and a leading '+'. Used before building
// tel:/wa.me links so click-to-call/WhatsApp work regardless of how the
// phone number was originally typed (ADMIN_CRM_PLAN.md §17).
function digitsOnly(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = digitsOnly(phone);
  return digits ? `tel:${digits}` : null;
}

// wa.me requires an international number with no leading '+' or '0' —
// converts a UK 07... number to 44... the same way the search normalisation
// treats 0/+44 as equivalent.
export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = digitsOnly(phone);
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  else if (digits.startsWith('+')) digits = digits.slice(1);
  return `https://wa.me/${digits}`;
}

export function mailtoHref(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return `mailto:${email}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
