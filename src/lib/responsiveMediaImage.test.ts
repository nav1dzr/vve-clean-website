import { describe, expect, it } from 'vitest';
import { mediaImageSrcSet, mediaImageUrl } from './responsiveMediaImage';

describe('responsive managed media URLs', () => {
  const template = 'https://media-preview.example.test/cdn-cgi/image/width={width},format=auto,quality=85/originals/id/source.jpg';

  it('fills the selected width without changing ordinary image URLs', () => {
    expect(mediaImageUrl(template, 1200)).toContain('width=1200');
    expect(mediaImageUrl('/images/local.jpg', 1200)).toBe('/images/local.jpg');
  });

  it('creates responsive candidates for Cloudflare transformation templates', () => {
    expect(mediaImageSrcSet(template)).toContain('width=480');
    expect(mediaImageSrcSet(template)).toContain('width=2400');
    expect(mediaImageSrcSet('/images/local.jpg')).toBeUndefined();
  });
});
