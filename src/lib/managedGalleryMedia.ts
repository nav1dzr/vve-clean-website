import { useEffect, useMemo, useState } from 'react';
import type { GalleryCategory, GalleryItem } from '../data/galleryMedia';

type PublishedSlot = {
  slot_key: string;
  media_type: 'image' | 'video';
  title: string;
  alt_text: string;
  category: GalleryCategory;
  before_after: 'before' | 'after' | 'none';
  delivery_url: string | null;
  mux_playback_id: string | null;
};

const empty = (): Record<GalleryCategory, GalleryItem[]> => ({ 'end-of-tenancy': [], carpet: [], 'sofa-upholstery': [] });

// Public gallery reads only the published-delivery RPC. It never receives an
// R2 key, original filename, upload metadata, or any admin-only flags.
export function useManagedGalleryMedia() {
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
        const { data, error } = await supabase.rpc('public_media_slots');
        if (!live || error || !Array.isArray(data)) return;
        setSlots(data as PublishedSlot[]);
      } catch {
        // The gallery retains its existing local media if Supabase is temporarily unavailable.
      }
    })();
    return () => { live = false; };
  }, []);

  return useMemo(() => {
    const grouped = empty();
    for (const slot of slots) {
      if (!Object.prototype.hasOwnProperty.call(grouped, slot.category)) continue;
      const label = slot.title || `${slot.before_after === 'none' ? 'Cleaning' : slot.before_after} result`;
      const alt = slot.alt_text || label;
      if (slot.media_type === 'image' && slot.delivery_url) {
        grouped[slot.category].push({ type: 'photo', id: `managed-${slot.slot_key}`, label, src: slot.delivery_url, alt });
      }
      if (slot.media_type === 'video' && slot.mux_playback_id) {
        grouped[slot.category].push({
          type: 'video', id: `managed-${slot.slot_key}`, label,
          src: `https://stream.mux.com/${slot.mux_playback_id}.m3u8`,
          poster: `https://image.mux.com/${slot.mux_playback_id}/thumbnail.jpg?time=1&width=960&fit_mode=preserve`,
          playerUrl: `https://player.mux.com/${slot.mux_playback_id}`,
          description: alt,
        });
      }
    }
    return grouped;
  }, [slots]);
}
