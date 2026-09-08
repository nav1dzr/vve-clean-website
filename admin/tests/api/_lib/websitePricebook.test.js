import { describe, expect, it } from 'vitest';
import { validatePricebookDraft, previewWebsitePricebook, pricebookRefreshConfigured } from '../../../api/_lib/websitePricebook.js';

describe('website pricebook draft validation and preview', () => {
  it('requires a labelled price object and never accepts deposit changes', () => {
    expect(validatePricebookDraft({ label: 'New prices' }).ok).toBe(false);
    expect(validatePricebookDraft({ label: '', overrides: {} }).ok).toBe(false);
    expect(validatePricebookDraft({ label: 'New prices', overrides: { DEPOSIT_P: 0 } }).ok).toBe(false);
    expect(validatePricebookDraft({ label: 'Current prices', overrides: {} }).ok).toBe(true);
  });
  it('uses actual calculator totals including the upholstery minimum', () => {
    const preview = previewWebsitePricebook();
    expect(preview.examples.map(item => item.pence)).toEqual([10000, 8500, 27900, 19900]);
  });
  it('saves a complete snapshot of editable prices even for a one-item draft', () => {
    const result = validatePricebookDraft({ label: 'One change', overrides: { CARPET_ITEM_PRICES_P: { bedroom: 6000 } } });
    expect(result.ok).toBe(true);
    expect(result.value.overrides.CARPET_ITEM_PRICES_P.bedroom).toBe(6000);
    expect(result.value.overrides.CARPET_ITEM_PRICES_P.sofa_2).toBe(7000);
    expect(result.value.overrides.EOT_PRICES_P.flat.bed1.complete).toBe(27900);
  });
  it('requires managed pricing enabled and an HTTPS build refresh connection', () => {
    expect(pricebookRefreshConfigured({})).toBe(false);
    expect(pricebookRefreshConfigured({ WEBSITE_PRICEBOOK_REFRESH_URL: 'https://example.test/build' })).toBe(false);
    expect(pricebookRefreshConfigured({ WEBSITE_PRICEBOOK_ENABLED: 'true', WEBSITE_PRICEBOOK_REFRESH_URL: 'http://example.test' })).toBe(false);
    expect(pricebookRefreshConfigured({ WEBSITE_PRICEBOOK_ENABLED: 'true', WEBSITE_PRICEBOOK_REFRESH_URL: 'https://example.test/build' })).toBe(true);
  });
});
