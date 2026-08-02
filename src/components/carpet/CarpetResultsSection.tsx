// Real carpet-cleaning results for the Carpet page.
//
// Reuses the shared BeforeAfterTile and GalleryInstagramCta so the carpet page
// matches the End of Tenancy page exactly in card style, spacing and CTA
// treatment — including the same 3-column grid, since both pages carry exactly
// three approved pairs. Each result card carries a matching clip beneath it.

import BeforeAfterTile from '../gallery/BeforeAfterTile';
import GalleryInstagramCta from '../gallery/GalleryInstagramCta';
import LazyVideo from './LazyVideo';
import { CARPET_FEATURED_BEFORE_AFTER } from '../../data/galleryMedia';
import { CARPET_RESULT_VIDEOS } from '../../data/carpetMedia';

export default function CarpetResultsSection() {
  const pairs = CARPET_FEATURED_BEFORE_AFTER;
  if (pairs.length === 0) return null;

  return (
    <section
      id="results"
      className="scroll-mt-24 border-y border-silver-200 bg-white py-16 px-4"
      aria-label="Carpet cleaning results"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
            Recent carpet results
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Real carpets from recent jobs, photographed before and after. No stock images.
          </p>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {pairs.map((pair) => {
            const clip = CARPET_RESULT_VIDEOS.find((v) => v.pairedWith === pair.id);
            return (
              <div key={pair.id} className="flex flex-col gap-3">
                <BeforeAfterTile entry={pair} placeholderLabel={pair.label} />
                {/* Portrait phone footage, so the stage is portrait too — a
                    landscape stage would pillarbox it down to a sliver. */}
                {clip && <LazyVideo video={clip} className="aspect-[3/4] w-full" />}
              </div>
            );
          })}
        </div>

        <GalleryInstagramCta galleryCategory="carpet" />
      </div>
    </section>
  );
}
