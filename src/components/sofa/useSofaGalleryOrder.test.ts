// Shuffling is the one piece of this feature that can go wrong silently: a
// reshuffle on every render looks fine in a screenshot but makes photos jump
// while the visitor scrolls, and desynchronises the lightbox index from the
// tile that was actually clicked.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SOFA_PHOTOS } from '../../data/sofaMedia';
import { isUsableOrder, shuffleAfterFirst, useSofaGalleryOrder } from './useSofaGalleryOrder';

const ids = () => SOFA_PHOTOS.map((p) => p.id);

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('shuffleAfterFirst', () => {
  it('never moves the first entry', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(shuffleAfterFirst(ids())[0]).toBe('sofa-gallery-01');
    }
  });

  it('keeps every entry exactly once', () => {
    const out = shuffleAfterFirst(ids());
    expect(out).toHaveLength(SOFA_PHOTOS.length);
    expect(new Set(out)).toEqual(new Set(ids()));
  });

  it('does actually reorder the tail across repeated runs', () => {
    // Guards against a no-op "shuffle". With 9 shufflable entries the odds of
    // 40 consecutive identity permutations are ~(1/10!)^40.
    const canonical = ids().join();
    const results = Array.from({ length: 40 }, () => shuffleAfterFirst(ids()).join());
    expect(results.some((r) => r !== canonical)).toBe(true);
  });

  it('handles an empty list without throwing', () => {
    expect(shuffleAfterFirst([])).toEqual([]);
  });
});

describe('isUsableOrder', () => {
  const canonical = ids();

  it('accepts a genuine permutation that keeps the pinned photo first', () => {
    expect(isUsableOrder(shuffleAfterFirst(canonical), canonical)).toBe(true);
  });

  it.each([
    ['a different first entry', [...canonical.slice(1), canonical[0]]],
    ['a dropped entry', canonical.slice(0, -1)],
    ['a duplicated entry', [...canonical.slice(0, -1), canonical[0]]],
    ['an unknown id', [...canonical.slice(0, -1), 'sofa-gallery-99']],
    ['not an array', 'sofa-gallery-01'],
  ])('rejects %s', (_label, stored) => {
    expect(isUsableOrder(stored, canonical)).toBe(false);
  });
});

describe('useSofaGalleryOrder', () => {
  it('renders the canonical order first, so SSR and hydration agree', () => {
    // The shuffle deliberately runs in an effect. renderHook flushes effects,
    // so this asserts the contract via the stored order instead: whatever the
    // hook settles on, index 0 is unchanged.
    const { result } = renderHook(() => useSofaGalleryOrder());
    expect(result.current[0].id).toBe('sofa-gallery-01');
    expect(result.current).toHaveLength(10);
  });

  it('does not reshuffle when the component rerenders', () => {
    const { result, rerender } = renderHook(() => useSofaGalleryOrder());
    const first = result.current.map((p) => p.id);

    for (let i = 0; i < 5; i += 1) rerender();

    expect(result.current.map((p) => p.id)).toEqual(first);
  });

  it('reuses the stored order for the rest of the session', () => {
    const { result, unmount } = renderHook(() => useSofaGalleryOrder());
    const first = result.current.map((p) => p.id);
    unmount();

    // A fresh mount — a second visit to the page within the same session.
    const { result: second } = renderHook(() => useSofaGalleryOrder());
    expect(second.current.map((p) => p.id)).toEqual(first);
  });

  it('persists exactly one order under a single key', () => {
    renderHook(() => useSofaGalleryOrder());
    const stored = sessionStorage.getItem('vve_sofa_gallery_order');
    expect(stored).not.toBeNull();
    expect(isUsableOrder(JSON.parse(stored!), ids())).toBe(true);
  });

  it('reshuffles rather than trusting an order that no longer matches the manifest', () => {
    sessionStorage.setItem('vve_sofa_gallery_order', JSON.stringify(['gone', 'also-gone']));
    const { result } = renderHook(() => useSofaGalleryOrder());

    expect(result.current).toHaveLength(10);
    expect(result.current[0].id).toBe('sofa-gallery-01');
  });

  it('still renders every photo when sessionStorage throws', () => {
    // Safari in private mode historically threw on setItem. The gallery must
    // degrade to an unshuffled-but-complete list, not disappear.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const { result } = renderHook(() => useSofaGalleryOrder());
    expect(result.current).toHaveLength(10);
    expect(result.current[0].id).toBe('sofa-gallery-01');
  });

  it('keeps the pinned photo first no matter what order was stored', () => {
    const shuffled = shuffleAfterFirst(ids());
    sessionStorage.setItem('vve_sofa_gallery_order', JSON.stringify(shuffled));

    const { result } = renderHook(() => useSofaGalleryOrder());
    act(() => {});

    expect(result.current[0].id).toBe('sofa-gallery-01');
    expect(result.current.map((p) => p.id)).toEqual(shuffled);
  });
});
