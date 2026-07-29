import BeforeAfterTile from './BeforeAfterTile';
import VideoTile from './VideoTile';
import RotatingResultsPlaceholder from './RotatingResultsPlaceholder';
import GalleryInstagramCta from './GalleryInstagramCta';
import type { GalleryCategory } from '../../data/galleryMedia';

// Placeholder-ready proof section shared by every service page that doesn't
// have real, approved before/after or video content committed for this
// section yet. Always renders 3 before/after slots; the second row is either
// 3 video slots (Carpet, Sofa & Upholstery) or a single rotating-results slot
// (End of Tenancy) — never real photos here, so nothing implies a job that
// hasn't actually been photographed yet.
export default function ServiceProofSection({
  heading,
  subheading,
  galleryLabel,
  galleryCategory,
  secondary,
}: {
  heading: string;
  subheading: string;
  galleryLabel: string;
  galleryCategory: GalleryCategory;
  secondary: { type: 'video' } | { type: 'rotating' };
}) {
  return (
    <section className="py-16 px-4 bg-white border-y border-silver-200" aria-label={`${galleryLabel} results`}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">{heading}</h2>
          <p className="text-slate-500 text-sm mt-3">{subheading}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[0, 1, 2].map((i) => (
            <BeforeAfterTile key={i} placeholderLabel={`${galleryLabel} job ${i + 1}`} />
          ))}
        </div>

        {secondary.type === 'video' ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <VideoTile key={i} placeholderLabel={`${galleryLabel} clip ${i + 1}`} />
            ))}
          </div>
        ) : (
          <RotatingResultsPlaceholder label={galleryLabel} />
        )}

        <GalleryInstagramCta galleryCategory={galleryCategory} />
      </div>
    </section>
  );
}
