import { useCallback, useEffect, useRef, useState } from 'react';

type PlaybackState = { load: boolean; play: boolean; manual: boolean };
type Entry = {
  element: HTMLElement;
  visible: boolean;
  near: boolean;
  auto: boolean;
  paused: boolean;
  manual: boolean;
  state: PlaybackState;
  update: (state: PlaybackState) => void;
};
const IDLE: PlaybackState = { load: false, play: false, manual: false };
const entries = new Set<Entry>();
let current: Entry | undefined;
const suspensions = new Set<symbol>();

// One page-wide playback slot prevents native clips and hosted players competing.
// The next nearby native clip may attach its source but cannot autoplay.
// The browser receives a preload="none" hint to limit data.
// No video sources or hosted players stay mounted in a hidden tab.
function reconcile() {
  const foreground = document.visibilityState !== 'hidden' && suspensions.size === 0;
  // Hosted players cannot report their own Pause control across the iframe.
  // Once suspended, click-to-play entries require a new explicit gesture.
  if (!foreground) entries.forEach((entry) => { if (!entry.auto) entry.manual = false; });
  const eligible = (entry: Entry) => foreground && entry.visible && !entry.paused && (entry.auto || entry.manual);
  const retainPaused = (entry: Entry) => foreground && entry.visible && entry.paused && entry.state.load;
  // A visible paused clip keeps its resource and playback position. It occupies
  // the same slot, so pausing cannot load a third video or start a neighbour.
  if (!current || !entries.has(current) || (!eligible(current) && !retainPaused(current))) {
    current = [...entries].find(eligible);
  }
  const nearby = foreground ? [...entries].filter((entry) => entry !== current && entry.near && entry.auto && !entry.paused) : [];
  const next = nearby.find((entry) => current && (current.element.compareDocumentPosition(entry.element) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? nearby[0];
  entries.forEach((entry) => {
    const state = { load: entry === current || entry === next, play: entry === current && !entry.paused, manual: entry.manual };
    if (state.load !== entry.state.load || state.play !== entry.state.play || state.manual !== entry.state.manual) {
      entry.state = state;
      entry.update(state);
    }
  });
}

type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

/** Viewport and preference policy shared by gallery and service-page videos. */
export function useViewportVideo(autoPreview = true) {
  const ref = useRef<HTMLDivElement>(null);
  const entryRef = useRef<Entry>();
  const [state, setState] = useState<PlaybackState>(IDLE);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const observed = typeof IntersectionObserver !== 'undefined';
    const allowed = () => autoPreview && observed && !motion?.matches && !connection?.saveData
      && connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
    const entry: Entry = { element, visible: false, near: false, auto: allowed(), paused: false, manual: false, state: IDLE, update: setState };
    entryRef.current = entry;
    entries.add(entry);
    const preferenceChanged = () => {
      entry.auto = allowed();
      // A new accessibility/data preference also stops a previously requested clip.
      entry.manual = false;
      reconcile();
    };
    motion?.addEventListener?.('change', preferenceChanged);
    connection?.addEventListener?.('change', preferenceChanged);
    if (entries.size === 1) document.addEventListener('visibilitychange', reconcile);

    const nearObserver = observed ? new IntersectionObserver(([item]) => {
      entry.near = item.isIntersecting;
      reconcile();
    }, { rootMargin: '180px 0px' }) : null;
    const visibleObserver = observed ? new IntersectionObserver(([item]) => {
      entry.visible = item.isIntersecting && item.intersectionRatio >= 0.35;
      if (!entry.visible) entry.manual = false;
      reconcile();
    }, { threshold: [0, 0.35] }) : null;
    nearObserver?.observe(element);
    visibleObserver?.observe(element);
    reconcile();
    return () => {
      nearObserver?.disconnect();
      visibleObserver?.disconnect();
      motion?.removeEventListener?.('change', preferenceChanged);
      connection?.removeEventListener?.('change', preferenceChanged);
      entries.delete(entry);
      entryRef.current = undefined;
      if (!entries.size) document.removeEventListener('visibilitychange', reconcile);
      reconcile();
    };
  }, [autoPreview]);

  const requestPlay = useCallback(() => {
    const entry = entryRef.current;
    if (!entry) return;
    entry.manual = true;
    entry.paused = false;
    // A user gesture works before an observer callback and without observer support.
    entry.visible = true;
    current = entry;
    reconcile();
  }, []);
  const pause = useCallback(() => {
    const entry = entryRef.current;
    if (!entry) return;
    entry.paused = true;
    entry.manual = false;
    reconcile();
  }, []);
  return { ref, ...state, requestPlay, pause };
}

/** Stop background clips while a photo dialog is open. */
export function suspendViewportVideos() {
  const token = Symbol('photo-dialog');
  suspensions.add(token);
  reconcile();
  return () => { suspensions.delete(token); reconcile(); };
}
