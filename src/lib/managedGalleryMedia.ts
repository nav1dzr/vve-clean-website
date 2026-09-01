import { useEffect, useMemo, useState } from 'react';
import type { GalleryCategory, GalleryItem } from '../data/galleryMedia';
import { managedImageSizes, mediaImageSrcSet, mediaImageUrl } from './responsiveMediaImage';

type PublishedSlot = {
  slot_key: string;
  placement: string;
  media_type: 'image' | 'video';
  title: string;
  alt_text: string;
  category: GalleryCategory;
  before_after: 'before' | 'after' | 'none';
  delivery_url: string | null;
  mux_playback_id: string | null;
};

const empty = (): Record<GalleryCategory, GalleryItem[]> => ({ 'end-of-tenancy': [], carpet: [], 'sofa-upholstery': [] });

// Public pages read only the published-delivery RPC. They never receive an R2
// key, original filename, upload metadata, or any admin-only flags.
function usePublishedSlots() {
  const [slots, setSlots] = useState<PublishedSlot[]>([]);

  useEffect(() => {
    let live = true;
    // The site is prerendered without browser environment variables. Defer
    // creation of the Supabase client until a real browser has the public
    // VITE_ values, keeping static rendering independent of this optional
    // runtime gallery enhancement.
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return () => { live = false; };
    void (async () => {
      try {
        const { supabase } = await import('./supabase');
        const { data, error } = await supabase.rpc('public_media_preview_slots');
        if (!live || error || !Array.isArray(data)) return;
        setSlots(data as PublishedSlot[]);
      } catch {
        // The gallery retains its existing local media if Supabase is temporarily unavailable.
      }
    })();
    return () => { live = false; };
  }, []);

  return slots;
}

function slotToItem(slot: PublishedSlot): GalleryItem | null {
  const label = slot.title || `${slot.before_after === 'none' ? 'Cleaning' : slot.before_after} result`;
  const alt = slot.alt_text || label;
  if (slot.media_type === 'image' && slot.delivery_url) {
    return {
      type: 'photo', id: `managed-${slot.slot_key}`, label, alt,
      src: mediaImageUrl(slot.delivery_url, 1200),
      srcSet: mediaImageSrcSet(slot.delivery_url),
      sizes: managedImageSizes,
      fullSrc: mediaImageUrl(slot.delivery_url, 2400),
    };
  }
  if (slot.media_type === 'video' && slot.mux_playback_id) {
    return {
      type: 'video', id: `managed-${slot.slot_key}`, label,
      src: `https://stream.mux.com/${slot.mux_playback_id}.m3u8`,
      poster: `https://image.mux.com/${slot.mux_playback_id}/thumbnail.jpg?time=1&width=960&fit_mode=preserve`,
      playerUrl: `https://player.mux.com/${slot.mux_playback_id}`,
      description: alt,
    };
  }
  return null;
}

export function useManagedGalleryMedia() {
  const slots = usePublishedSlots();
  return useMemo(() => {
    const grouped = empty();
    for (const slot of slots) {
      if (!slot.placement?.startsWith('gallery-')) continue;
      if (!Object.prototype.hasOwnProperty.call(grouped, slot.category)) continue;
      const item = slotToItem(slot);
      if (item) grouped[slot.category].push(item);
    }
    return grouped;
  }, [slots]);
}

export function useManagedPlacementMedia(placement: string) {
  const slots = usePublishedSlots();
  return useMemo(() => slots.filter((slot) => slot.placement === placement).map(slotToItem).filter((item): item is GalleryItem => item !== null), [slots, placement]);
}
