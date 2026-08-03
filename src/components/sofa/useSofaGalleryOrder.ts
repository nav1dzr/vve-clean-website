import { useEffect, useMemo, useState } from 'react';
import { SOFA_PHOTOS, type SofaPhoto } from '../../data/sofaMedia';

// Stable per-session ordering for the supporting sofa gallery.
//
// Three constraints pull against each other here:
//
//  1. The owner's favourite (sofa-gallery-01) must ALWAYS be first. Only the
//     photos after it are shuffled.
//  2. The order must not change between rerenders — a fresh Math.random() on
//     every render would make photos jump around while the visitor scrolls, and
//     would desynchronise the lightbox index from what is on screen.
//  3. It must not run during SSR/first render. prerender.mjs bakes this markup
//     into dist/, so a shuffle in a useState initialiser would produce one order
//     in the HTML and a different one on the client's first pass — a hydration
//     mismatch. The shuffle is therefore applied in an effect, on the pass
//     *after* mount, so the server HTML and the first client render agree.
//
// The chosen order is kept in sessionStorage, so it also survives navigating
// away and back within the same visit rather than reshuffling each time.

const ORDER_KEY = 'vve_sofa_gallery_order';

/** Fisher-Yates across everything after the pinned first entry. */
export function shuffleAfterFirst(ids: string[]): string[] {
  if (ids.length === 0) return [];
  const rest = ids.slice(1);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [ids[0], ...rest];
}

/** True only for an order that is still a permutation of the current manifest. */
export function isUsableOrder(stored: unknown, canonical: string[]): stored is string[] {
  return (
    Array.isArray(stored)
    && stored.length === canonical.length
    && stored[0] === canonical[0]
    && stored.every((id) => typeof id === 'string' && canonical.includes(id))
    && new Set(stored).size === canonical.length
  );
}

function readOrCreateOrder(canonical: string[]): string[] {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY);
    if (raw && isUsableOrder(JSON.parse(raw), canonical)) return JSON.parse(raw) as string[];
  } catch {
    // Storage unavailable or corrupt JSON — fall through and shuffle fresh.
  }

  const fresh = shuffleAfterFirst(canonical);
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(fresh));
  } catch {
    // Private mode with storage disabled: the order simply won't persist.
  }
  return fresh;
}

export function useSofaGalleryOrder(photos: SofaPhoto[] = SOFA_PHOTOS): SofaPhoto[] {
  const canonical = useMemo(() => photos.map((p) => p.id), [photos]);
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    setOrder(readOrCreateOrder(canonical));
  }, [canonical]);

  return useMemo(() => {
    // Before the effect runs — i.e. during SSR and the hydrating render — this
    // is the canonical manifest order, exactly as prerendered.
    if (!order) return photos;
    const byId = new Map(photos.map((p) => [p.id, p]));
    return order
      .map((id) => byId.get(id))
      .filter((p): p is SofaPhoto => Boolean(p));
  }, [photos, order]);
}
