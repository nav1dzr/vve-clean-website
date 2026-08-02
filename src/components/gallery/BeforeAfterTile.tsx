import { Maximize2 } from 'lucide-react';
import type { GalleryBeforeAfterItem } from '../../data/galleryMedia';

// Reusable before/after tile. Pass a manifest `entry` to render real photos
// (used by the Gallery page); omit it to render the "coming soon" placeholder
// (used on service pages that don't have real media yet). Both states keep
// the same aspect ratio and figure/figcaption semantics.
//
// `onOpen` makes each half independently viewable at full size. It is optional
// on purpose: the placeholder state never receives one, so a reserved slot can
// never open an empty lightbox. Both halves stay side by side and keep their
// Before/After labels either way, so enlarging one never breaks the comparison.
export default function BeforeAfterTile({
  entry,
  placeholderLabel,
  onOpen,
}: {
  entry?: GalleryBeforeAfterItem;
  placeholderLabel: string;
  onOpen?: (side: 'before' | 'after', origin: HTMLElement) => void;
}) {
  if (!entry) {
    return (
      <figure
        className="rounded-2xl overflow-hidden border border-dashed border-silver-300 bg-silver-50"
        aria-label={`${placeholderLabel} — recent results coming soon`}
      >
        <div className="grid grid-cols-2">
          <div className="aspect-[4/3] flex items-center justify-center bg-silver-100 border-r border-silver-200">
            <span className="text-silver-400 text-[11px] font-semibold tracking-widest uppercase">Before</span>
          </div>
          <div className="aspect-[4/3] flex items-center justify-center bg-silver-100">
            <span className="text-silver-400 text-[11px] font-semibold tracking-widest uppercase">After</span>
          </div>
        </div>
        <figcaption className="text-center text-sm font-medium text-silver-500 py-3 px-4">
          Recent results coming soon
        </figcaption>
      </figure>
    );
  }

  // Source photos are a mix of landscape and portrait orientations. Cropping
  // to a fixed aspect ratio with object-cover would cut real content out of
  // whichever photo doesn't match the container — so every image sits on a
  // fixed 4:3 stage with object-contain instead: the full, uncropped photo is
  // always shown, letterboxed on a neutral background when its orientation
  // differs from the stage.
  const half = (side: 'before' | 'after') => {
    const src = side === 'before' ? entry.before : entry.after;
    const alt = side === 'before' ? entry.beforeAlt : entry.afterAlt;
    const badge = side === 'before'
      ? 'bg-black/55 text-white'
      : 'bg-emerald-600/85 text-white';

    const media = (
      <>
        <img
          src={src}
          alt={alt}
          width={400}
          height={300}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain"
        />
        <div className={`absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold tracking-wide ${badge}`}>
          {side === 'before' ? 'Before' : 'After'}
        </div>
      </>
    );

    // A real <button> gives click, Enter and Space activation for free.
    return onOpen ? (
      <button
        type="button"
        onClick={(e) => onOpen(side, e.currentTarget)}
        aria-label={`View larger: ${alt}`}
        className="group relative aspect-[4/3] bg-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-royal-500"
      >
        {media}
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Maximize2 size={14} />
        </span>
      </button>
    ) : (
      <div className="relative aspect-[4/3] bg-navy-950">{media}</div>
    );
  };

  return (
    <figure className="rounded-2xl overflow-hidden border border-silver-200 shadow-sm bg-silver-50">
      <div className="grid grid-cols-2">
        {half('before')}
        {half('after')}
      </div>
      <figcaption className="text-center text-sm font-semibold text-navy-800 py-3 px-4">
        {entry.label}
      </figcaption>
    </figure>
  );
}
