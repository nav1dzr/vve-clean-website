// The carpet video manifest is the only place a .MOV original could leak into
// the site, so these tests pin the shape of what is published rather than the
// prose around it.

import { describe, it, expect } from 'vitest';
import { CARPET_RESULT_VIDEOS, CARPET_PROCESS_VIDEO, type CarpetVideo } from './carpetMedia';
import { CARPET_FEATURED_BEFORE_AFTER } from './galleryMedia';

const ALL: CarpetVideo[] = [
  ...CARPET_RESULT_VIDEOS,
  ...(CARPET_PROCESS_VIDEO ? [CARPET_PROCESS_VIDEO] : []),
];

describe('carpetMedia manifest', () => {
  it('publishes all four converted clips', () => {
    expect(CARPET_RESULT_VIDEOS).toHaveLength(3);
    expect(CARPET_PROCESS_VIDEO).not.toBeNull();
    expect(ALL).toHaveLength(4);
    expect(ALL.map((v) => v.src)).toEqual([
      '/carpet/video/web/carpet-1.mp4',
      '/carpet/video/web/carpet-2.mp4',
      '/carpet/video/web/carpet-3.mp4',
      '/carpet/video/web/carpet-4.mp4',
    ]);
  });

  it('never references a QuickTime original', () => {
    // The four sources are .MOV/.mov, which Chrome and Firefox will not play.
    for (const v of ALL) {
      expect(v.src).toMatch(/\.mp4$/);
      expect(v.src).not.toMatch(/\.mov$/i);
      expect(v.webm ?? '').not.toMatch(/\.mov$/i);
      expect(v.poster).not.toMatch(/\.(mov|heic)$/i);
    }
  });

  it('gives every clip a poster frame and a description', () => {
    // Without a poster the lazy player shows a black box until playback starts;
    // without a description the clip is silent to a screen reader.
    for (const v of ALL) {
      expect(v.poster).toMatch(/^\/carpet\/video\/web\/.+\.jpg$/);
      expect(v.description.length).toBeGreaterThan(30);
      expect(v.label.length).toBeGreaterThan(0);
    }
    expect(new Set(ALL.map((v) => v.id)).size).toBe(ALL.length);
  });

  it('pairs each result clip with a real before/after card, one each', () => {
    const pairIds = CARPET_FEATURED_BEFORE_AFTER.map((p) => p.id);
    const paired = CARPET_RESULT_VIDEOS.map((v) => v.pairedWith);

    expect(paired).toEqual(pairIds);
    expect(new Set(paired).size).toBe(paired.length);
  });

  it('keeps the wide process clip out of the paired set', () => {
    // It is the one landscape source; pairing it would put a 16:9 clip on a
    // portrait stage next to two portrait ones.
    expect(CARPET_PROCESS_VIDEO?.pairedWith).toBeUndefined();
    expect(CARPET_RESULT_VIDEOS.map((v) => v.src)).not.toContain(CARPET_PROCESS_VIDEO?.src);
  });
});
