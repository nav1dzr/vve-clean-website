import { PlayCircle } from 'lucide-react';
import LazyVideo from '../media/LazyVideo';
import type { GalleryVideoItem } from '../../data/galleryMedia';

// Reusable video tile. Pass a manifest `entry` to render a real clip; omit it to
// render the "coming soon" placeholder (used on service pages that don't have
// real clips yet). Placeholder media never autoplays — there is no <video>
// element at all until a real entry exists.
//
// Real entries delegate to the shared LazyVideo rather than hand-rolling a
// second <video>. That was the fix for a genuine defect: this tile declared
// muted/loop/playsInline but never `autoplay`, and shipped `preload="none"`
// with an immediate `src`, so a Gallery-page clip sat on its poster until the
// visitor pressed play. LazyVideo autoplays muted when the clip scrolls into
// view, pauses it again when it leaves, withholds the source until then,
// honours prefers-reduced-motion, and falls back to native controls if the
// browser refuses to autoplay.
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
    <LazyVideo
      video={{
        src: entry.src,
        poster: entry.poster,
        description: entry.description ?? entry.label,
      }}
      className="aspect-video w-full min-w-0 rounded-2xl"
    />
  );
}
