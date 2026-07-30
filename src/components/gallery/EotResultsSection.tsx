import BeforeAfterTile from './BeforeAfterTile';
import RotatingResults from './RotatingResults';
import GalleryInstagramCta from './GalleryInstagramCta';
import { EOT_FEATURED_BEFORE_AFTER, EOT_ROTATING_PHOTOS } from '../../data/galleryMedia';

// Real End of Tenancy proof: exactly 3 approved before/after pairs, plus one
// rotating results area for photos 1–10. Both pull from the same central
// gallery manifest as the full Gallery page — no separate hard-coded list to
// drift out of sync.
export default function EotResultsSection() {
  return (
    <section className="py-16 px-4 bg-white border-y border-silver-200" aria-label="End of tenancy results">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
            See the difference
          </h2>
          <p className="text-slate-500 text-sm mt-3">
            Before-and-after comparisons and photos from recent end of tenancy cleaning work.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {EOT_FEATURED_BEFORE_AFTER.map((entry) => (
            <BeforeAfterTile key={entry.id} entry={entry} placeholderLabel={entry.label} />
          ))}
        </div>

        <RotatingResults photos={EOT_ROTATING_PHOTOS} label="Recent end of tenancy cleaning work" />

        <GalleryInstagramCta galleryCategory="end-of-tenancy" />
      </div>
    </section>
  );
}
