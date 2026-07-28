import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = '/end_of_tenancy/';

const PAIRS = [
  {
    before: `${BASE}kitchen1_before.jpg`,
    after:  `${BASE}kitchen1_after.jpg`,
    label:  'Kitchen',
    beforeAlt: 'Kitchen before end of tenancy clean — grease and grime on surfaces and appliances',
    afterAlt:  'Kitchen after end of tenancy clean — all surfaces, appliances and cupboards spotless',
  },
  {
    before: `${BASE}oven_cleaning_before.jpg`,
    after:  `${BASE}oven_cleaning_after.jpg`,
    label:  'Oven',
    beforeAlt: 'Oven before cleaning — heavily soiled interior with baked-on grease and carbon deposits',
    afterAlt:  'Oven after cleaning — clean glass door, racks and interior with no residue',
  },
  {
    before: `${BASE}shower_before.jpg`,
    after:  `${BASE}shower_after.jpg`,
    label:  'Shower',
    beforeAlt: 'Shower enclosure before cleaning — limescale and soap scum on tiles, grouting and glass',
    afterAlt:  'Shower enclosure after cleaning — tiles descaled and glass screen streak-free',
  },
];

const SLIDESHOW_SRCS = Array.from({ length: 10 }, (_, i) => `${BASE}${i + 1}.jpg`);

function shuffled(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EotGallery() {
  // ── Slideshow state ───────────────────────────────────────────────────────
  const [images, setImages] = useState<string[]>(SLIDESHOW_SRCS);
  const [current, setCurrent] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    // Shuffle once after client mount — not during SSR
    setImages(shuffled(SLIDESHOW_SRCS));

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const total = images.length;

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + total) % total);
  }, [total]);

  const goPrev = useCallback(() => { setUserInteracted(true); goTo(current - 1); }, [current, goTo]);
  const goNext = useCallback(() => { setUserInteracted(true); goTo(current + 1); }, [current, goTo]);
  const goIdx  = useCallback((i: number) => { setUserInteracted(true); goTo(i); }, [goTo]);

  const autoplayActive = !hoverPaused && !focusPaused && !userInteracted && !reducedMotion;

  useEffect(() => {
    if (!autoplayActive) return;
    const t = setTimeout(() => goTo(current + 1), 5000);
    return () => clearTimeout(t);
  }, [current, autoplayActive, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx > 0) goPrev(); else goNext(); }
    touchStartX.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  };

  return (
    <section className="py-16 px-4 bg-white border-y border-silver-200" aria-label="End of tenancy cleaning gallery">
      <div className="max-w-6xl mx-auto">

        {/* ── 1. Real results: before/after pairs ── */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
              Real end of tenancy cleaning results
            </h2>
            <p className="text-slate-500 text-sm mt-3">Genuine before-and-after photos — unedited.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PAIRS.map((pair) => (
              <figure key={pair.label} className="rounded-2xl overflow-hidden border border-silver-200 shadow-sm bg-silver-50">
                <div className="grid grid-cols-2">
                  <div className="relative">
                    <img
                      src={pair.before}
                      alt={pair.beforeAlt}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-[4/3] object-cover block"
                    />
                    <div className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold tracking-wide bg-black/55 text-white">
                      Before
                    </div>
                  </div>
                  <div className="relative">
                    <img
                      src={pair.after}
                      alt={pair.afterAlt}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-[4/3] object-cover block"
                    />
                    <div className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold tracking-wide bg-emerald-600/85 text-white">
                      After
                    </div>
                  </div>
                </div>
                <figcaption className="text-center text-sm font-semibold text-navy-800 py-3 px-4">
                  {pair.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* ── 2. Slideshow: recent cleans ── */}
        <div>
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
              More from our recent cleans
            </h2>
          </div>

          <div
            role="region"
            aria-label="Recent cleaning photos slideshow"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setHoverPaused(true)}
            onMouseLeave={() => setHoverPaused(false)}
            onFocus={() => setFocusPaused(true)}
            onBlur={() => setFocusPaused(false)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="focus:outline-none"
          >
            {/* Image viewport */}
            <div className="relative rounded-2xl overflow-hidden bg-silver-100 aspect-video">
              {images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`End of tenancy cleaning photo ${i + 1} of ${total}`}
                  width={1200}
                  height={675}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding={i === 0 ? 'sync' : 'async'}
                  aria-hidden={i !== current}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                />
              ))}

              {/* Prev arrow */}
              <button
                type="button"
                aria-label="Previous photo"
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/85 hover:bg-white shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-navy-900" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Next arrow */}
              <button
                type="button"
                aria-label="Next photo"
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/85 hover:bg-white shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-navy-900" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Dot navigation */}
            <div
              role="tablist"
              aria-label="Select photo"
              className="flex justify-center gap-2 mt-4 flex-wrap"
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === current}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => goIdx(i)}
                  className={`rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-500 ${
                    i === current
                      ? 'w-6 h-2.5 bg-royal-500'
                      : 'w-2.5 h-2.5 bg-silver-300 hover:bg-silver-500'
                  }`}
                />
              ))}
            </div>

            {reducedMotion && (
              <p className="text-center text-silver-500 text-xs mt-3">
                Autoplay paused — use arrows or dots to browse.
              </p>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
