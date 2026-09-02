import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNewAsset } from '../api/_lib/mediaFields.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../api/_lib/mediaAssetActions.js'), 'utf8');

describe('media publication boundary', () => {
  it('keeps uploads private until an explicit assignment makes the asset eligible for public delivery', () => {
    const upload = validateNewAsset({ filename: 'before.heic', contentType: 'image/heic', size: 1024 });
    expect(upload.ok && upload.value.websiteVisible).toBe(false);
    expect(source).toContain(".update({ website_visible: true, updated_at: now })");
  });
});
