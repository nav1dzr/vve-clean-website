import { describe, expect, it } from 'vitest';
import { WEBSITE_MEDIA_POSITIONS } from '../../admin/shared/mediaWebsitePositions.js';
import { WEBSITE_MEDIA_RUNTIME } from '../../shared/websiteMediaRuntime.js';
import { createWebsiteMediaPositions } from '../data/websiteMediaPositionSource';
import { GALLERY_MEDIA, type GalleryItem } from '../data/galleryMedia';
import { findBuiltInMediaPosition, resolveWebsiteMediaPosition } from './websiteMediaPositions';
import type { PublishedReference } from './managedGalleryMedia';

function reference(key: string, kind: 'photo' | 'video' | 'before_after', role: 'primary' | 'before' | 'after' = 'primary'): PublishedReference {
  return { reference_key: `registered-${key}`, page_key: key, page_label: 'Test page', component_label: 'Test position', sort_order: 1,
    source_type: kind === 'before_after' ? 'gallery' : 'website', topic_key: null, slot_code: key, slot_kind: kind === 'before_after' ? kind : 'website', media_role: role,
    media_type: kind === 'video' ? 'video' : 'image', title: 'Replacement caption', alt_text: `Replacement ${role}`,
    delivery_url: kind === 'video' ? null : `https://media.example/new-${role}.jpg`, mux_playback_id: kind === 'video' ? 'approved-video' : null };
}

describe('complete website media contract', () => {
  it('keeps the generated CRM catalogue and lean public lookup in sync with the real source manifests', () => {
    expect(WEBSITE_MEDIA_POSITIONS).toEqual(createWebsiteMediaPositions());
    expect(WEBSITE_MEDIA_RUNTIME.map(({ key, kind }) => ({ key, kind }))).toEqual(WEBSITE_MEDIA_POSITIONS.map(({ key, kind }) => ({ key, kind })));
    expect(new Set(WEBSITE_MEDIA_POSITIONS.map(position => position.key)).size).toBe(WEBSITE_MEDIA_POSITIONS.length);
  });

  it('registers every original gallery photo, complete pair and video exactly once', () => {
    for (const [category, items] of Object.entries(GALLERY_MEDIA)) for (const item of items) {
      const position = findBuiltInMediaPosition(item);
      expect(position?.key, `${category}/${item.id}`).toBe(`builtin-${category}-${item.id}`);
      const full = WEBSITE_MEDIA_POSITIONS.find(candidate => candidate.key === position?.key)!;
      expect(full.defaultMedia).toEqual(item);
      expect(full.pages.some(page => page.path.startsWith(`/gallery?category=${category}`))).toBe(true);
      expect(full.targetType).toBe(item.type === 'before-after' ? 'gallery' : 'website');
    }
  });

  it('keeps named placements independent when their original photo is reused', () => {
    const sameSource = WEBSITE_MEDIA_POSITIONS.filter(position => position.defaultMedia?.type === 'photo' && position.defaultMedia.src === '/images/carpet-cleaning-hero.webp');
    expect(sameSource.map(position => position.key)).toEqual(expect.arrayContaining(['service-carpet-hero', 'homepage-service-carpet', 'homepage-hero-image']));
    expect(new Set(sameSource.map(position => position.slotKey)).size).toBe(sameSource.length);
  });

  it('uses real service-page subsets and the correct video section anchors', () => {
    const feature = WEBSITE_MEDIA_POSITIONS.find(position => position.key === 'builtin-sofa-upholstery-sofa-extraction-feature')!;
    expect(feature.pages).toContainEqual({ path: '/sofa-cleaning-london#extraction', label: 'Sofa & upholstery', section: 'Cleaning videos' });
    expect(feature.pages).toContainEqual({ path: '/how-we-clean-sofas-upholstery#extraction', label: 'How we clean sofas', section: 'Cleaning videos' });
    const office = WEBSITE_MEDIA_POSITIONS.find(position => position.key === 'builtin-carpet-carpet-office')!;
    expect(office.pages.some(page => page.path === '/commercial-carpet-cleaning-london#main-content')).toBe(true);
    expect(office.pages.some(page => page.path === '/carpet-cleaning-london#results')).toBe(true);
    expect(office.pages.some(page => page.path === '/how-we-clean-carpets#results')).toBe(true);
    const process = WEBSITE_MEDIA_POSITIONS.filter(position => position.pages.some(page => page.path === '/carpet-cleaning-london#process'));
    expect(process).toHaveLength(1);
    expect(process[0].pages.some(page => page.path === '/how-we-clean-carpets#process')).toBe(true);
  });

  it.each(WEBSITE_MEDIA_POSITIONS.map(position => [position.key, position] as const))('resolves and clears registered position %s without changing the built-in default', (_key, position) => {
    const rows = position.kind === 'before_after' ? [reference(position.key, position.kind, 'before'), reference(position.key, position.kind, 'after')] : [reference(position.key, position.kind)];
    const result = resolveWebsiteMediaPosition(position.key, position.defaultMedia, rows);
    expect(result?.label).toBe('Replacement caption');
    expect(result?.type).toBe(position.kind === 'before_after' ? 'before-after' : position.kind);
    expect(resolveWebsiteMediaPosition(position.key, position.defaultMedia, [])).toBe(position.defaultMedia);
  });

  it('rejects the wrong media type and incomplete pairs, and removes inherited location and alternate video claims', () => {
    const pair = GALLERY_MEDIA.carpet.find(item => item.type === 'before-after')!;
    const key = findBuiltInMediaPosition(pair)!.key;
    expect(resolveWebsiteMediaPosition(key, pair, [reference(key, 'before_after', 'before')])).toBe(pair);
    expect(resolveWebsiteMediaPosition(key, pair, [reference(key, 'video')])).toBe(pair);
    const original: GalleryItem & { webm: string } = { type: 'video', id: 'clip', label: 'Old', src: '/old.mp4', poster: '/old.jpg', location: 'Hackney', webm: '/old.webm' };
    const clipKey = WEBSITE_MEDIA_POSITIONS.find(position => position.kind === 'video')!.key;
    const clip = resolveWebsiteMediaPosition(clipKey, original, [reference(clipKey, 'video')]);
    expect(clip).toMatchObject({ playerUrl: 'https://player.mux.com/approved-video', location: undefined, webm: undefined });
  });

  it('keeps the empty builders sections hidden without an explicit complete publication', () => {
    for (const key of ['after-builders-hero', 'after-builders-comparison', 'homepage-service-after-builders']) {
      const position = WEBSITE_MEDIA_POSITIONS.find(candidate => candidate.key === key)!;
      expect(position.defaultMedia).toBeNull();
      expect(resolveWebsiteMediaPosition(key, null, [])).toBeNull();
    }
  });
});
