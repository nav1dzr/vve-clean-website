import type { InvoiceItemsFormValue } from '../components/InvoiceItemsForm';

export const INVOICE_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
export const INVOICE_RECOVERY_CLEARED_EVENT = 'vve-invoice-recovery-cleared';
const PREFIX = 'vve-invoice-draft:v1:';
const MAX_LENGTH = 250_000;
const MAX_DRAFTS = 10;

export interface InvoiceRecoveryContext {
  userId: string;
  documentKey: string;
  // Existing drafts use documentVersion + updatedAt. New documents use "new".
  baseVersion: string;
}

export type RawInvoiceNumerics = Record<string, Partial<Record<'qty' | 'price' | 'discount', string>>>;

export interface InvoiceRecoverySnapshot {
  value: InvoiceItemsFormValue;
  serviceContactEnabled: boolean;
  refManuallyEdited: boolean;
  rawNumerics: RawInvoiceNumerics;
}

type RecoveryRead =
  | { status: 'empty' | 'expired' | 'invalid' | 'unavailable' }
  | { status: 'changed'; snapshot: InvoiceRecoverySnapshot }
  | { status: 'recovered'; snapshot: InvoiceRecoverySnapshot };

function storageKey(context: InvoiceRecoveryContext) {
  return PREFIX + encodeURIComponent(context.userId) + ':' + encodeURIComponent(context.documentKey);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 20_000;
}

function isNullableText(value: unknown) {
  return value === null || isText(value);
}

function validContact(value: unknown, requiresName: boolean) {
  return isObject(value)
    && (requiresName ? isText(value.name) : isNullableText(value.name))
    && ['email', 'phone', 'address', 'postcode'].every((key) => isNullableText(value[key]));
}

function validSnapshot(snapshot: unknown): snapshot is InvoiceRecoverySnapshot {
  if (!isObject(snapshot) || !isObject(snapshot.value)) return false;
  const value = snapshot.value;
  if (!validContact(value.customer, true) || !validContact(value.serviceContact, false)) return false;
  if (!['poReference', 'issueDate', 'dueDate', 'serviceDate', 'customerNotes', 'internalNotes',
    'paymentTerms', 'stripePaymentLinkUrl', 'invoiceRecipientEmail', 'receiptRecipientEmail']
    .every((key) => isText(value[key]))) return false;
  if (!['billingCustomerId', 'serviceCustomerId'].every((key) => isNullableText(value[key]))) return false;
  if (!['documentDiscount', 'depositApplied'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))) return false;
  if (!['bank_transfer', 'stripe_payment_link', 'both'].includes(String(value.paymentOption))) return false;
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) return false;
  const keys = new Set<string>();
  for (const item of value.items) {
    if (!isObject(item) || typeof item.key !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.key)
      || keys.has(item.key) || !isText(item.description)
      || !['quantity', 'unitPrice', 'lineDiscount'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key]))) return false;
    keys.add(item.key);
  }
  if (typeof snapshot.serviceContactEnabled !== 'boolean' || typeof snapshot.refManuallyEdited !== 'boolean'
    || !isObject(snapshot.rawNumerics)) return false;
  for (const [key, fields] of Object.entries(snapshot.rawNumerics)) {
    if (!keys.has(key) || !isObject(fields)) return false;
    for (const [field, raw] of Object.entries(fields)) {
      if (!['qty', 'price', 'discount'].includes(field) || typeof raw !== 'string'
        || raw.length > 30 || !/^$|^\d+\.?\d{0,2}$/.test(raw)) return false;
    }
  }
  return true;
}

export function readInvoiceDraftRecovery(context: InvoiceRecoveryContext): RecoveryRead {
  try {
    const key = storageKey(context);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { status: 'empty' };
    const invalid = (status: 'expired' | 'invalid'): RecoveryRead => {
      window.sessionStorage.removeItem(key);
      return { status };
    };
    if (raw.length > MAX_LENGTH) return invalid('invalid');
    let record: unknown;
    try { record = JSON.parse(raw); } catch { return invalid('invalid'); }
    if (!isObject(record) || record.schema !== 1 || record.userId !== context.userId
      || record.documentKey !== context.documentKey || typeof record.savedAt !== 'number'
      || !Number.isFinite(record.savedAt)) return invalid('invalid');
    if (record.savedAt > Date.now() || Date.now() - record.savedAt > INVOICE_RECOVERY_TTL_MS) return invalid('expired');
    if (!validSnapshot(record.snapshot)) return invalid('invalid');
    if (record.baseVersion !== context.baseVersion) return { status: 'changed', snapshot: record.snapshot };
    return { status: 'recovered', snapshot: record.snapshot };
  } catch {
    return { status: 'unavailable' };
  }
}

export function writeInvoiceDraftRecovery(context: InvoiceRecoveryContext, snapshot: InvoiceRecoverySnapshot): boolean {
  try {
    if (!validSnapshot(snapshot)) return false;
    const now = Date.now();
    const storage = window.sessionStorage;
    const key = storageKey(context);
    const raw = JSON.stringify({ schema: 1, ...context, savedAt: now, snapshot });
    if (raw.length > MAX_LENGTH) return false;
    const existing: Array<{ key: string; savedAt: number }> = [];
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const candidate = storage.key(index);
      if (!candidate?.startsWith(PREFIX) || candidate === key) continue;
      try {
        const previous = JSON.parse(storage.getItem(candidate) || 'null');
        if (!previous || !Number.isFinite(previous.savedAt) || now - previous.savedAt > INVOICE_RECOVERY_TTL_MS) {
          storage.removeItem(candidate);
        } else {
          existing.push({ key: candidate, savedAt: previous.savedAt });
        }
      } catch { storage.removeItem(candidate); }
    }
    existing.sort((a, b) => b.savedAt - a.savedAt);
    for (const previous of existing.slice(MAX_DRAFTS - 1)) storage.removeItem(previous.key);
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function clearInvoiceDraftRecovery(context: Pick<InvoiceRecoveryContext, 'userId' | 'documentKey'>): void {
  try {
    window.sessionStorage.removeItem(storageKey({ ...context, baseVersion: '' }));
  } catch { /* Private browsing/storage denial must not break invoice actions. */ }
}

// Called by authentication when signing out, switching users or losing access.
// Notify mounted forms so a late pagehide cannot recreate cleared customer data.
export function clearInvoiceDraftRecoveries(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(INVOICE_RECOVERY_CLEARED_EVENT));
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Signing out must still complete if browser storage is unavailable. */ }
}