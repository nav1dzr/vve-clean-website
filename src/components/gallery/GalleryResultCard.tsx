import { Maximize2 } from 'lucide-react';
import BeforeAfterTile from './BeforeAfterTile';
import ManagedVideo from '../media/ManagedVideo';
import LazyVideo from '../media/LazyVideo';
import type { GalleryCategory, GalleryItem, GalleryVideoItem } from '../../data/galleryMedia';

function GalleryVideo({ item }: { item: GalleryVideoItem }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {item.playerUrl ? (
        <ManagedVideo playerUrl={item.playerUrl} poster={item.poster} title={item.description || item.label} />
      ) : (
        <LazyVideo video={{ src: item.src, poster: item.poster, description: item.description || item.label, playLabel: item.label }}
          className="aspect-video w-full min-w-0 rounded-2xl" />
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
