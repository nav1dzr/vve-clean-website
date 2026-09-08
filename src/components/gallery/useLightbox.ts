import { useCallback, useRef, useState } from 'react';
import type { GalleryItem } from '../../data/galleryMedia';

// State and manifest helpers for the shared photo lightbox. Kept out of
// PhotoLightbox.tsx so that file exports a component and nothing else.

export interface LightboxPhoto {
  src: string;
  alt: string;
  /** Shown under the image, e.g. "Kitchen hob — Before". */
  caption?: string;
}

/**
 * Flattens a gallery manifest into the lightbox's photo list.
 * Before/after pairs contribute both sides, in reading order, so Previous/Next
 * walks the gallery exactly as it appears on the page. Videos are skipped —
 * they have their own inline controls.
 */
export function toLightboxPhotos(items: GalleryItem[]): LightboxPhoto[] {
  return items.flatMap((item) => {
    if (item.type === 'before-after') {
      // Captions follow the tile's own side labels, so a pair shot mid-job
      // reads "— during extraction" in the overlay too rather than silently
      // reverting to "after" once enlarged.
      const before = (item.beforeLabel ?? 'Before').toLowerCase();
      const after = (item.afterLabel ?? 'After').toLowerCase();
      return [
        { src: item.before, alt: item.beforeAlt, caption: `${item.label} — ${before}` },
        { src: item.after, alt: item.afterAlt, caption: `${item.label} — ${after}` },
      ];
    }
    if (item.type === 'photo') {
      return [{ src: item.fullSrc || item.src, alt: item.alt, caption: item.label }];
    }
    return [];
  });
}

/**
 * Open/close state plus focus restoration. The element that opened the
 * lightbox is remembered so focus can be handed straight back to it on close,
 * rather than dumping the visitor at the top of the document.
 */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const open = useCallback((i: number, origin?: HTMLElement | null) => {
    originRef.current = origin ?? (document.activeElement as HTMLElement | null);
    setIndex(i);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    // Deferred a frame so the overlay has been removed before focus moves —
    // otherwise the browser can scroll the page to the still-mounted overlay.
    requestAnimationFrame(() => originRef.current?.focus());
  }, []);

  return { index, isOpen: index !== null, open, close, setIndex };
}
