import type { GalleryBeforeAfterItem } from '../../data/galleryMedia';

// Reusable before/after tile. Pass a manifest `entry` to render real photos
// (used by the Gallery page); omit it to render the "coming soon" placeholder
// (used on service pages that don't have real media yet). Both states keep
// the same aspect ratio and figure/figcaption semantics.
export default function BeforeAfterTile({
  entry,
  placeholderLabel,
}: {
  entry?: GalleryBeforeAfterItem;
  placeholderLabel: string;
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

  return (
    <figure className="rounded-2xl overflow-hidden border border-silver-200 shadow-sm bg-silver-50">
      <div className="grid grid-cols-2">
        <div className="relative">
          <img
            src={entry.before}
            alt={entry.beforeAlt}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="w-full aspect-[4/3] object-cover block"
          />
          <div className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold tracking-wide bg-black/55 text-white">
            Before
          </div>
        </div>
        <div className="relative">
          <img
            src={entry.after}
            alt={entry.afterAlt}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="w-full aspect-[4/3] object-cover block"
          />
          <div className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold tracking-wide bg-emerald-600/85 text-white">
            After
          </div>
        </div>
      </div>
      <figcaption className="text-center text-sm font-semibold text-navy-800 py-3 px-4">
        {entry.label}
      </figcaption>
    </figure>
  );
}
