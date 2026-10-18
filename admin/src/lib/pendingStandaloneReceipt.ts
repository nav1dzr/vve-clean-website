import { INVOICE_PAYMENT_METHOD_VALUES, type StandaloneReceiptInput } from '../types/invoice';

const PREFIX = 'vve-pending-standalone-receipt:v1:';
const MAX_ENTRIES = 20;
const MAX_LENGTH = 16_000;
export const PENDING_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
type PendingInput = StandaloneReceiptInput & { requestId: string };

export type PendingReceiptState =
  | { status: 'none' | 'unavailable' }
  | { status: 'pending'; input: PendingInput }
  | { status: 'review'; reason: 'expired' | 'invalid'; requestId?: string };

function keyFor(userId: string) { return PREFIX + encodeURIComponent(userId); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function optionalText(value: unknown) {
  return value == null || (typeof value === 'string' && value.length <= 2_000);
}
function validInput(value: unknown): value is PendingInput {
  if (!object(value) || !object(value.customer)) return false;
  const customer = value.customer;
  return validId(value.requestId)
    && typeof customer.name === 'string' && !!customer.name.trim() && customer.name.length <= 500
    && ['email', 'phone', 'address', 'postcode'].every((field) => optionalText(customer[field]))
    && !!(customer.email || customer.phone)
    && typeof value.serviceDescription === 'string' && !!value.serviceDescription.trim() && value.serviceDescription.length <= 500
    && typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0
    && typeof value.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.paymentDate)
    && typeof value.paymentMethod === 'string' && INVOICE_PAYMENT_METHOD_VALUES.some((method) => method === value.paymentMethod)
    && optionalText(value.paymentReference);
}

// Keep the original operation until the API confirms its result. Expired or
// damaged data becomes a review marker, rather than permission to duplicate it.
export function readPendingStandaloneReceipt(userId: string): PendingReceiptState {
  if (!userId) return { status: 'unavailable' };
  try {
    const storage = window.sessionStorage;
    const key = keyFor(userId);
    const raw = storage.getItem(key);
    if (raw === null) return { status: 'none' };
    const review = (reason: 'expired' | 'invalid', requestId?: string): PendingReceiptState => {
      const safeId = validId(requestId) ? requestId : undefined;
      storage.setItem(key, JSON.stringify({ schema: 1, userId, status: 'review', reason, requestId: safeId }));
      return { status: 'review', reason, requestId: safeId };
    };
    if (raw.length > MAX_LENGTH) return review('invalid');
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return review('invalid'); }
    if (!object(data) || data.schema !== 1 || data.userId !== userId) return review('invalid');
    if (data.status === 'review') return review(data.reason === 'expired' ? 'expired' : 'invalid', typeof data.requestId === 'string' ? data.requestId : undefined);
    if (data.status !== 'pending' || !validInput(data.input)
      || typeof data.createdAt !== 'number' || !Number.isFinite(data.createdAt)) return review('invalid');
    if (data.createdAt > Date.now() || Date.now() - data.createdAt > PENDING_RECEIPT_TTL_MS) return review('expired', data.input.requestId);
    return { status: 'pending', input: data.input };
  } catch { return { status: 'unavailable' }; }
}

// Persist and verify before sending. A second attempt must retain both the ID
// and the exact original payload, including after refresh or a dropped response.
export function rememberPendingStandaloneReceipt(userId: string, input: StandaloneReceiptInput): boolean {
  try {
    if (!userId || !validInput(input)) return false;
    const previous = readPendingStandaloneReceipt(userId);
    if (previous.status === 'pending') return JSON.stringify(previous.input) === JSON.stringify(input);
    if (previous.status !== 'none') return false;
    const storage = window.sessionStorage;
    let count = 0;
    for (let index = 0; index < storage.length; index += 1) if (storage.key(index)?.startsWith(PREFIX)) count += 1;
    if (count >= MAX_ENTRIES) return false;
    const value = JSON.stringify({ schema: 1, userId, status: 'pending', createdAt: Date.now(), input });
    if (value.length > MAX_LENGTH) return false;
    storage.setItem(keyFor(userId), value);
    return storage.getItem(keyFor(userId)) === value;
  } catch { return false; }
}

// Matching IDs prevent a late response clearing a newer receipt. Omit the ID
// only after the owner has explicitly checked the receipts list and discarded it.
export function clearPendingStandaloneReceipt(userId: string, requestId?: string): boolean {
  try {
    const current = readPendingStandaloneReceipt(userId);
    if (current.status === 'unavailable') return false;
    if (requestId) {
      const currentId = current.status === 'pending' ? current.input.requestId : current.status === 'review' ? current.requestId : null;
      if (currentId !== requestId) return false;
    }
    window.sessionStorage.removeItem(keyFor(userId));
    return window.sessionStorage.getItem(keyFor(userId)) === null;
  } catch { return false; }
}

export function clearPendingStandaloneReceipts(): void {
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Signing out must still finish when browser storage is blocked. */ }
}
