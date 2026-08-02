import { describe, it, expect } from 'vitest';
import {
  GALLERY_MEDIA,
  EOT_FEATURED_BEFORE_AFTER,
  EOT_ROTATING_PHOTOS,
  CARPET_FEATURED_BEFORE_AFTER,
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

  it('loads up to 15 rotating photos in fixed natural filename order (never shuffled)', () => {
    expect(EOT_ROTATING_PHOTOS).toHaveLength(13);
    expect(EOT_ROTATING_PHOTOS.map((p) => p.id)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
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

  it('includes the combined comparison photos 11-13 in both gallery experiences', () => {
    const combinedIds = ['11', '12', '13'];
    const eotIds = GALLERY_MEDIA['end-of-tenancy'].map((i) => i.id);
    for (const id of combinedIds) expect(eotIds).toContain(id);

    const rotatingIds = EOT_ROTATING_PHOTOS.map((p) => p.id);
    for (const id of combinedIds) expect(rotatingIds).toContain(id);
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

  it('publishes exactly the three approved Carpet pairs and keeps Sofa & Upholstery empty', () => {
    // Carpet ships the owner's three approved before/after pairs — no more, no
    // fewer. Sofa & Upholstery still has no approved media, so it must stay
    // empty rather than show placeholders.
    expect(GALLERY_MEDIA.carpet).toHaveLength(3);
    expect(GALLERY_MEDIA.carpet.map((i) => i.id)).toEqual([
      'carpet-office',
      'carpet-blue',
      'carpet-brown',
    ]);
    expect(GALLERY_MEDIA['sofa-upholstery']).toEqual([]);
  });

  it('uses the owner-specified source mapping for every carpet pair', () => {
    // Pinned because the mapping cannot be derived from the filenames: the
    // office "before" original is spelt `carper1_before.heic` against a
    // `carpet1_after.png`, so sorting alphabetically would mis-pair the set.
    const byId = Object.fromEntries(
      CARPET_FEATURED_BEFORE_AFTER.map((p) => [p.id, p]),
    );
    expect(byId['carpet-office'].before).toBe('/carpet/before-after/web/carpet-office-before.jpg');
    expect(byId['carpet-office'].after).toBe('/carpet/before-after/web/carpet-office-after.jpg');
    expect(byId['carpet-blue'].before).toBe('/carpet/before-after/web/carpet-blue-before.jpg');
    expect(byId['carpet-blue'].after).toBe('/carpet/before-after/web/carpet-blue-after.jpg');
    expect(byId['carpet-brown'].before).toBe('/carpet/before-after/web/carpet-brown-before.jpg');
    expect(byId['carpet-brown'].after).toBe('/carpet/before-after/web/carpet-brown-after.jpg');
  });

  it('does not fall back to the unrelated /gallery carpet photos', () => {
    // These two were briefly used as a stand-in pair while the real sources
    // were undecodable. They are not part of the approved carpet set.
    const all = GALLERY_MEDIA.carpet
      .flatMap((i) => (i.type === 'before-after' ? [i.before, i.after] : []))
      .join(' ');
    expect(all).not.toContain('/gallery/carpet_cleaning_before_.jpg');
    expect(all).not.toContain('/gallery/carpet_cleaning_after.jpg');
  });

  it('gives every carpet image distinct, descriptive alt text', () => {
    const alts: string[] = [];
    for (const item of CARPET_FEATURED_BEFORE_AFTER) {
      alts.push(item.beforeAlt, item.afterAlt);
    }
    expect(new Set(alts).size).toBe(alts.length);
    alts.forEach((a) => expect(a.length).toBeGreaterThan(30));
  });

  it('never publishes a carpet source a browser cannot display', () => {
    for (const item of GALLERY_MEDIA.carpet) {
      const sources = item.type === 'before-after'
        ? [item.before, item.after]
        : item.type === 'photo'
          ? [item.src]
          : [item.src, item.poster];
      for (const src of sources) {
        expect(src).not.toMatch(/\.heic$/i);
        expect(src).not.toMatch(/\.mov$/i);
      }
    }
  });
});
