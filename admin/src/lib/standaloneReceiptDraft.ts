import { INVOICE_PAYMENT_METHOD_VALUES } from '../types/invoice';

const PREFIX = 'vve-standalone-receipt-draft:v1:';
const MAX_LENGTH = 16_000;
export const RECEIPT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

// An unfinished form is not a pending payment operation and has no request ID.
export interface StandaloneReceiptDraft {
  customer: { name: string; email: string; phone: string; address: string; postcode: string };
  serviceDescription: string;
  amount: string;
  paymentDate: string;
  paymentMethod: (typeof INVOICE_PAYMENT_METHOD_VALUES)[number];
  paymentReference: string;
}
export type ReceiptDraftRead =
  | { status: 'none' | 'expired' | 'invalid' | 'unavailable' }
  | { status: 'restored'; draft: StandaloneReceiptDraft };

function keyFor(ownerId: string) { return PREFIX + encodeURIComponent(ownerId); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max = 2_000): value is string {
  return typeof value === 'string' && value.length <= max;
}
function validDraft(value: unknown): value is StandaloneReceiptDraft {
  return object(value) && object(value.customer)
    && text(value.customer.name, 500)
    && ['email', 'phone', 'address', 'postcode'].every(key => text((value.customer as Record<string, unknown>)[key]))
    && text(value.serviceDescription, 500) && text(value.amount, 30)
    && text(value.paymentDate, 10) && (value.paymentDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(value.paymentDate))
    && INVOICE_PAYMENT_METHOD_VALUES.some(method => method === value.paymentMethod)
    && text(value.paymentReference);
}

export function readStandaloneReceiptDraft(ownerId: string): ReceiptDraftRead {
  if (!ownerId) return { status: 'unavailable' };
  try {
    const key = keyFor(ownerId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { status: 'none' };
    const remove = (status: 'invalid' | 'expired'): ReceiptDraftRead => {
      window.sessionStorage.removeItem(key);
      return { status };
    };
    if (raw.length > MAX_LENGTH) return remove('invalid');
    let record: unknown;
    try { record = JSON.parse(raw); } catch { return remove('invalid'); }
    if (!object(record) || record.schema !== 1 || record.ownerId !== ownerId
      || typeof record.savedAt !== 'number' || !Number.isFinite(record.savedAt)
      || !validDraft(record.draft)) return remove('invalid');
    if (record.savedAt > Date.now() || Date.now() - record.savedAt > RECEIPT_DRAFT_TTL_MS) return remove('expired');
    return { status: 'restored', draft: record.draft };
  } catch { return { status: 'unavailable' }; }
}

export function writeStandaloneReceiptDraft(ownerId: string, draft: StandaloneReceiptDraft): boolean {
  try {
    if (!ownerId || !validDraft(draft)) return false;
    const raw = JSON.stringify({ schema: 1, ownerId, savedAt: Date.now(), draft });
    if (raw.length > MAX_LENGTH) return false;
    const key = keyFor(ownerId);
    window.sessionStorage.setItem(key, raw);
    return window.sessionStorage.getItem(key) === raw;
  } catch { return false; }
}

export function clearStandaloneReceiptDraft(ownerId: string): boolean {
  try {
    window.sessionStorage.removeItem(keyFor(ownerId));
    return window.sessionStorage.getItem(keyFor(ownerId)) === null;
  } catch { return false; }
}

export function clearStandaloneReceiptDrafts(): void {
  try {
    const storage = window.sessionStorage;
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Sign-out must complete even with unavailable storage. */ }
}
