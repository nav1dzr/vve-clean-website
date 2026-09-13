import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowRight, Camera, Images, Play, ScanLine } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import GalleryResultCard from '../components/gallery/GalleryResultCard';
import GalleryInstagramCta from '../components/gallery/GalleryInstagramCta';
import PhotoLightbox from '../components/gallery/PhotoLightbox';
import MobileStickyFooter from '../components/MobileStickyFooter';
import { toLightboxPhotos, useLightbox } from '../components/gallery/useLightbox';
import { GALLERY_CATEGORIES, GALLERY_MEDIA, type GalleryCategory, type GalleryItem } from '../data/galleryMedia';
import { useManagedGalleryMedia } from '../lib/managedGalleryMedia';

function isGalleryCategory(value: string | null): value is GalleryCategory {
  return !!value && GALLERY_CATEGORIES.some((category) => category.key === value);
}

const SERVICE_LINKS: Record<GalleryCategory, { href: string; label: string; description: string }> = {
  'end-of-tenancy': {
    href: '/end-of-tenancy-cleaning-london#quote', label: 'Get an end of tenancy quote',
    description: 'Kitchens, bathrooms and the smaller details of an end of tenancy clean.',
  },
  carpet: {
    href: '/carpet-cleaning-london#quote', label: 'Get a carpet quote',
    description: 'Carpet cleaning in progress, with paired photos to compare the condition.',
  },
  'sofa-upholstery': {
    href: '/sofa-cleaning-london#quote', label: 'Get a sofa quote',
    description: 'Sofas, chairs and upholstery, photographed before, during and after cleaning.',
  },
};

const FORMATS = [
  { key: 'all', label: 'All results', icon: Images },
  { key: 'before-after', label: 'Comparisons', icon: ScanLine },
  { key: 'photo', label: 'Photos', icon: Camera },
  { key: 'video', label: 'Videos', icon: Play },
] as const;
type GalleryFormat = (typeof FORMATS)[number]['key'];
function isGalleryFormat(value: string | null): value is GalleryFormat {
  return FORMATS.some((format) => format.key === value);
}

const FEATURE_GUIDE = {
  'before-after': { label: 'Photo comparison', title: 'Compare the detail', description: 'Open either photo for a closer look. The labels show the stage of the clean.' },
  photo: { label: 'From the collection', title: 'See the full photo', description: 'Tap the image to enlarge it, then browse the rest using the arrows.' },
  video: { label: 'Cleaning on film', title: 'Watch the clean', description: 'Press play to watch. You control playback, sound and full screen.' },
};

