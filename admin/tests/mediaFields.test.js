import { describe, expect, it } from 'vitest';
import { normaliseMetadata, validateNewAsset } from '../api/_lib/mediaFields.js';

describe('media upload fields', () => {
  it('accepts browser-safe iPhone photo details and normalises publishing metadata', () => {
    const result = validateNewAsset({
      filename: 'Living room.jpg', contentType: 'image/jpeg', size: 1234,
      category: 'carpet', beforeAfter: 'after', pairKey: 'Job August 2026!',
      websiteVisible: true, placement: 'gallery-carpet', slotKey: 'gallery-carpet-01', altText: 'Clean carpet after extraction',
    });
    expect(result.ok).toBe(true);
    expect(result.value.mediaType).toBe('image');
    expect(result.value.pairKey).toBe('job-august-2026');
    expect(result.value.requestedSlotKey).toBe('gallery-carpet-01');
  });

  it('does not accept an untrusted content type or arbitrary slot key', () => {
    expect(validateNewAsset({ filename: 'script.svg', contentType: 'image/svg+xml', size: 100 }).ok).toBe(false);
    expect(normaliseMetadata({ slotKey: 'gallery-99' }).requestedSlotKey).toBe(null);
  });
});
