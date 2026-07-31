import { describe, it, expect } from 'vitest';
import {
  GALLERY_MEDIA,
  EOT_FEATURED_BEFORE_AFTER,
  EOT_ROTATING_PHOTOS,
} from './galleryMedia';

describe('galleryMedia manifest — End of Tenancy', () => {
  it('has exactly 3 approved before/after pairs, in the approved order', () => {
    expect(EOT_FEATURED_BEFORE_AFTER).toHaveLength(3);
    expect(EOT_FEATURED_BEFORE_AFTER.map((p) => p.label)).toEqual(['Kitchen hob', 'Oven', 'Shower']);
    for (const pair of EOT_FEATURED_BEFORE_AFTER) {
      expect(pair.before).toMatch(/^\/end_of_tenancy\/before-after\//);
      expect(pair.after).toMatch(/^\/end_of_tenancy\/before-after\//);
      expect(pair.beforeAlt.length).toBeGreaterThan(0);
      expect(pair.afterAlt.length).toBeGreaterThan(0);
    }
  });

  it('has exactly 10 rotating photos, in fixed numeric order (never shuffled)', () => {
    expect(EOT_ROTATING_PHOTOS).toHaveLength(10);
    expect(EOT_ROTATING_PHOTOS.map((p) => p.id)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    );
    for (const photo of EOT_ROTATING_PHOTOS) {
      expect(photo.src).toMatch(/^\/end_of_tenancy\/gallery\/\d+\.jpg$/);
      expect(photo.alt.length).toBeGreaterThan(0);
    }
  });

  it('lists exactly 16 End of Tenancy items on the full Gallery page (3 pairs + 13 photos)', () => {
    const eot = GALLERY_MEDIA['end-of-tenancy'];
    expect(eot).toHaveLength(16);
    expect(eot.filter((i) => i.type === 'before-after')).toHaveLength(3);
    expect(eot.filter((i) => i.type === 'photo')).toHaveLength(13);
  });

  it('includes the combined comparison photos 11-13 only on the full Gallery page, not in the rotating set', () => {
    const combinedIds = ['11', '12', '13'];
    const eotIds = GALLERY_MEDIA['end-of-tenancy'].map((i) => i.id);
    for (const id of combinedIds) expect(eotIds).toContain(id);

    const rotatingIds = EOT_ROTATING_PHOTOS.map((p) => p.id);
    for (const id of combinedIds) expect(rotatingIds).not.toContain(id);
  });

  it('describes photo 12 correctly — After on the left, Before on the right', () => {
    const photo12 = GALLERY_MEDIA['end-of-tenancy'].find((i) => i.id === '12');
    expect(photo12).toBeDefined();
    if (photo12?.type === 'photo') {
      expect(photo12.alt).toMatch(/after on the left/i);
      expect(photo12.alt).toMatch(/before on the right/i);
    }
  });

  it('has no duplicate ids in the End of Tenancy manifest', () => {
    const ids = GALLERY_MEDIA['end-of-tenancy'].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps Carpet and Sofa & Upholstery as empty, unapproved placeholders', () => {
    expect(GALLERY_MEDIA.carpet).toEqual([]);
    expect(GALLERY_MEDIA['sofa-upholstery']).toEqual([]);
  });
});
