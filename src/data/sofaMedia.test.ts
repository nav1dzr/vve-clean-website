// The Sofa & Upholstery manifest is the one place a wrong path or a miscounted
// set would reach every surface at once — the landing page, the routed Gallery
// page and the lightbox all read from it. These assertions pin the things that
// cannot be re-derived by looking at the files: the owner's explicit pairings,
// the pinned favourite, and the rule that no iPhone-native path may ship.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SOFA_BEFORE_AFTER,
  SOFA_FEATURE_VIDEO,
  SOFA_MEDIA,
  SOFA_PHOTOS,
  SOFA_SUPPORTING_VIDEOS,
  SOFA_VIDEOS,
} from './sofaMedia';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const onDisk = (webPath: string) => path.join(PUBLIC_DIR, webPath);

describe('the approved set is exactly what the owner supplied', () => {
  it('has four before/after sets', () => {
    expect(SOFA_BEFORE_AFTER).toHaveLength(4);
  });

  it('has ten supporting photos', () => {
    // Ten, not eleven: the owner supplied a white leather corner sofa, but this
    // page's FAQ states leather cleaning is not currently offered, so publishing
    // it would contradict the service scope. It is excluded on purpose.
    expect(SOFA_PHOTOS).toHaveLength(10);
  });

  it('publishes no leather sofa, which the page says it does not clean', () => {
    expect(SOFA_PHOTOS.map((p) => p.id)).not.toContain('sofa-gallery-11');
    for (const photo of SOFA_PHOTOS) {
      expect(photo.alt.toLowerCase()).not.toContain('leather');
      expect(photo.label.toLowerCase()).not.toContain('leather');
    }
  });

  it('has four videos — one featured, three supporting', () => {
    expect(SOFA_VIDEOS).toHaveLength(4);
    expect(SOFA_SUPPORTING_VIDEOS).toHaveLength(3);
    expect(SOFA_FEATURE_VIDEO.id).toBe('sofa-extraction-feature');
  });

  it('gives every entry a stable, unique id', () => {
    const ids = SOFA_MEDIA.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the owner’s explicit before/after pairings survive', () => {
  // Pinned because the mapping cannot be derived from the filenames: three of
  // the four "before" originals are .heic while their partners are .jpg, .heic
  // and .png respectively, so sorting alphabetically would mis-pair the set.
  it.each([
    ['sofa-ba-seat', 'sofa-1-before.webp', 'sofa-1-after.webp'],
    ['sofa-ba-corner', 'sofa-2-before.webp', 'sofa-2-after.webp'],
    ['sofa-ba-seat-pad', 'chair-2-before.webp', 'chair-2-after.webp'],
    ['sofa-ba-buttoned-chair', 'chair-1-before.webp', 'chair-1-after.webp'],
  ])('%s pairs %s with %s', (id, before, after) => {
    const pair = SOFA_BEFORE_AFTER.find((p) => p.id === id);
    expect(pair).toBeDefined();
    expect(pair!.before).toBe(`/sofa_upholstery/web/before-after/${before}`);
    expect(pair!.after).toBe(`/sofa_upholstery/web/before-after/${after}`);
  });

  it('never pairs a photo with itself', () => {
    for (const pair of SOFA_BEFORE_AFTER) {
      expect(pair.before).not.toBe(pair.after);
    }
  });
});

describe('the owner’s favourite is pinned first', () => {
  it('is sofa-gallery-01, at index 0 of the canonical manifest', () => {
    expect(SOFA_PHOTOS[0].id).toBe('sofa-gallery-01');
    expect(SOFA_PHOTOS[0].src).toBe('/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
  });
});

describe('the chair pair is labelled for what it actually shows', () => {
  // The second photograph was taken mid-job — the hand tool is still on the
  // fabric and it is visibly wet. Presenting it as "After" would claim a
  // finished, dried result the photograph does not show.
  const chair = SOFA_BEFORE_AFTER.find((p) => p.id === 'sofa-ba-buttoned-chair')!;

  it('is titled as work in progress', () => {
    expect(chair.label).toBe('Dining chair cleaning in progress');
  });

  it('labels its two sides "Before cleaning" and "During extraction"', () => {
    expect(chair.beforeLabel).toBe('Before cleaning');
    expect(chair.afterLabel).toBe('During extraction');
  });

  it('never claims the result is finished or dry', () => {
    expect(chair.afterAlt).toMatch(/part-way through|during/i);
    expect(chair.afterAlt).not.toMatch(/\bafter cleaning\b/i);
    expect(chair.afterAlt.toLowerCase()).toContain('not yet dry');
  });

  it('leaves the other three pairs on the default Before/After', () => {
    for (const pair of SOFA_BEFORE_AFTER.filter((p) => p.id !== 'sofa-ba-buttoned-chair')) {
      expect(pair.beforeLabel).toBeUndefined();
      expect(pair.afterLabel).toBeUndefined();
    }
  });
});

describe('nothing iPhone-native can reach rendered HTML', () => {
  // .heic does not decode in Chrome or Firefox at all, and a .MOV in a <video>
  // is a black box for most visitors. Both must stop at the conversion step.
  const everyPath = [
    ...SOFA_BEFORE_AFTER.flatMap((p) => [p.before, p.after]),
    ...SOFA_PHOTOS.map((p) => p.src),
    ...SOFA_VIDEOS.flatMap((v) => [v.src, v.poster]),
  ];

  it.each(everyPath)('%s is a web-safe format', (p) => {
    expect(p).not.toMatch(/\.heic$/i);
    expect(p).not.toMatch(/\.mov$/i);
    expect(p).toMatch(/\.(webp|jpg|mp4)$/);
  });

  it('uses lowercase, normalized paths throughout', () => {
    for (const p of everyPath) expect(p).toBe(p.toLowerCase());
  });

  it('serves everything from the web/ derivative folder', () => {
    for (const p of everyPath) expect(p.startsWith('/sofa_upholstery/web/')).toBe(true);
  });
});

describe('the referenced files actually exist and are non-empty', () => {
  // A manifest that points at a missing file still typechecks, still renders,
  // and still passes every DOM assertion — it just shows a broken image to the
  // customer. This is the only check that catches it.
  const everyPath = [
    ...SOFA_BEFORE_AFTER.flatMap((p) => [p.before, p.after]),
    ...SOFA_PHOTOS.map((p) => p.src),
    ...SOFA_VIDEOS.flatMap((v) => [v.src, v.poster]),
  ];

  it.each(everyPath)('%s is present in public/', (p) => {
    const file = onDisk(p);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1024);
  });
});

describe('every entry carries the metadata the page needs', () => {
  it('gives each video a poster and a description', () => {
    for (const video of SOFA_VIDEOS) {
      expect(video.poster).toMatch(/-poster\.jpg$/);
      expect(video.description.length).toBeGreaterThan(20);
      expect(video.label.length).toBeGreaterThan(0);
    }
  });

  it('gives each photo intrinsic dimensions, so a tile reserves its box', () => {
    for (const photo of SOFA_PHOTOS) {
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
    }
  });

  it('gives each before/after half its own alt text, never a shared string', () => {
    for (const pair of SOFA_BEFORE_AFTER) {
      expect(pair.beforeAlt).not.toBe(pair.afterAlt);
      expect(pair.beforeAlt.length).toBeGreaterThan(30);
      expect(pair.afterAlt.length).toBeGreaterThan(30);
    }
  });

  it('describes each photo rather than repeating its label', () => {
    for (const photo of SOFA_PHOTOS) {
      expect(photo.alt).not.toBe(photo.label);
      expect(photo.alt.length).toBeGreaterThan(30);
    }
  });
});
