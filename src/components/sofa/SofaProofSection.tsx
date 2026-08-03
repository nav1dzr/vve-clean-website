import BeforeAfterTile from '../gallery/BeforeAfterTile';
import GalleryInstagramCta from '../gallery/GalleryInstagramCta';
import PhotoLightbox from '../gallery/PhotoLightbox';
import { toLightboxPhotos, useLightbox } from '../gallery/useLightbox';
import LazyVideo from '../media/LazyVideo';
import { SOFA_BEFORE_AFTER, SOFA_FEATURE_VIDEO } from '../../data/sofaMedia';

// The Sofa page's strongest proof, placed directly under the quote.
//
// This replaces the reserved-slot placeholder section that stood here while the
// owner's sofa set was being organised. Card style, grid spacing and CTA
// treatment are the shared ones used by Carpet and End of Tenancy, so the three
// service pages still read identically.
//
// The featured clip gets its own band rather than a third grid cell. It is the
// only one that answers "does this actually remove anything?", and it is
// portrait 608x1080 — dropped into a 16:9 card it would pillarbox down to a
// sliver between two black bars. A dedicated two-column band shows it at its
// real shape with the explanation beside it.

// All eight halves of the four approved pairs, in reading order, so Previous/
// Next walks the section exactly as it appears on screen.
const LIGHTBOX_PHOTOS = toLightboxPhotos(SOFA_BEFORE_AFTER);

export default function SofaProofSection() {
  const pairs = SOFA_BEFORE_AFTER;
  const lightbox = useLightbox();

  return (
    <>
      <section
        id="results"
        className="scroll-mt-24 border-y border-silver-200 bg-white px-4 py-16"
        aria-labelledby="sofa-results-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2
              id="sofa-results-heading"
              className="font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl"
            >
              Recent upholstery results
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Real sofas and chairs from recent jobs, photographed before and after. No stock images.
            </p>
          </div>

          {/* Four pairs sit better 2-up than in the 3-column grid the other two
              services use — a 3-column track would leave one card stranded. */}
          <div className="mb-10 grid gap-6 sm:grid-cols-2 [&>*]:min-w-0">
            {pairs.map((pair, i) => (
              <BeforeAfterTile
                key={pair.id}
                entry={pair}
                placeholderLabel={pair.label}
                // Five of these eight halves are portrait. On the shared 4:3
                // stage they lost 44% of the card to letterbox bars; a square
                // stage caps the waste at 25% whichever way a photo is shot.
                stageAspect="aspect-square"
                onOpen={(side, origin) => lightbox.open(i * 2 + (side === 'after' ? 1 : 0), origin)}
              />
            ))}
          </div>

          <GalleryInstagramCta galleryCategory="sofa-upholstery" />
        </div>

        <PhotoLightbox
          photos={LIGHTBOX_PHOTOS}
          index={lightbox.index}
          onClose={lightbox.close}
          onNavigate={lightbox.setIndex}
          label="Sofa and upholstery before and after photos"
        />
      </section>

      <section
        id="extraction"
        className="scroll-mt-24 bg-navy-950 px-4 py-16"
        aria-labelledby="sofa-extraction-heading"
      >
        <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* min-w-0 on both tracks: a grid item's automatic minimum size is its
              min-content width, which would otherwise stop the columns shrinking
              on a phone and push the page sideways. */}
          <LazyVideo
            video={SOFA_FEATURE_VIDEO}
            className="mx-auto aspect-[9/16] w-full min-w-0 max-w-[340px] shadow-2xl"
          />

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
              Straight from the machine
            </p>
            <h2
              id="sofa-extraction-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-4xl"
            >
              See what professional extraction removes
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-silver-300">
              Hot water and cleaning solution go into the upholstery under pressure, then come
              straight back out with whatever was living in the fibres. This is the waste tank
              emptying after a sofa clean — none of it comes out with a vacuum or a spray bottle.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-silver-400">
              The same pass takes most of the moisture with it, which is why a fabric sofa is
              usually dry within 3&ndash;6 hours rather than days.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
