import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStandaloneReceiptDraft, clearStandaloneReceiptDrafts, readStandaloneReceiptDraft, writeStandaloneReceiptDraft, RECEIPT_DRAFT_TTL_MS, type StandaloneReceiptDraft } from './standaloneReceiptDraft';

const draft: StandaloneReceiptDraft = {
  customer: { name: 'Synthetic draft', email: '', phone: '', address: '', postcode: '' },
  serviceDescription: '', amount: '12.', paymentDate: '2026-10-18', paymentMethod: 'cash', paymentReference: '',
};
const key = 'vve-standalone-receipt-draft:v1:owner';

describe('standalone receipt unsent recovery', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('keeps incomplete form fields without creating a payment request identity', () => {
    expect(writeStandaloneReceiptDraft('owner', draft)).toBe(true);
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'restored', draft });
    expect(JSON.parse(window.sessionStorage.getItem(key)!)).not.toHaveProperty('requestId');
  });

  it('does not return another account’s draft and rejects a mismatched stored owner', () => {
    writeStandaloneReceiptDraft('owner', draft);
    expect(readStandaloneReceiptDraft('other')).toEqual({ status: 'none' });
    window.sessionStorage.setItem(key, JSON.stringify({ schema: 1, ownerId: 'other', savedAt: Date.now(), draft }));
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'invalid' });
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it.each(['expired', 'future'])('removes %s timestamps instead of restoring customer details', (kind) => {
    const savedAt = kind === 'expired' ? Date.now() - RECEIPT_DRAFT_TTL_MS - 1 : Date.now() + 60_000;
    window.sessionStorage.setItem(key, JSON.stringify({ schema: 1, ownerId: 'owner', savedAt, draft }));
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'expired' });
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it('rejects malformed/oversized snapshots and does not overwrite a valid copy', () => {
    writeStandaloneReceiptDraft('owner', draft);
    expect(writeStandaloneReceiptDraft('owner', { ...draft, serviceDescription: 'x'.repeat(501) })).toBe(false);
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'restored', draft });
    window.sessionStorage.setItem(key, '{invalid');
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'invalid' });
  });

  it('reports blocked reads/writes/clears without throwing or claiming persistence', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'unavailable' });
    expect(writeStandaloneReceiptDraft('owner', draft)).toBe(false);
    expect(clearStandaloneReceiptDraft('owner')).toBe(false);
  });

  it('clears draft copies across accounts without deleting unrelated session values', () => {
    writeStandaloneReceiptDraft('owner', draft);
    writeStandaloneReceiptDraft('other', draft);
    window.sessionStorage.setItem('unrelated', 'preserved');
    clearStandaloneReceiptDrafts();
    expect(readStandaloneReceiptDraft('owner')).toEqual({ status: 'none' });
    expect(readStandaloneReceiptDraft('other')).toEqual({ status: 'none' });
    expect(window.sessionStorage.getItem('unrelated')).toBe('preserved');
  });
});