export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const fromQuery = searchParams.get('category');
  const fromHash = hash.replace(/^#/, '');
  const active: GalleryCategory = isGalleryCategory(fromQuery) ? fromQuery
    : isGalleryCategory(fromHash) ? fromHash : GALLERY_CATEGORIES[0].key;
  const fromFormat = searchParams.get('type');
  const format: GalleryFormat = isGalleryFormat(fromFormat) ? fromFormat : 'all';
  const managedMedia = useManagedGalleryMedia();
  const [visibleCount, setVisibleCount] = useState(20);
  const { index, open, close, setIndex } = useLightbox();

  // URL-derived selection also handles back/forward and legacy hash links.
  useEffect(() => {
    setVisibleCount(20);
    setIndex(null);
  }, [active, format, setIndex]);

  const selectCategory = (category: GalleryCategory) => {
    const next = new URLSearchParams(searchParams);
    next.set('category', category);
    next.delete('type');
    setSearchParams(next, { replace: true });
  };
  const selectFormat = (key: GalleryFormat) => {
    const next = new URLSearchParams(searchParams);
    next.set('category', active);
    if (key === 'all') next.delete('type');
    else next.set('type', key);
    setSearchParams(next, { replace: true });
  };
  const onTabKeyDown = (event: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % GALLERY_CATEGORIES.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + GALLERY_CATEGORIES.length) % GALLERY_CATEGORIES.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = GALLERY_CATEGORIES.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = GALLERY_CATEGORIES[nextIndex];
    selectCategory(next.key);
    tabRefs.current[next.key]?.focus();
  };

  // Published CRM positions still lead, in their approved order. Local media
  // remain the fallback; no asset, pairing or service-page source is replaced.
  const items = useMemo(() => [...managedMedia[active], ...GALLERY_MEDIA[active]], [managedMedia, active]);
  const filtered = useMemo(() => items.filter((item) => format === 'all' || item.type === format), [items, format]);
  const lightboxPhotos = useMemo(() => toLightboxPhotos(filtered), [filtered]);
  const activeMeta = GALLERY_CATEGORIES.find((category) => category.key === active)!;
  const service = SERVICE_LINKS[active];
  const featured = filtered[0];

  const photoIndex = (id: string, side?: 'before' | 'after') => {
    let result = 0;
    for (const item of filtered) {
      if (item.type === 'video') continue;
      if (item.id === id) return result + (side === 'after' ? 1 : 0);
      result += item.type === 'before-after' ? 2 : 1;
    }
    return 0;
  };
  const card = (item: GalleryItem, eager = false) => (
    <GalleryResultCard key={item.id} item={item} category={active} eager={eager}
      onOpen={(side, origin) => open(photoIndex(item.id, side), origin)} />
  );

  return (
    <div className="mobile-page-bottom min-h-screen bg-surface lg:pb-0">
      <Navbar />
      <main id="main-content">
        <header className="bg-navy-950 px-4 pb-7 pt-24 text-white sm:pb-12 sm:pt-32">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200"><Camera size={17} aria-hidden="true" /> Our work, up close</p>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">VVE Clean Gallery</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver-300 sm:mt-4 sm:text-lg">Before-and-after photos and cleaning in progress, all from our own jobs.</p>
              </div>
              <a href="#gallery-collection" className="hidden min-h-11 items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 sm:inline-flex">Browse the collection <ArrowDown size={17} aria-hidden="true" /></a>
            </div>
          </div>
        </header>

        <section id="gallery-collection" aria-label="Cleaning photo and video collection" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-14 pt-6 sm:pt-8">
          <div role="tablist" aria-label="Gallery categories" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2">
            {GALLERY_CATEGORIES.map((category, categoryIndex) => {
              const selected = category.key === active;
              const count = managedMedia[category.key].length + GALLERY_MEDIA[category.key].length;
              return (
                <button key={category.key} ref={(element) => { tabRefs.current[category.key] = element; }} type="button"
                  role="tab" id={`gallery-tab-${category.key}`} aria-label={category.label} aria-selected={selected}
                  aria-controls={`gallery-panel-${category.key}`} tabIndex={selected ? 0 : -1}
                  onClick={() => selectCategory(category.key)} onKeyDown={(event) => onTabKeyDown(event, categoryIndex)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs font-semibold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:min-h-12 sm:flex-row sm:justify-between sm:gap-3 sm:px-4 sm:text-left sm:text-sm ${selected ? 'bg-royal-500 text-white shadow-sm' : 'text-ink hover:bg-sky-50'}`}>
                  {category.label}<span aria-hidden="true" className={`hidden min-w-7 rounded-full px-2 py-0.5 text-center text-xs sm:inline ${selected ? 'bg-white/15 text-white' : 'bg-surface text-muted'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`gallery-panel-${active}`} aria-labelledby={`gallery-tab-${active}`} tabIndex={0} className="pt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600 sm:pt-8">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6 sm:flex-wrap sm:items-end sm:gap-5">
              <div>
                <h2 className="font-display text-xl font-bold text-ink sm:text-3xl">{activeMeta.label}</h2>
                <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-muted sm:block">{service.description}</p>
              </div>
              <p role="status" aria-live="polite" className="shrink-0 text-xs font-medium text-muted sm:text-sm">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</p>
            </div>

            <div role="group" aria-label="Filter gallery by media type" className="mb-5 flex flex-wrap gap-1.5 sm:mb-6 sm:gap-2">
              {FORMATS.map(({ key, label, icon: Icon }) => {
                const count = key === 'all' ? items.length : items.filter((item) => item.type === key).length;
                if (count === 0 && key !== 'all' && key !== format) return null;
                return <button key={key} type="button" aria-label={`${label} (${count})`} aria-pressed={format === key} onClick={() => selectFormat(key)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:gap-2 sm:px-3.5 sm:text-sm ${format === key ? 'border-navy-950 bg-navy-950 text-white' : 'border-line bg-white text-muted hover:border-royal-500 hover:text-royal-700'}`}>
                  <Icon size={15} aria-hidden="true" className="hidden sm:block" />{key === 'all' ? <><span className="sm:hidden">All</span><span className="hidden sm:inline">{label}</span></> : label}<span className={format === key ? 'text-sky-200' : 'text-muted'}>{count}</span>
                </button>;
              })}
            </div>

            {featured ? (
              <>
                <div className="mb-6 grid items-center gap-6 rounded-[1.5rem] border border-sky-200 bg-sky-50 p-3 sm:p-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-8">
                  <div className="min-w-0">{card(featured, true)}</div>
                  <div className="px-2 pb-3 lg:py-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-royal-700">{FEATURE_GUIDE[featured.type].label}</p>
                    <h3 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">{FEATURE_GUIDE[featured.type].title}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{FEATURE_GUIDE[featured.type].description}</p>
                    <Link to={service.href} className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-royal-700 underline decoration-sky-300 underline-offset-4 hover:decoration-royal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600">{service.label}<ArrowRight size={17} aria-hidden="true" /></Link>
                  </div>
                </div>
                <div className="grid items-start gap-6 sm:grid-cols-2">
                  {filtered.slice(1, visibleCount).map((item) => card(item))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
                <Camera size={30} className="mx-auto mb-4 text-royal-600" aria-hidden="true" />
                <p className="font-medium text-ink">{format === 'all' ? `There are no published ${activeMeta.label.toLowerCase()} photos in this collection yet. You can still read about the service and request a quote.` : `There are no ${FORMATS.find((entry) => entry.key === format)!.label.toLowerCase()} in this collection yet.`}</p>
                {format !== 'all' && <button type="button" onClick={() => selectFormat('all')} className="mt-4 min-h-11 rounded-full bg-royal-500 px-5 py-2.5 font-semibold text-white">Show all results</button>}
                <Link to={service.href} className="mt-4 block min-h-11 py-2.5 font-semibold text-royal-700 underline">{service.label}</Link>
              </div>
            )}
            {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount((value) => value + 20)} className="mx-auto mt-8 flex min-h-12 items-center gap-2 rounded-full border-2 border-royal-500 bg-white px-6 py-3 font-semibold text-royal-700 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600">Show more results ({filtered.length - visibleCount} remaining)<ArrowDown size={17} aria-hidden="true" /></button>}
            <p className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-muted">These photos show individual cleans. Results depend on the material, its condition and the marks being treated.</p>
          </div>

          <aside className="mt-10 rounded-[1.5rem] border border-line bg-white px-5 py-8 text-center sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-royal-700">More from VVE Clean</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink">Follow the next job</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">See more cleaning photos on our social pages, or read our customer reviews.</p>
            <GalleryInstagramCta galleryCategory={active} showGalleryLink={false} showAllNetworks />
          </aside>
        </section>
      </main>
      <Footer />
      <MobileStickyFooter />
      <PhotoLightbox photos={lightboxPhotos} index={index} onClose={close} onNavigate={setIndex} label={`${activeMeta.label} photos`} />
    </div>
  );
}
