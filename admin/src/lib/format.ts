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

const BALANCE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  stripe: 'Stripe',
  other: 'Other',
};

export function balancePaymentMethodLabel(method: string | null | undefined): string {
  if (method && BALANCE_PAYMENT_METHOD_LABELS[method]) return BALANCE_PAYMENT_METHOD_LABELS[method];
  return 'Not specified';
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] || status;
}

const BALANCE_STATUS_LABELS: Record<string, string> = {
  not_due: 'Not due',
  outstanding: 'Outstanding',
  paid: 'Paid',
  waived: 'Waived',
};

export function balanceStatusLabel(status: string): string {
  return BALANCE_STATUS_LABELS[status] || status;
}

// Statuses where changing to that value is hard to casually undo in
// practice (the customer may already have been told, or a slot released) —
// these get an inline confirmation step before the update is sent.
export const STATUS_VALUES_REQUIRING_CONFIRMATION = new Set(['cancelled', 'no_show']);

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

// formatCurrency() above rounds to whole pounds (fine for a booking's
// headline total) — invoice/receipt amounts need pence precision since
// partial payments and deposits are routinely non-whole-pound values.
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not recorded';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const INVOICE_DOCUMENT_STATUS: Record<string, Badge> = {
  draft: { label: 'Draft', className: 'bg-silver-200 text-navy-900' },
  issued: { label: 'Issued', className: 'bg-sky-100 text-sky-700' },
  void: { label: 'Void', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

export function invoiceDocumentStatusBadge(status: string | null | undefined): Badge {
  if (status && INVOICE_DOCUMENT_STATUS[status]) return INVOICE_DOCUMENT_STATUS[status];
  return { label: 'Status unknown', className: 'bg-silver-200 text-navy-700' };
}

const INVOICE_PAYMENT_STATUS: Record<string, Badge> = {
  unpaid: { label: 'Unpaid', className: 'bg-amber-100 text-amber-800' },
  partially_paid: { label: 'Partially paid', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
};

export function invoicePaymentStatusBadge(status: string | null | undefined): Badge {
  if (status && INVOICE_PAYMENT_STATUS[status]) return INVOICE_PAYMENT_STATUS[status];
  return { label: 'Payment status unknown', className: 'bg-silver-200 text-navy-700' };
}

// Overdue is derived client-side purely for display — the server is the
// authority on document/payment status; this never gets written back.
export function isInvoiceOverdue(documentStatus: string, amountDue: number, dueDate: string | null): boolean {
  if (documentStatus !== 'issued') return false;
  if (!(amountDue > 0)) return false;
  if (!dueDate) return false;
  return new Date(`${dueDate}T23:59:59`).getTime() < Date.now();
}

const INVOICE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  stripe: 'Stripe',
  cash: 'Cash',
  other: 'Other',
};

export function invoicePaymentMethodLabel(method: string | null | undefined): string {
  if (method && INVOICE_PAYMENT_METHOD_LABELS[method]) return INVOICE_PAYMENT_METHOD_LABELS[method];
  return 'Not specified';
}

const INVOICE_EVENT_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  issued: 'Issued',
  previewed: 'Previewed',
  pdf_generated: 'PDF generated',
  sent: 'Sent',
  resent: 'Resent',
  send_failed: 'Send failed',
  payment_recorded: 'Payment recorded',
  payment_reversed: 'Payment reversed',
  paid: 'Paid',
  receipt_created: 'Receipt created',
  downloaded: 'Downloaded',
  duplicated: 'Duplicated',
  voided: 'Voided',
  cancelled: 'Cancelled',
};

export function invoiceEventLabel(eventType: string): string {
  return INVOICE_EVENT_LABELS[eventType] || eventType;
}
