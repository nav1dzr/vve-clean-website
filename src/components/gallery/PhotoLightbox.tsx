import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LightboxPhoto } from './useLightbox';

// One shared, accessible lightbox for every real photograph on the site.
//
// Deliberately not applied to placeholder tiles: there is no larger version of
// a reserved slot, so opening an empty overlay would be a dead end. Only
// surfaces holding genuine, approved photographs pass photos in here.

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  label = 'Photo viewer',
}: {
  photos: LightboxPhoto[];
  /** null when closed. */
  index: number | null;
  onClose: () => void;
  onNavigate: (next: number) => void;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = index !== null && photos.length > 0;
  const total = photos.length;
  const multiple = total > 1;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onNavigate((index - 1 + total) % total);
  }, [index, onNavigate, total]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onNavigate((index + 1) % total);
  }, [index, onNavigate, total]);

  // Move focus into the dialog on open so the very next Tab stays inside it.
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  // Lock page scrolling while open, and restore whatever was there before —
  // never assume the page started at overflow: visible.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  // Escape, arrow navigation, and the focus trap.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (multiple && e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); return; }
      if (multiple && e.key === 'ArrowRight') { e.preventDefault(); goNext(); return; }
      if (e.key !== 'Tab') return;

      // Trap: cycle within the dialog rather than escaping to the page behind.
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, multiple, goPrev, goNext, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const photo = photos[index!];
  if (!photo) return null;

  return createPortal(
    <div
      // Backdrop. Clicking it closes, but only when the click landed on the
      // backdrop itself — never when it bubbled up from the image or controls.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      // Near-opaque rather than /90: at 90% the bright navbar behind showed
      // through under the position text on mobile, which read as clutter.
      className="fixed inset-0 z-[100] flex flex-col bg-black/[0.97] motion-safe:animate-fade-in sm:items-center sm:justify-center sm:p-6"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // Full-screen on mobile; a centred, bounded panel from sm upwards.
        className="relative flex h-full w-full max-w-5xl flex-col sm:h-auto"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0">
          <p aria-live="polite" aria-atomic="true" className="text-sm font-semibold text-white">
            {multiple ? `Photo ${index! + 1} of ${total}` : 'Photo'}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X size={18} aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-0">
          {multiple && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/85 text-navy-900 shadow transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:-left-2"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}

          {/* object-contain preserves the real aspect ratio; the max bounds
              keep the image inside the viewport at every size, so the page
              never scrolls sideways. */}
          <img
            src={photo.src}
            alt={photo.alt}
            className="max-h-full max-w-full object-contain sm:max-h-[78vh]"
          />

          {multiple && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/85 text-navy-900 shadow transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:-right-2"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          )}
        </div>

        {photo.caption && (
          <p className="px-4 py-4 text-center text-sm font-medium text-silver-200 sm:px-0">
            {photo.caption}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
