import { Images, PlayCircle, Sofa } from 'lucide-react';
import BeforeAfterTile from '../gallery/BeforeAfterTile';
import VideoTile from '../gallery/VideoTile';
import RotatingResults from '../gallery/RotatingResults';
import GalleryInstagramCta from '../gallery/GalleryInstagramCta';
import {
  GALLERY_MEDIA,
  type GalleryBeforeAfterItem,
  type GalleryPhotoItem,
  type GalleryVideoItem,
} from '../../data/galleryMedia';

// Sofa & Upholstery proof section.
//
// The owner has not supplied an approved sofa photo set yet, so this section
// shows honest reserved slots rather than borrowing carpet or end-of-tenancy
// photographs — a customer must never be shown another service's result as if
// it were a sofa job. Every slot says plainly that real sofa results are being
// prepared, and none of them is clickable: there is nothing to enlarge.
//
// It is wired to the central manifest, not to hard-coded paths. The moment
// GALLERY_MEDIA['sofa-upholstery'] gains approved entries, the matching slots
// switch to the real BeforeAfterTile / VideoTile / RotatingResults components
// automatically — no rebuild of this section, and the Gallery page picks the
// same entries up from the same place.

const PENDING_NOTE = 'Genuine sofa results are being prepared';

// Dark, sky-accented slot matching the Sofa page's premium hero and care
// guide, rather than the light grey placeholder used on the older pages.
function PremiumSlot({
  icon,
  kicker,
  caption,
  className = '',
}: {
  icon: React.ReactNode;
  kicker: string;
  caption: string;
  className?: string;
}) {
  return (
    <div
      // role="img" with a label keeps this a single, non-interactive object to
      // assistive tech instead of a stray unlabelled box.
      role="img"
      aria-label={`${kicker} — ${caption}`}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sky-400/30 bg-navy-950/60 px-6 text-center ${className}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300" aria-hidden="true">
        {icon}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">{kicker}</span>
      <span className="max-w-xs text-sm leading-relaxed text-silver-300">{caption}</span>
    </div>
  );
}

export default function SofaResultsSection() {
  const items = GALLERY_MEDIA['sofa-upholstery'];
  const beforeAfter = items.filter(
    (i): i is GalleryBeforeAfterItem => i.type === 'before-after',
  );
  const videos = items.filter((i): i is GalleryVideoItem => i.type === 'video');
  const photos = items.filter((i): i is GalleryPhotoItem => i.type === 'photo');

  return (
    <section
      className="border-y border-white/5 bg-navy-950 px-4 py-20"
      aria-labelledby="sofa-results-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Our sofa results</p>
          <h2
            id="sofa-results-heading"
            className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-4xl"
          >
            Sofa results, photographed properly.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-silver-300">
            We only publish photographs and video of upholstery we have actually cleaned. Our sofa
            set is still being photographed and approved, so these spaces are reserved rather than
            filled with someone else&rsquo;s work or a stock image.
          </p>
        </div>

        {/* ── Row 1 — three before/after slots ── */}
        <div className="mb-6 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const entry = beforeAfter[i];
            return entry ? (
              <BeforeAfterTile key={entry.id} entry={entry} placeholderLabel={entry.label} />
            ) : (
              <PremiumSlot
                key={`ba-${i}`}
                icon={<Sofa size={24} />}
                kicker="Before and after"
                caption={`${PENDING_NOTE} — reserved for an upholstery job we have cleaned.`}
                className="aspect-[4/3] py-8"
              />
            );
          })}
        </div>

        {/* ── Row 2 — three video slots ── */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const entry = videos[i];
            return entry ? (
              <VideoTile key={entry.id} entry={entry} placeholderLabel={entry.label} />
            ) : (
              <PremiumSlot
                key={`vid-${i}`}
                icon={<PlayCircle size={24} />}
                kicker="Short clip"
                caption={`${PENDING_NOTE} — reserved for extraction footage from a real visit.`}
                className="aspect-video py-8"
              />
            );
          })}
        </div>

        {/* ── Row 3 — one larger rotating-results slot ── */}
        {photos.length > 0 ? (
          <RotatingResults photos={photos} label="Recent sofa and upholstery cleaning work" />
        ) : (
          <PremiumSlot
            icon={<Images size={30} />}
            kicker="Rotating results"
            caption={`${PENDING_NOTE}. Approved photographs will rotate here, newest first, once the set is signed off.`}
            className="aspect-video py-10"
          />
        )}

        <GalleryInstagramCta galleryCategory="sofa-upholstery" onDark />
      </div>
    </section>
  );
}
