import { useEffect, useMemo, useState } from 'react';
import type { GalleryCategory, GalleryItem } from '../data/galleryMedia';
import { managedImageSizes, mediaImageSrcSet, mediaImageUrl } from './responsiveMediaImage';

type PublishedReference = {
  reference_key: string; page_key: string; page_label: string; component_label: string; sort_order: number;
  source_type: 'gallery' | 'website'; topic_key: string | null; slot_code: string; slot_kind: 'before_after' | 'video' | 'photo' | 'website';
  media_role: 'before' | 'after' | 'primary'; media_type: 'image' | 'video'; title: string; alt_text: string;
  delivery_url: string | null; mux_playback_id: string | null;
};

const empty = (): Record<GalleryCategory, GalleryItem[]> => ({ 'end-of-tenancy': [], carpet: [], 'sofa-upholstery': [] });

// Public pages only read resolved, published media references. This response
// deliberately contains no R2 key, original filename, upload metadata, or
// private library asset. A Gallery position can therefore be reused by any
// number of page references without duplicating its file.
function usePublishedReferences() {
  const [references, setReferences] = useState<PublishedReference[]>([]);
  useEffect(() => {
    let live = true;
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return () => { live = false; };
    void (async () => {
      try {
        const { supabase } = await import('./supabase');
        const { data, error } = await supabase.rpc('public_media_preview_references');
        if (!live || error || !Array.isArray(data)) return;
        setReferences(data as PublishedReference[]);
      } catch {
        // Existing curated local images stay visible if Preview media is not configured.
      }
    })();
    return () => { live = false; };
  }, []);
  return references;
}

function referenceToItem(rows: PublishedReference[]): GalleryItem | null {
  const first = rows[0];
  if (!first) return null;
  const label = first.title || first.component_label || first.slot_code;
  if (first.slot_kind === 'before_after') {
    const before = rows.find((row) => row.media_role === 'before');
    const after = rows.find((row) => row.media_role === 'after');
    if (!before?.delivery_url || !after?.delivery_url) return null;
    return {
      type: 'before-after', id: `managed-${first.reference_key}`, label,
      before: mediaImageUrl(before.delivery_url, 1200), after: mediaImageUrl(after.delivery_url, 1200),
      beforeAlt: before.alt_text || `${label} before cleaning`, afterAlt: after.alt_text || `${label} after cleaning`,
    };
  }
  const row = rows.find((entry) => entry.media_role === 'primary') || first;
  if (row.media_type === 'image' && row.delivery_url) return {
    type: 'photo', id: `managed-${row.reference_key}`, label, alt: row.alt_text || label,
    src: mediaImageUrl(row.delivery_url, 1200), srcSet: mediaImageSrcSet(row.delivery_url), sizes: managedImageSizes,
    fullSrc: mediaImageUrl(row.delivery_url, 2400),
  };
  if (row.media_type === 'video' && row.mux_playback_id) return {
    type: 'video', id: `managed-${row.reference_key}`, label,
    src: `https://stream.mux.com/${row.mux_playback_id}.m3u8`,
    poster: `https://image.mux.com/${row.mux_playback_id}/thumbnail.jpg?time=1&width=960&fit_mode=preserve`,
    playerUrl: `https://player.mux.com/${row.mux_playback_id}`,
    description: row.alt_text || label,
  };
  return null;
}

function toItems(references: PublishedReference[], pageKey: string) {
  const groups = new Map<string, PublishedReference[]>();
  for (const reference of references.filter((item) => item.page_key === pageKey)) {
    groups.set(reference.reference_key, [...(groups.get(reference.reference_key) || []), reference]);
  }
  return [...groups.values()].map(referenceToItem).filter((item): item is GalleryItem => item !== null);
}

export function useManagedPageMedia(pageKey: string) {
  const references = usePublishedReferences();
  return useMemo(() => toItems(references, pageKey), [references, pageKey]);
}

export function useManagedWebsiteMedia(slotKey: string) {
  const items = useManagedPageMedia(slotKey);
  return items[0] || null;
}

export function useManagedGalleryMedia() {
  const references = usePublishedReferences();
  return useMemo(() => {
    const grouped = empty();
    grouped.carpet = toItems(references, 'gallery-carpet');
    grouped['sofa-upholstery'] = toItems(references, 'gallery-sofa');
    grouped['end-of-tenancy'] = toItems(references, 'gallery-end-of-tenancy');
    return grouped;
  }, [references]);
}
