import type { ManualBookingInput } from '../types/customer';

const PREFIX = 'vve-pending-manual-booking:v1:';
const TTL = 24 * 60 * 60 * 1000;
type PendingInput = ManualBookingInput & { requestId: string };
export type PendingManualBooking = { status: 'none' | 'unavailable' } | { status: 'review'; requestId?: string } | { status: 'pending'; input: PendingInput };
const keyFor = (owner: string, customer: string) => `${PREFIX}${encodeURIComponent(owner)}:${encodeURIComponent(customer)}`;
const validId = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function validInput(value: unknown): value is PendingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return validId(data.requestId) && typeof data.service === 'string' && !!data.service.trim()
    && ['after_clean', 'deposit_after_agreement'].includes(String(data.paymentPlan))
    && ['serviceDate', 'arrivalWindow', 'notes', 'email', 'phone', 'address', 'postcode'].every((key) => data[key] == null || typeof data[key] === 'string')
    && (data.totalPrice == null || typeof data.totalPrice === 'number' && Number.isFinite(data.totalPrice));
}

export function readPendingManualBooking(owner: string, customer: string): PendingManualBooking {
  if (!owner || !customer) return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(keyFor(owner, customer));
    if (raw === null) return { status: 'none' };
    const review = (requestId?: string): PendingManualBooking => {
      // Remove stale/corrupt customer details but retain a review marker so
      // a new operation cannot silently replace an uncertain saved booking.
      window.sessionStorage.setItem(keyFor(owner, customer), JSON.stringify({ review: true, owner, customer, ...(requestId ? { requestId } : {}) }));
      return { status: 'review', ...(requestId ? { requestId } : {}) };
    };
    if (raw.length > 16_000) return review();
    let data;
    try { data = JSON.parse(raw); } catch { return review(); }
    if (data?.review === true) return review(data.owner === owner && data.customer === customer && validId(data.requestId) ? data.requestId : undefined);
    if (!data || data.owner !== owner || data.customer !== customer || !validInput(data.input)
      || !Number.isFinite(data.savedAt) || data.savedAt > Date.now() || Date.now() - data.savedAt > TTL) {
      return review(data?.owner === owner && data?.customer === customer && validId(data?.input?.requestId) ? data.input.requestId : undefined);
    }
    return { status: 'pending', input: data.input };
  } catch { return { status: 'unavailable' }; }
}

export function rememberPendingManualBooking(owner: string, customer: string, input: ManualBookingInput): boolean {
  try {
    if (!validInput(input)) return false;
    const old = readPendingManualBooking(owner, customer);
    if (old.status === 'pending') return JSON.stringify(old.input) === JSON.stringify(input);
    if (old.status !== 'none') return false;
    const value = JSON.stringify({ owner, customer, savedAt: Date.now(), input });
    if (value.length > 16_000) return false;
    window.sessionStorage.setItem(keyFor(owner, customer), value);
    return window.sessionStorage.getItem(keyFor(owner, customer)) === value;
  } catch { return false; }
}

export function clearPendingManualBooking(owner: string, customer: string, requestId?: string): boolean {
  try {
    if (!owner || !customer) return false;
    const old = readPendingManualBooking(owner, customer);
    const storedId = old.status === 'pending' ? old.input.requestId : old.status === 'review' ? old.requestId : undefined;
    if (old.status === 'unavailable' || requestId && storedId !== requestId) return false;
    window.sessionStorage.removeItem(keyFor(owner, customer));
    return window.sessionStorage.getItem(keyFor(owner, customer)) === null;
  } catch { return false; }
}

export function clearPendingManualBookings(): void {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch { /* Sign-out must still finish with unavailable storage. */ }
}
