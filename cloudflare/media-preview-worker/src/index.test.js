import { describe, expect, it } from 'vitest';
import { mediaRequest, outputFormat } from './index.js';

describe('private R2 media Worker routes', () => {
  it('maps a constrained delivery route to an internal immutable R2 key', () => {
    expect(mediaRequest('/image/1200/11111111-2222-3333-4444-555555555555.heic')).toEqual({
      width: 1200,
      assetId: '11111111-2222-3333-4444-555555555555',
      extension: 'heic',
      key: 'originals/11111111-2222-3333-4444-555555555555/source.heic',
    });
  });

  it('rejects raw object paths and unbounded transformation sizes', () => {
    expect(mediaRequest('/originals/11111111-2222-3333-4444-555555555555/source.jpg')).toBeNull();
    expect(mediaRequest('/image/9999/11111111-2222-3333-4444-555555555555.jpg')).toBeNull();
  });

  it('implements format=auto from browser support', () => {
    expect(outputFormat('image/avif,image/webp,image/*')).toBe('image/avif');
    expect(outputFormat('image/webp,image/*')).toBe('image/webp');
    expect(outputFormat('image/*')).toBe('image/jpeg');
  });
});
