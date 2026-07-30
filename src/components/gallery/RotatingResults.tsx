import { useState, useEffect, useRef, useCallback } from 'react';
import type { GalleryPhotoItem } from '../../data/galleryMedia';

// A single-photo rotating results area. Renders the given photos in the
// exact order supplied — never shuffled, so there is no random-order mismatch
// between renders. Autoplay is gentle (a plain opacity crossfade, no video)
// and stops the moment the visitor takes control, hovers, focuses, or has
// prefers-reduced-motion set.
export default function RotatingResults({ photos, label }: { photos: GalleryPhotoItem[]; label: string }) {
  const [current, setCurrent] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const total = photos.length;

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + total) % total);
  }, [total]);

  const goPrev = useCallback(() => { setUserInteracted(true); goTo(current - 1); }, [current, goTo]);
  const goNext = useCallback(() => { setUserInteracted(true); goTo(current + 1); }, [current, goTo]);
  const goIdx  = useCallback((i: number) => { setUserInteracted(true); goTo(i); }, [goTo]);

  const autoplayActive = !hoverPaused && !focusPaused && !userInteracted && !reducedMotion;

  useEffect(() => {
    if (!autoplayActive) return;
    const t = setTimeout(() => goTo(current + 1), 5000);
    return () => clearTimeout(t);
  }, [current, autoplayActive, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx > 0) goPrev(); else goNext(); }
    touchStartX.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  };

  if (total === 0) return null;

  return (
    <div
      role="region"
      aria-label={`${label} — recent photos`}
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setFocusPaused(true)}
      onBlur={() => setFocusPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="focus:outline-none"
    >
      {/* Photo stage — fixed aspect ratio, object-contain so mixed portrait/
          landscape source photos are never misleadingly cropped. */}
      <div className="relative rounded-2xl overflow-hidden bg-navy-950 aspect-video">
        {photos.map((photo, i) => (
          <img
            key={photo.id}
            src={photo.src}
            alt={photo.alt}
            width={1200}
            height={675}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding={i === 0 ? 'sync' : 'async'}
            aria-hidden={i !== current}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />
        ))}

        <button
          type="button"
          aria-label="Previous photo"
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/85 hover:bg-white shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-navy-900" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Next photo"
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/85 hover:bg-white shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-navy-900" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Status text — announced to screen readers and visible to everyone,
          satisfying the "position/status text" requirement explicitly. */}
      <p
        aria-live={autoplayActive ? 'off' : 'polite'}
        aria-atomic="true"
        className="text-center text-slate-500 text-xs font-medium mt-3"
      >
        Photo {current + 1} of {total}
      </p>

      {/* Dot navigation */}
      <div role="group" aria-label="Select photo" className="flex justify-center gap-2 mt-2 flex-wrap">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            aria-current={i === current ? 'true' : undefined}
            aria-label={`Photo ${i + 1}`}
            onClick={() => goIdx(i)}
            className={`rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500 ${
              i === current
                ? 'w-6 h-2.5 bg-royal-500'
                : 'w-2.5 h-2.5 bg-silver-300 hover:bg-silver-500'
            }`}
          />
        ))}
      </div>

      {reducedMotion && (
        <p className="text-center text-silver-500 text-xs mt-2">
          Autoplay paused — use arrows or dots to browse.
        </p>
      )}
    </div>
  );
}
