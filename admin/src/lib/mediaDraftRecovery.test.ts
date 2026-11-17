import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readMediaDetailsDraft, saveMediaDetailsDraft } from './mediaDraftRecovery';
import { clearInvoiceDraftRecoveries } from './invoiceDraftRecovery';
const draft = {assetId:'sample',baseVersion:'v1',values:{title:'Sample title',altText:'Sample description',
  category:'carpet' as const,beforeAfter:'none' as const,locationLabel:'',pairKey:''}};
beforeEach(() => {sessionStorage.clear();vi.restoreAllMocks();});
describe('private media detail recovery', () => {
  it('retains an editable property-services draft without changing its category', () => {
    const property = {...draft,values:{...draft.values,category:'property-services' as const}};
    expect(saveMediaDetailsDraft('owner', property)).toBe(true);
    expect(readMediaDetailsDraft('owner')).toEqual(property);
  });
  it('isolates the owner and clears recovery on sign-out', () => {
    expect(saveMediaDetailsDraft('owner-a', draft)).toBe(true);
    expect(readMediaDetailsDraft('owner-b')).toBeNull();
    expect(readMediaDetailsDraft('owner-a')).toEqual(draft);
    clearInvoiceDraftRecoveries();
    expect(readMediaDetailsDraft('owner-a')).toBeNull();
  });
  it('expires private draft text and excludes provider credentials from its stored shape', () => {
    expect(saveMediaDetailsDraft('owner', draft)).toBe(true);
    const value = JSON.parse(sessionStorage.getItem('vve-media-details:v1:owner')!);
    expect(Object.keys(value.draft).sort()).toEqual(['assetId','baseVersion','values']);
    value.savedAt = Date.now() - 25 * 60 * 60 * 1000;
    sessionStorage.setItem('vve-media-details:v1:owner',JSON.stringify(value));
    expect(readMediaDetailsDraft('owner')).toBeNull();
  });
});
