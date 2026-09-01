import { describe, expect, it } from 'vitest';
import { createImageDeliveryTemplate } from '../api/_lib/mediaConfig.js';

describe('R2 image transformation delivery', () => {
  it('builds a Worker route without exposing a signed, API, or raw R2 source URL', () => {
    const assetId = '11111111-2222-3333-4444-555555555555';
    const url = createImageDeliveryTemplate(
      { mediaOrigin: 'https://media-preview.example.test' },
      assetId,
      `originals/${assetId}/source.jpg`,
    );

    expect(url).toBe(`https://media-preview.example.test/image/{width}/${assetId}.jpg`);
    expect(url).not.toContain('r2.cloudflarestorage.com');
    expect(url).not.toContain('X-Amz-');
    expect(url).not.toContain('originals/');
  });
});
