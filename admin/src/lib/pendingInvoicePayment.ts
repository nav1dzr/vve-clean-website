import { INVOICE_PAYMENT_METHOD_VALUES, type RecordPaymentInput } from '../types/invoice';

const PREFIX = 'vve-pending-invoice-payment:v1:';
const MAX_ENTRIES = 20;
const MAX_LENGTH = 16_000;
export const PENDING_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingPaymentContext { userId: string; invoiceId: string }

export type PendingPaymentState =
  | { status: 'none' | 'unavailable' }
  | { status: 'pending'; input: RecordPaymentInput }
  | { status: 'review'; reason: 'expired' | 'invalid'; operationId?: string };

function keyFor(context: PendingPaymentContext) {
  return PREFIX + encodeURIComponent(context.userId) + ':' + encodeURIComponent(context.invoiceId);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validInput(value: unknown): value is RecordPaymentInput {
  return object(value)
    && typeof value.operationId === 'string' && /^[0-9a-f-]{36}$/i.test(value.operationId)
    && typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0
    && typeof value.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.paymentDate)
    && typeof value.method === 'string' && INVOICE_PAYMENT_METHOD_VALUES.some((method) => method === value.method)
    && typeof value.reference === 'string' && value.reference.length <= 5_000
    && typeof value.notes === 'string' && value.notes.length <= 5_000
    && typeof value.sendAcknowledgement === 'boolean';
}

// An expired/corrupt attempt becomes a small review marker, never a silently
// fresh payment. Its customer-entered reference/notes are removed at expiry.
export function readPendingInvoicePayment(context: PendingPaymentContext): PendingPaymentState {
  try {
    const storage = window.sessionStorage;
    const key = keyFor(context);
    const raw = storage.getItem(key);
    if (raw === null) return { status: 'none' };
    const review = (reason: 'expired' | 'invalid', operationId?: string): PendingPaymentState => {
      storage.setItem(key, JSON.stringify({ schema: 1, ...context, status: 'review', reason, operationId }));
      return { status: 'review', reason, operationId };
    };
    if (raw.length > MAX_LENGTH) return review('invalid');
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return review('invalid'); }
    if (!object(data) || data.schema !== 1 || data.userId !== context.userId || data.invoiceId !== context.invoiceId) return review('invalid');
    if (data.status === 'review') {
      if (!['expired', 'invalid'].includes(String(data.reason))) return review('invalid');
      return { status: 'review', reason: data.reason as 'expired' | 'invalid',
        operationId: typeof data.operationId === 'string' ? data.operationId : undefined };
    }
    if (data.status !== 'pending' || !validInput(data.input)
      || typeof data.createdAt !== 'number' || !Number.isFinite(data.createdAt)) return review('invalid');
    if (data.createdAt > Date.now() || Date.now() - data.createdAt > PENDING_PAYMENT_TTL_MS) return review('expired', data.input.operationId);
    return { status: 'pending', input: data.input };
  } catch { return { status: 'unavailable' }; }
}

// Must succeed before the first request is sent. Existing unresolved requests
// cannot be overwritten by changed form values or by a new random operation ID.
export function rememberPendingInvoicePayment(context: PendingPaymentContext, input: RecordPaymentInput): boolean {
  try {
    if (!validInput(input)) return false;
    const previous = readPendingInvoicePayment(context);
    if (previous.status === 'pending') return JSON.stringify(previous.input) === JSON.stringify(input);
    if (previous.status !== 'none') return false;
    const storage = window.sessionStorage;
    let count = 0;
    for (let index = 0; index < storage.length; index += 1) {
      if (storage.key(index)?.startsWith(PREFIX)) count += 1;
    }
    // Never evict an unresolved operation just to make room for another one.
    if (count >= MAX_ENTRIES) return false;
    const value = JSON.stringify({ schema: 1, ...context, status: 'pending', createdAt: Date.now(), input });
    if (value.length > MAX_LENGTH) return false;
    const key = keyFor(context);
    storage.setItem(key, value);
    return storage.getItem(key) === value;
  } catch { return false; }
}

// Matching IDs protect a later request from an older response. Omit the ID only
// after the owner explicitly reviews/discards an unresolved request.
export function clearPendingInvoicePayment(context: PendingPaymentContext, operationId?: string): boolean {
  try {
    const current = readPendingInvoicePayment(context);
    if (current.status === 'unavailable') return false;
    if (operationId) {
      const currentId = current.status === 'pending' ? current.input.operationId
        : current.status === 'review' ? current.operationId : null;
      if (currentId !== operationId) return false;
    }
    window.sessionStorage.removeItem(keyFor(context));
    return window.sessionStorage.getItem(keyFor(context)) === null;
  } catch { return false; }
}

export function clearPendingInvoicePayments(): void {
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Signing out must still finish if browser storage is unavailable. */ }
}