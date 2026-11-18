import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateNewAsset } from '../api/_lib/mediaFields.js';
import { checkMediaFile } from '../src/lib/mediaFileCheck';

// The two synthetic files prepared for the owner-approved real upload test.
// They are labelled "VVE MEDIA TEST — NOT CUSTOMER WORK" and contain no
// customer material. This proves only that both the browser check and the
// server rule accept them; it performs no upload.
const fixture = (name) => readFileSync(resolve(process.cwd(), 'tests/fixtures/media-upload-test', name));

describe('synthetic upload test files', () => {
  it('provides a real JPEG the browser check and server rule both accept', () => {
    const bytes = fixture('vve-media-test-photo.jpg');
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const file = { name: 'vve-media-test-photo.jpg', type: 'image/jpeg', size: bytes.length };
    expect(checkMediaFile(file)).toEqual({ ok: true, kind: 'photo', contentType: 'image/jpeg' });
    expect(validateNewAsset({ filename: file.name, contentType: file.type, size: file.size, category: 'carpet' }))
      .toMatchObject({ ok: true, value: { mediaType: 'image', websiteVisible: false } });
  });

  it('provides a real short MP4 the browser check and server rule both accept', () => {
    const bytes = fixture('vve-media-test-video.mp4');
    expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
    expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
    const file = { name: 'vve-media-test-video.mp4', type: 'video/mp4', size: bytes.length };
    expect(checkMediaFile(file)).toEqual({ ok: true, kind: 'video', contentType: 'video/mp4' });
    expect(validateNewAsset({ filename: file.name, contentType: file.type, size: file.size, category: 'carpet' }))
      .toMatchObject({ ok: true, value: { mediaType: 'video', websiteVisible: false } });
  });
});
