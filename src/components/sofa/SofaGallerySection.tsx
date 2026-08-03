import { Maximize2 } from 'lucide-react';
import PhotoLightbox from '../gallery/PhotoLightbox';
import { toLightboxPhotos, useLightbox } from '../gallery/useLightbox';
import LazyVideo from '../media/LazyVideo';
import { SOFA_SUPPORTING_VIDEOS } from '../../data/sofaMedia';
import { useSofaGalleryOrder } from './useSofaGalleryOrder';

// The supporting sofa gallery: 11 photographs plus the three clips that are not
// the featured extraction shot.
//
// It sits later in the page than SofaProofSection on purpose. The before/after
// pairs and the extraction clip are the evidence that earns the booking; this is
// breadth — proof that the work is routine rather than one lucky job.
//
// Photo order comes from useSofaGalleryOrder: the owner's favourite is pinned
// first, the rest are shuffled once per session. The lightbox list is derived
// from the same array in the same pass, so index N in the overlay is always the
// tile the visitor actually clicked, shuffled or not.

export default function SofaGallerySection() {
  const photos = useSofaGalleryOrder();
  const lightbox = useLightbox();
  const lightboxPhotos = toLightboxPhotos(photos);

  return (
    <section
      id="gallery"
      className="scroll-mt-24 border-y border-white/5 bg-navy-950 px-4 py-16"
      aria-labelledby="sofa-gallery-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
            More of our work
          </p>
          <h2
            id="sofa-gallery-heading"
            className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-4xl"
          >
            Sofas, chairs and mattresses we&rsquo;ve cleaned
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-silver-300">
            Every photograph below is upholstery we have cleaned ourselves. Tap any of them to see
            the full picture.
          </p>
        </div>

        {/* The pinned first photo spans 2x2 so it reads as the lead image; the
            rest fill around it. [&>*]:min-w-0 stops any tile's min-content width
            setting a floor the column cannot shrink below on a phone. */}
        <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 [&>*]:min-w-0">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={(e) => lightbox.open(i, e.currentTarget)}
              aria-label={`View larger: ${photo.alt}`}
              className={`group relative overflow-hidden rounded-2xl bg-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                i === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-[4/3]'
              }`}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                // Thumbnails crop to the tile; the lightbox always shows the
                // full uncropped frame, so nothing is hidden from the visitor.
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <Maximize2 size={14} />
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-3 pb-2 pt-8 text-left text-[11px] font-semibold text-white sm:text-xs">
                {photo.label}
              </span>
            </button>
          ))}
        </div>

        <h3 className="mb-5 text-center font-display text-xl font-bold text-white">
          On the job
        </h3>
        {/* One stage shape for all three. Two of the clips are landscape and one
            is portrait; giving each its own aspect made the grid row as tall as
            the portrait clip and stretched the other two into half-empty boxes.
            4:3 follows the majority — the portrait clip pillarboxes onto the
            navy backdrop, which is how BeforeAfterTile already handles the same
            mixed-orientation problem. items-start stops the row stretching a
            short item past the height its aspect-ratio asked for. */}
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {SOFA_SUPPORTING_VIDEOS.map((video) => (
            <LazyVideo key={video.id} video={video} className="aspect-[4/3] w-full min-w-0" />
          ))}
        </div>
      </div>

      <PhotoLightbox
        photos={lightboxPhotos}
        index={lightbox.index}
        onClose={lightbox.close}
        onNavigate={lightbox.setIndex}
        label="Sofa and upholstery photos"
      />
    </section>
  );
}
