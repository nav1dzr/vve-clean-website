import { useMemo } from 'react';
import { WEBSITE_MEDIA_RUNTIME } from '../../shared/websiteMediaRuntime.js';
import type { GalleryItem } from '../data/galleryMedia';
import { referenceToItem, usePublishedReferences, type PublishedReference } from './managedGalleryMedia';

export function findBuiltInMediaPosition(item: GalleryItem) {
  return WEBSITE_MEDIA_RUNTIME.find(position => {
    if (!position.key.startsWith('builtin-') && !position.key.startsWith('homepage-proof-')) return false;
    const original = position.defaultMedia;
    if (!original || original.type !== item.type) return false;
    return original.type === 'before-after' && item.type === 'before-after'
      ? original.before === item.before && original.after === item.after
      : 'src' in original && 'src' in item && original.src === item.src;
  });
}

export function resolveWebsiteMediaPosition<T extends GalleryItem>(key: string, fallback: T | null, references: PublishedReference[]): T | null {
  const matching = references.filter(row => row.page_key === key).sort((a, b) => a.sort_order - b.sort_order || a.reference_key.localeCompare(b.reference_key));
  const rows = matching.filter(row => row.reference_key === matching[0]?.reference_key);
  const replacement = referenceToItem(rows);
  const position = WEBSITE_MEDIA_RUNTIME.find(candidate => candidate.key === key);
  const expectedType = position?.kind === 'before_after' ? 'before-after' : position?.kind;
  // A wrong kind or incomplete comparison is never promoted into the place
  // of a still photo, video or matched pair.
  if (!replacement || replacement.type !== (fallback?.type ?? expectedType)) return fallback;
  return {
    ...fallback, ...replacement, id: fallback?.id ?? replacement.id,
    // A replacement cannot inherit the old job's geographic claim, alternative
    // video source, or a special "during" label from unrelated evidence.
    location: undefined, webm: undefined, beforeLabel: undefined, afterLabel: undefined,
  } as unknown as T;
}

export function useWebsiteMediaPosition<T extends GalleryItem>(key: string, fallback: T | null): T | null {
  const references = usePublishedReferences();
  return useMemo(() => resolveWebsiteMediaPosition(key, fallback, references), [key, fallback, references]);
}

export function useResolvedWebsiteMedia<T extends GalleryItem>(items: readonly T[]): T[] {
  const references = usePublishedReferences();
  return useMemo(() => items.map(item => {
    const position = findBuiltInMediaPosition(item);
    return position ? resolveWebsiteMediaPosition(position.key, item, references) ?? item : item;
  }), [items, references]);
}
