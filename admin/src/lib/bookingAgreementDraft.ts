// Keeps unsaved booking-agreement edits in this browser tab so switching
// apps or a page reload on a phone does not lose them. Session storage only:
// scoped to the signed-in account and booking, kept for 24 hours, cleared on
// sign-out, and never restored without the owner choosing to.

const PREFIX = 'vve-booking-agreement:v1:';
const TTL = 24 * 60 * 60 * 1000;
const MAX_LENGTH = 20000;

const TEXT_LIMITS: Record<string, number> = {
  service: 200, items: 3000, scope: 3000, exclusions: 2000, accessNotes: 2000,
  address: 500, postcode: 12, date: 10, time: 80, changeReason: 1000, preparation: 2000,
};

export interface BookingAgreementDraftValues {
  service: string;
  items: string;
  scope: string;
  exclusions: string;
  accessNotes: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  totalPence: number;
  changeReason: string;
  preparation: string;
  paymentPlan?: string;
  paymentWindowHours?: number;
}

export interface BookingAgreementDraftContext {
  userId: string;
  bookingId: string;
}

export interface BookingAgreementDraft {
  /** Booking workflow revision the edits were based on. */
  revision: number;
  values: BookingAgreementDraftValues;
  savedAt: number;
}

const key = ({ userId, bookingId }: BookingAgreementDraftContext) =>
  PREFIX + encodeURIComponent(userId) + ':' + encodeURIComponent(bookingId);

function validValues(value: unknown): value is BookingAgreementDraftValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (typeof v[field] !== 'string' || (v[field] as string).length > max) return false;
  }
  if (typeof v.totalPence !== 'number' || !Number.isFinite(v.totalPence) || v.totalPence < 0) return false;
  if (v.paymentPlan !== undefined && typeof v.paymentPlan !== 'string') return false;
  if (v.paymentWindowHours !== undefined && typeof v.paymentWindowHours !== 'number') return false;
  return true;
}

export function readBookingAgreementDraft(context: BookingAgreementDraftContext): BookingAgreementDraft | null {
  if (!context.userId || !context.bookingId) return null;
  try {
    const raw = window.sessionStorage.getItem(key(context));
    if (!raw) return null;
    let record: unknown = null;
    if (raw.length <= MAX_LENGTH) {
      try { record = JSON.parse(raw); } catch { record = null; }
    }
    const r = record as { userId?: unknown; bookingId?: unknown; revision?: unknown; savedAt?: unknown; values?: unknown } | null;
    if (!r || r.userId !== context.userId || r.bookingId !== context.bookingId
      || typeof r.revision !== 'number' || typeof r.savedAt !== 'number'
      || r.savedAt > Date.now() || Date.now() - r.savedAt > TTL || !validValues(r.values)) {
      window.sessionStorage.removeItem(key(context));
      return null;
    }
    return { revision: r.revision, values: r.values, savedAt: r.savedAt };
  } catch { return null; }
}

export function saveBookingAgreementDraft(
  context: BookingAgreementDraftContext, revision: number, values: BookingAgreementDraftValues,
): boolean {
  if (!context.userId || !context.bookingId || !validValues(values)) return false;
  try {
    const value = JSON.stringify({ userId: context.userId, bookingId: context.bookingId, revision, savedAt: Date.now(), values });
    if (value.length > MAX_LENGTH) return false;
    window.sessionStorage.setItem(key(context), value);
    return window.sessionStorage.getItem(key(context)) === value;
  } catch { return false; }
}

export function clearBookingAgreementDraft(context: BookingAgreementDraftContext): void {
  try { window.sessionStorage.removeItem(key(context)); }
  catch { /* Editing remains available when browser storage is blocked. */ }
}

export function clearBookingAgreementDrafts(): void {
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const name = window.sessionStorage.key(i);
      if (name?.startsWith(PREFIX)) window.sessionStorage.removeItem(name);
    }
  } catch { /* Sign-out must still complete. */ }
}
