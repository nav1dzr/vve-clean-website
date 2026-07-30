import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BeforeAfterTile from '../components/gallery/BeforeAfterTile';
import VideoTile from '../components/gallery/VideoTile';
import GalleryInstagramCta from '../components/gallery/GalleryInstagramCta';
import {
  GALLERY_CATEGORIES,
  GALLERY_MEDIA,
  type GalleryCategory,
} from '../data/galleryMedia';

function isGalleryCategory(value: string | null): value is GalleryCategory {
  return !!value && GALLERY_CATEGORIES.some((c) => c.key === value);
}

export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const fromQuery = searchParams.get('category');
  const fromHash = hash.replace(/^#/, '');
  const initial: GalleryCategory = isGalleryCategory(fromQuery)
    ? fromQuery
    : isGalleryCategory(fromHash)
      ? fromHash
      : GALLERY_CATEGORIES[0].key;

  const [active, setActive] = useState<GalleryCategory>(initial);

  // Keep the active tab in sync if the URL changes under us (e.g. a service
  // page's "View full Gallery" link is clicked while this page is already
  // mounted, or the user navigates back/forward).
  useEffect(() => {
    const next = searchParams.get('category');
    if (isGalleryCategory(next) && next !== active) setActive(next);
  }, [searchParams, active]);

  const selectCategory = (key: GalleryCategory) => {
    setActive(key);
    setSearchParams({ category: key }, { replace: true });
  };

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % GALLERY_CATEGORIES.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + GALLERY_CATEGORIES.length) % GALLERY_CATEGORIES.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = GALLERY_CATEGORIES.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = GALLERY_CATEGORIES[nextIndex];
    selectCategory(next.key);
    tabRefs.current[next.key]?.focus();
  };

  const items = GALLERY_MEDIA[active];
  const activeMeta = GALLERY_CATEGORIES.find((c) => c.key === active)!;

  return (
    <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
      <Navbar />

      <div className="navy-gradient pt-32 pb-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Results Library</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            VVE Clean Gallery
          </h1>
          <p className="text-silver-200 text-base sm:text-lg max-w-xl mx-auto">
            Explore real end of tenancy results now. Carpet and sofa &amp; upholstery photos and short videos will be added as their approved sets are ready.
          </p>
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-4 py-12">
        {/* ── Accessible tabs ── */}
        <div role="tablist" aria-label="Gallery categories" className="flex flex-wrap justify-center gap-2 mb-10">
          {GALLERY_CATEGORIES.map((cat, i) => {
            const selected = cat.key === active;
            return (
              <button
                key={cat.key}
                ref={(el) => { tabRefs.current[cat.key] = el; }}
                type="button"
                role="tab"
                id={`gallery-tab-${cat.key}`}
                aria-selected={selected}
                aria-controls={`gallery-panel-${cat.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectCategory(cat.key)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`px-5 py-2.5 min-h-[44px] rounded-full text-sm font-semibold border-2 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                  selected
                    ? 'border-royal-500 bg-royal-500 text-white'
                    : 'border-silver-200 text-navy-700 hover:border-royal-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── Panel ── */}
        <div
          role="tabpanel"
          id={`gallery-panel-${active}`}
          aria-labelledby={`gallery-tab-${active}`}
          tabIndex={0}
        >
          {items.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-silver-300 rounded-2xl bg-silver-50">
              <p className="text-silver-500 font-medium">
                Our {activeMeta.label} results library is being organised and will be added here shortly.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => {
                if (item.type === 'before-after') {
                  return <BeforeAfterTile key={item.id} entry={item} placeholderLabel={item.label} />;
                }
                if (item.type === 'video') {
                  return <VideoTile key={item.id} entry={item} placeholderLabel={item.label} />;
                }
                return (
                  <figure key={item.id} className="rounded-2xl overflow-hidden border border-silver-200 shadow-sm bg-silver-50">
                    <div className="aspect-[4/3] bg-navy-950">
                      <img
                        src={item.src}
                        alt={item.alt}
                        width={600}
                        height={450}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain block"
                      />
                    </div>
                    <figcaption className="text-center text-sm font-semibold text-navy-800 py-3 px-4">
                      {item.label}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4">
          <GalleryInstagramCta galleryCategory={active} showGalleryLink={false} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
