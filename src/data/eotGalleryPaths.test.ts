// End of Tenancy media paths.
//
// The EOT images used to live flat in public/end_of_tenancy/ (1.jpg…10.jpg plus
// kitchen1_before.jpg and friends). They were reorganised into two subfolders —
// gallery/ for the rotating set and before-after/ for the approved pairs — and
// the legacy component that hard-coded the flat paths (EotGallery.tsx) was
// deleted as dead code.
//
// Nothing in the type system stops a flat path coming back: a manifest entry is
// just a string, and a wrong one still typechecks, still renders, and still
// passes every DOM assertion — it just shows the customer a broken image on the
// site's most important landing page. These assertions are the only thing that
// catches it.

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EOT_FEATURED_BEFORE_AFTER,
  EOT_ROTATING_PHOTOS,
  GALLERY_MEDIA,
} from './galleryMedia';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const EOT_DIR = path.join(PUBLIC_DIR, 'end_of_tenancy');

/** Every image URL the End of Tenancy category publishes. */
const EOT_PATHS = [
  ...EOT_FEATURED_BEFORE_AFTER.flatMap((p) => [p.before, p.after]),
  ...EOT_ROTATING_PHOTOS.map((p) => p.src),
];

describe('every published End of Tenancy image lives in a subfolder', () => {
  it('publishes 19 images — 6 before/after halves and 13 rotating photos', () => {
    expect(EOT_FEATURED_BEFORE_AFTER).toHaveLength(3);
    expect(EOT_ROTATING_PHOTOS).toHaveLength(13);
    expect(EOT_PATHS).toHaveLength(19);
  });

  it.each(EOT_PATHS)('%s sits under gallery/ or before-after/', (src) => {
    expect(src).toMatch(/^\/end_of_tenancy\/(gallery|before-after)\//);
  });

  it('never reintroduces a flat /end_of_tenancy/<file> path', () => {
    // The exact shape of the old layout: one segment after the folder.
    const flat = /^\/end_of_tenancy\/[^/]+$/;
    for (const src of EOT_PATHS) {
      expect(src, `${src} is a legacy flat path`).not.toMatch(flat);
    }
  });

  it('never reintroduces the old numbered slideshow filenames', () => {
    // EotGallery.tsx built these with Array.from({ length: 10 }).
    const legacy = Array.from({ length: 10 }, (_, i) => `/end_of_tenancy/${i + 1}.jpg`);
    for (const old of legacy) {
      expect(EOT_PATHS).not.toContain(old);
    }
  });

  it('resolves every path to a real, non-empty file', () => {
    for (const src of EOT_PATHS) {
      const file = path.join(PUBLIC_DIR, decodeURIComponent(src));
      expect(existsSync(file), `${src} is missing from public/`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1024);
    }
  });
});

describe('the public folder itself keeps the new layout', () => {
  it('holds no loose image files directly under end_of_tenancy/', () => {
    // A stray file here is the signal that someone restored the old layout.
    const loose = readdirSync(EOT_DIR, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
    expect(loose).toEqual([]);
  });

  it('keeps 6 before/after files and 13 gallery files on disk', () => {
    expect(readdirSync(path.join(EOT_DIR, 'before-after'))).toHaveLength(6);
    expect(readdirSync(path.join(EOT_DIR, 'gallery'))).toHaveLength(13);
  });
});

describe('the legacy EotGallery component stays deleted', () => {
  it('is absent from the source tree', () => {
    // It hard-coded the flat paths and was never imported anywhere. Restoring
    // it would reintroduce 16 broken image URLs the moment it was rendered.
    expect(existsSync(path.resolve(__dirname, '../components/EotGallery.tsx'))).toBe(false);
  });
});

describe('the routed gallery reads the same manifest', () => {
  it('exposes the End of Tenancy category from GALLERY_MEDIA', () => {
    const eot = GALLERY_MEDIA['end-of-tenancy'];
    expect(eot.filter((i) => i.type === 'before-after')).toHaveLength(3);
    expect(eot.filter((i) => i.type === 'photo')).toHaveLength(13);

    // Same strings, one source — the landing page and /gallery cannot drift.
    const fromCategory = eot.flatMap((i) => (
      i.type === 'before-after' ? [i.before, i.after] : i.type === 'photo' ? [i.src] : []
    ));
    expect(new Set(fromCategory)).toEqual(new Set(EOT_PATHS));
  });
});
