import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCustomerEmailDrafts, readCustomerEmailDraft, saveCustomerEmailDraft } from './customerEmailDraft';
const draft = { id: 'draft', recipient: 'client@example.com', subject: 'Quote', body: 'Private text', style: 'simple' as const };
describe('email working-copy recovery', () => {
  beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
  it('scopes recovery to customer and signed-in admin', () => {
    saveCustomerEmailDraft('a','customer',draft);
    expect(readCustomerEmailDraft('a','customer')).toEqual(draft);
    expect(readCustomerEmailDraft('b','customer')).toBeNull();
    expect(readCustomerEmailDraft('a','other')).toBeNull();
  });
  it('expires after 24 hours and clears all working copies on sign-out', () => {
    saveCustomerEmailDraft('a','customer',draft);
    vi.spyOn(Date,'now').mockReturnValue(Date.now() + 86400001);
    expect(readCustomerEmailDraft('a','customer')).toBeNull();
    saveCustomerEmailDraft('a','other',draft); clearCustomerEmailDrafts();
    expect(sessionStorage.length).toBe(0);
  });
  it('works safely when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(saveCustomerEmailDraft('a','customer',draft)).toBe(false);
  });
});
