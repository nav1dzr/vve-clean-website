import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useManagedServiceHeroMedia, useManagedWebsiteMedia } from '../lib/managedGalleryMedia';
import type { GalleryItem } from '../data/galleryMedia';
import ServiceHeroPhoto from './ServiceHeroPhoto';

const slides = [
  {
    service: 'Carpet cleaning', category: 'carpet',
    src: '/images/carpet-cleaning-hero.webp',
    alt: 'Extraction equipment cleaning a blue carpet',
    caption: 'Carpet extraction in progress',
    link: 'See our carpet cleaning results',
  },
  {
    service: 'Sofa & upholstery', category: 'sofa-upholstery',
    src: '/sofa_upholstery/web/gallery/sofa-gallery-01.webp',
    alt: 'A VVE Clean technician in branded uniform cleaning a navy velvet sofa',
    caption: 'Cleaning a velvet sofa',
    link: 'See our upholstery cleaning results',
  },
  {
    service: 'End of tenancy', category: 'end-of-tenancy',
    src: '/end_of_tenancy/before-after/kitchen1_after.jpg',
    alt: 'Kitchen hob after cleaning',
    caption: 'Kitchen hob after cleaning',
    link: 'See our end of tenancy results',
  },
];

function stillImage(item: GalleryItem | null) {
  if (item?.type === 'photo') return { src: item.src, srcSet: item.srcSet, sizes: item.sizes, alt: item.alt, caption: item.label };
  if (item?.type === 'before-after') return { src: item.after, alt: item.afterAlt, caption: item.label };
  return null;
}

const controlClass = 'inline-flex h-11 min-w-11 items-center justify-center rounded-full text-royal-700 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700 motion-reduce:transition-none';

/** The homepage keeps its named placement; the other cards reuse their service's published position one. */
export default function HomepagePhotoCarousel() {
  const homepageMedia = useManagedWebsiteMedia('homepage-hero-image');
  const sofaMedia = useManagedServiceHeroMedia('sofa-upholstery');
  const tenancyMedia = useManagedServiceHeroMedia('end-of-tenancy');
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!motion) return;
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    return () => motion.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || !visible || reducedMotion) return;
    const timer = window.setInterval(() => setActive(previous => (previous + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, visible, reducedMotion]);

  const chooseSlide = (index: number) => {
    const next = (index + slides.length) % slides.length;
    setActive(next);
    // Reading or swiping a card gives the visitor control until they press Play.
    setPaused(true);
    setAnnouncement(`${slides[next].service}, photo ${next + 1} of ${slides.length}`);
  };
  const slide = slides[active];
  const managedPhotos = [stillImage(homepageMedia?.type === 'photo' ? homepageMedia : null), stillImage(sofaMedia), stillImage(tenancyMedia)];
  const photo = managedPhotos[active] ?? slide;

  return (
    <section
      aria-label="Cleaning photos"
      aria-roledescription="carousel"
      className="min-w-0 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-lg shadow-slate-900/5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          chooseSlide(active + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <span className="text-xs font-bold uppercase tracking-wider text-royal-700">{slide.service}</span>
        {reducedMotion ? <span className="text-xs text-slate-500">Swipe or use arrows</span> : (
          <button type="button" onClick={() => setPaused(previous => !previous)} className={controlClass}
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} title={paused ? 'Play slideshow' : 'Pause slideshow'}>
            {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      <div
        role="group" aria-roledescription="slide" aria-label={`${active + 1} of ${slides.length}: ${slide.service}`}
        className="[&_.service-photo]:rounded-none [&_.service-photo]:border-0 [&_.service-photo]:shadow-none [&_.service-photo>img]:aspect-[4/3] [&_.service-photo>img]:max-h-none [&_.service-photo>figcaption]:min-h-[7.5rem]"
        onTouchStart={event => {
          touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
        }}
        onTouchMove={event => { if (event.touches.length > 1) touchStart.current = null; }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={event => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || event.changedTouches.length !== 1) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) chooseSlide(active + (dx < 0 ? 1 : -1));
        }}
      >
        <ServiceHeroPhoto key={slide.category} {...photo} fallback={slide}
          detail={<a href={`/gallery?category=${slide.category}`} className="inline-flex min-h-11 items-center font-semibold text-royal-700 underline underline-offset-4">{slide.link}</a>} />
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-slate-100 bg-sky-50/60 px-3 py-1">
        <button type="button" aria-label="Previous cleaning photo" className={controlClass} onClick={() => chooseSlide(active - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <div className="flex" role="group" aria-label="Choose a cleaning photo">
          {slides.map((item, index) => <button key={item.category} type="button" className={controlClass}
            aria-label={`Show ${item.service.toLowerCase()} photo`} aria-current={active === index ? 'true' : undefined}
            onClick={() => chooseSlide(index)}>
            <span aria-hidden="true" className={`h-2 rounded-full transition-all duration-200 motion-reduce:transition-none ${active === index ? 'w-6 bg-royal-700' : 'w-2 bg-slate-400'}`} />
          </button>)}
        </div>
        <button type="button" aria-label="Next cleaning photo" className={controlClass} onClick={() => chooseSlide(active + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  );
}
