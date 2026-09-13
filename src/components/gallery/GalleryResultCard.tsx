import { useState } from 'react';
import { Maximize2, Play } from 'lucide-react';
import BeforeAfterTile from './BeforeAfterTile';
import ManagedVideo from '../media/ManagedVideo';
import type { GalleryCategory, GalleryItem, GalleryVideoItem } from '../../data/galleryMedia';

function GalleryVideo({ item }: { item: GalleryVideoItem }) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {item.playerUrl ? (
        <ManagedVideo playerUrl={item.playerUrl} poster={item.poster} title={item.description || item.label} />
      ) : (
        <div className="aspect-video bg-navy-950">
          {playing ? (
            <video src={item.src} poster={item.poster} controls autoPlay playsInline preload="none"
              aria-label={item.description || item.label} className="block h-full w-full object-contain" />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${item.label}`}
              className="group relative block h-full w-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-400">
              <img src={item.poster} alt="" width={640} height={360} loading="lazy" decoding="async" className="h-full w-full object-contain" />
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/15">
                <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-navy-950 shadow-lg motion-safe:transition-colors group-hover:bg-sky-100">
                  <Play size={18} fill="currentColor" /> Play video
                </span>
              </span>
            </button>
          )}
        </div>
      )}
      <figcaption className="flex items-start justify-between gap-3 px-5 py-4">
        <span className="text-sm font-semibold text-ink">{item.label}</span>
        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-royal-700">Video</span>
      </figcaption>
    </figure>
  );
}

/** Gallery presentation only: sources, approved pairs and service-page media stay unchanged. */
export default function GalleryResultCard({ item, category, onOpen, eager = false }: {
  item: GalleryItem;
  category: GalleryCategory;
  onOpen: (side: 'before' | 'after' | undefined, origin: HTMLElement) => void;
  eager?: boolean;
}) {
  if (item.type === 'before-after') {
    return <BeforeAfterTile entry={item} placeholderLabel={item.label} onOpen={onOpen}
      stageAspect={category === 'sofa-upholstery' ? 'aspect-square' : 'aspect-[4/3]'} />;
  }
  if (item.type === 'video') return <GalleryVideo item={item} />;

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <button type="button" onClick={(event) => onOpen(undefined, event.currentTarget)}
        aria-label={`View larger: ${item.alt}`}
        className="group relative block aspect-[4/3] w-full bg-navy-950 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-sky-400">
        <img src={item.src} srcSet={item.srcSet}
          sizes={item.srcSet ? (eager
            ? '(min-width: 1152px) 650px, (min-width: 1024px) 58vw, calc(100vw - 64px)'
            : '(min-width: 1152px) 548px, (min-width: 640px) calc(50vw - 28px), calc(100vw - 32px)') : item.sizes}
          alt={item.alt} width={600} height={450}
          loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-full w-full object-contain" />
        <span aria-hidden="true" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white motion-safe:transition-colors group-hover:bg-royal-600">
          <Maximize2 size={16} />
        </span>
      </button>
      <figcaption className="flex items-start justify-between gap-3 px-5 py-4">
        <span className="text-sm font-semibold text-ink">{item.label}</span>
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">Photo</span>
      </figcaption>
    </figure>
  );
}
