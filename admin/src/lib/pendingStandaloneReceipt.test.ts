import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingStandaloneReceipt, clearPendingStandaloneReceipts, PENDING_RECEIPT_TTL_MS, readPendingStandaloneReceipt, rememberPendingStandaloneReceipt } from './pendingStandaloneReceipt';
import { clearInvoiceDraftRecoveries } from './invoiceDraftRecovery';
import type { StandaloneReceiptInput } from '../types/invoice';

const userId = 'owner-test';
const key = 'vve-pending-standalone-receipt:v1:owner-test';
const input: StandaloneReceiptInput = {
  requestId: '0348769e-a41f-4b4e-83f2-03885cb54c11',
  customer: { name: 'Synthetic Customer', email: 'receipt@example.invalid', phone: null, address: 'Test address', postcode: 'TEST' },
  serviceDescription: 'Synthetic clean', amount: 85, paymentDate: '2026-10-15', paymentMethod: 'bank_transfer', paymentReference: 'TEST-ONLY',
};

describe('pending standalone receipt recovery', () => {
  beforeEach(() => { window.sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('round-trips the original receipt and will not replace it with a new ID or changed amount', () => {
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(true);
    expect(readPendingStandaloneReceipt(userId)).toEqual({ status: 'pending', input });
    expect(rememberPendingStandaloneReceipt(userId, { ...input })).toBe(true);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, amount: 86 })).toBe(false);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, requestId: crypto.randomUUID() })).toBe(false);
    expect(readPendingStandaloneReceipt(userId)).toEqual({ status: 'pending', input });
  });

  it('isolates recovery by account and rejects an envelope copied from another account', () => {
    rememberPendingStandaloneReceipt(userId, input);
    expect(readPendingStandaloneReceipt('different-owner')).toEqual({ status: 'none' });
    window.sessionStorage.setItem('vve-pending-standalone-receipt:v1:different-owner', window.sessionStorage.getItem(key)!);
    expect(readPendingStandaloneReceipt('different-owner')).toMatchObject({ status: 'review', reason: 'invalid' });
    expect(window.sessionStorage.getItem('vve-pending-standalone-receipt:v1:different-owner')).not.toContain('Synthetic Customer');
    expect(readPendingStandaloneReceipt(userId)).toEqual({ status: 'pending', input });
  });

  it('expires customer data into a blocking marker while retaining the original request ID', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    rememberPendingStandaloneReceipt(userId, input);
    vi.setSystemTime(Date.now() + PENDING_RECEIPT_TTL_MS + 1);
    expect(readPendingStandaloneReceipt(userId)).toEqual({ status: 'review', reason: 'expired', requestId: input.requestId });
    expect(window.sessionStorage.getItem(key)).not.toMatch(/Synthetic|example|TEST-ONLY|address/);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, requestId: crypto.randomUUID() })).toBe(false);
  });

  it.each(['not-json', JSON.stringify({ schema: 1, userId, status: 'pending', input: { customer: { name: 'PRIVATE' } } }), 'x'.repeat(16_001)])('blocks corrupt recovery rather than treating it as a new receipt (%#)', (raw) => {
    window.sessionStorage.setItem(key, raw);
    expect(readPendingStandaloneReceipt(userId)).toMatchObject({ status: 'review', reason: 'invalid' });
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(false);
    expect(window.sessionStorage.getItem(key)).not.toContain('PRIVATE');
  });

  it('does not remove a later operation in response to an earlier result', () => {
    rememberPendingStandaloneReceipt(userId, input);
    expect(clearPendingStandaloneReceipt(userId, crypto.randomUUID())).toBe(false);
    expect(readPendingStandaloneReceipt(userId).status).toBe('pending');
    expect(clearPendingStandaloneReceipt(userId, input.requestId)).toBe(true);
    expect(readPendingStandaloneReceipt(userId).status).toBe('none');
  });

  it('clears pending customer data on the existing logout/access-change cleanup', () => {
    rememberPendingStandaloneReceipt(userId, input);
    rememberPendingStandaloneReceipt('second-owner', input);
    window.sessionStorage.setItem('unrelated', 'keep');
    clearInvoiceDraftRecoveries();
    expect(readPendingStandaloneReceipt(userId).status).toBe('none');
    expect(readPendingStandaloneReceipt('second-owner').status).toBe('none');
    expect(window.sessionStorage.getItem('unrelated')).toBe('keep');
  });

  it('fails closed when storage reads, writes, or readback verification fail', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPendingStandaloneReceipt(userId).status).toBe('unavailable');
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(false);
    read.mockRestore();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(false);
    write.mockImplementation(() => undefined);
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(false);
  });

  it('does not evict unresolved attempts to make storage space', () => {
    for (let index = 0; index < 20; index += 1) expect(rememberPendingStandaloneReceipt(`owner-${index}`, input)).toBe(true);
    expect(rememberPendingStandaloneReceipt(userId, input)).toBe(false);
    expect(readPendingStandaloneReceipt('owner-0').status).toBe('pending');
  });

  it('rejects malformed payloads and missing account IDs before saving', () => {
    expect(rememberPendingStandaloneReceipt('', input)).toBe(false);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, requestId: undefined })).toBe(false);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, amount: NaN })).toBe(false);
    expect(rememberPendingStandaloneReceipt(userId, { ...input, customer: { ...input.customer, email: null, phone: null } })).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('allows logout to complete even when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => clearPendingStandaloneReceipts()).not.toThrow();
  });
});
