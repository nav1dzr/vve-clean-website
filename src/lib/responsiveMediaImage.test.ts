import { describe, expect, it } from 'vitest';
import { mediaImageSrcSet, mediaImageUrl } from './responsiveMediaImage';

describe('responsive managed media URLs', () => {
  const template = 'https://media-preview.example.test/image/{width}/11111111-2222-3333-4444-555555555555.jpg';

  it('fills the selected width without changing ordinary image URLs', () => {
    expect(mediaImageUrl(template, 1200)).toContain('/image/1200/');
    expect(mediaImageUrl('/images/local.jpg', 1200)).toBe('/images/local.jpg');
  });

  it('creates responsive candidates for Cloudflare transformation templates', () => {
    expect(mediaImageSrcSet(template)).toContain('/image/480/');
    expect(mediaImageSrcSet(template)).toContain('/image/2400/');
    expect(mediaImageSrcSet('/images/local.jpg')).toBeUndefined();
  });
});
