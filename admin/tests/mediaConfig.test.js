import { describe, expect, it } from 'vitest';
import { createImageDeliveryTemplate } from '../api/_lib/mediaConfig.js';

describe('R2 image transformation delivery', () => {
  it('builds an edge-transformed URL without exposing a signed or API source URL', () => {
    const url = createImageDeliveryTemplate(
      { mediaOrigin: 'https://media-preview.example.test' },
      'originals/asset-id/source.jpg',
    );

    expect(url).toBe('https://media-preview.example.test/cdn-cgi/image/width={width},format=auto,quality=85,fit=scale-down/originals/asset-id/source.jpg');
    expect(url).not.toContain('r2.cloudflarestorage.com');
    expect(url).not.toContain('X-Amz-');
  });
});
