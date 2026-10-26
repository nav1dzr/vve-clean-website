import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ADS_VALIDATION_SOURCE_FILES, ADS_VALIDATION_SOURCE_SHA256 } from '../../admin/api/_lib/adsValidationManifest.js';
import { ADS_VALIDATION_BINDING } from '../../admin/api/_lib/adsValidationBinding.js';
const hash = value => createHash('sha256').update(value).digest('hex');
describe('reviewable validation manifest', () => {
  it('pins the exact implementation files without binding/hash self-reference', () => {
    expect(Object.keys(ADS_VALIDATION_SOURCE_FILES)).not.toContain('admin/api/_lib/adsValidationBinding.js');
    expect(Object.keys(ADS_VALIDATION_SOURCE_FILES)).not.toContain('admin/api/_lib/adsValidationManifest.js');
    for (const [path, digest] of Object.entries(ADS_VALIDATION_SOURCE_FILES)) {
      // Canonical UTF-8/LF, independent of Git checkout CRLF conversion.
      expect(hash(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')), path).toBe(digest);
    }
    expect(hash(JSON.stringify(ADS_VALIDATION_SOURCE_FILES))).toBe(ADS_VALIDATION_SOURCE_SHA256);
  });
  it('permits only a wholly closed binding or a fully pinned finite UTC window', () => {
    const binding = ADS_VALIDATION_BINDING;
    expect(Object.keys(binding).sort()).toEqual(['endsAt', 'executionAuthoritySha256', 'sourceManifestSha256', 'startsAt']);
    if (Object.values(binding).every(value => value === null)) return;
    expect(binding.sourceManifestSha256).toBe(ADS_VALIDATION_SOURCE_SHA256);
    expect(binding.executionAuthoritySha256).toMatch(/^[a-f0-9]{64}$/);
    for (const value of [binding.startsAt, binding.endsAt]) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(value).toISOString()).toBe(value);
    }
    const duration = Date.parse(binding.endsAt) - Date.parse(binding.startsAt);
    expect(duration).toBeGreaterThan(0); expect(duration).toBeLessThanOrEqual(1800000);
  });
});
