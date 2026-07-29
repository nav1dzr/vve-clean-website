import { PlayCircle } from 'lucide-react';
import type { GalleryVideoItem } from '../../data/galleryMedia';

// Reusable video tile. Pass a manifest `entry` to render a real muted/looped/
// playsinline clip (used by the Gallery page); omit it to render the "coming
// soon" placeholder (used on service pages that don't have real clips yet).
// Placeholder media never autoplays — there is no <video> element at all
// until a real entry exists.
export default function VideoTile({
  entry,
  placeholderLabel,
}: {
  entry?: GalleryVideoItem;
  placeholderLabel: string;
}) {
  if (!entry) {
    return (
      <div
        className="rounded-2xl overflow-hidden border border-dashed border-silver-300 bg-silver-50 aspect-video flex flex-col items-center justify-center gap-2"
        role="img"
        aria-label={`${placeholderLabel} — video results coming soon`}
      >
        <PlayCircle size={32} className="text-silver-400" aria-hidden="true" />
        <span className="text-silver-500 text-xs font-semibold tracking-widest uppercase">
          Video results coming soon
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-black aspect-video">
      <video
        src={entry.src}
        poster={entry.poster}
        muted
        loop
        playsInline
        controls
        preload="none"
        aria-label={entry.label}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
