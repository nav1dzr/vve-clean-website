import type { GalleryItem } from '../../data/galleryMedia';
import BeforeAfterTile from '../gallery/BeforeAfterTile';
import { useManagedPageMedia } from '../../lib/managedGalleryMedia';

// Service pages consume configurable page references rather than their own
// copies of Gallery media. `carpet-main-results`, for example, resolves the
// selected Carpet BA01–BA03 and VIDEO01–VIDEO02 positions at runtime.
export default function ManagedServiceMedia({ pageKey, dark = false }: { pageKey: string; dark?: boolean }) {
  const items = useManagedPageMedia(pageKey);
  if (!items.length) return null;
  const headingColor = dark ? 'text-white' : 'text-navy-900';
  const copyColor = dark ? 'text-silver-300' : 'text-slate-500';
  return <div className="mb-10"><h3 className={`text-center font-display text-2xl font-bold ${headingColor}`}>Featured gallery results</h3><p className={`mt-2 text-center text-sm ${copyColor}`}>Selected from the VVE Clean Gallery.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <MediaTile key={item.id} item={item} dark={dark} />)}</div></div>;
}

function MediaTile({ item, dark }: { item: GalleryItem; dark: boolean }) {
  const background = dark ? 'bg-navy-900' : 'bg-silver-100';
  if (item.type === 'before-after') return <BeforeAfterTile entry={item} placeholderLabel={item.label} />;
  if (item.type === 'video') return <figure className={`overflow-hidden rounded-2xl ${background}`}><iframe className="aspect-video w-full" src={item.playerUrl || item.src} title={item.description || item.label} loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen /><figcaption className={`p-3 text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.label}</figcaption></figure>;
  return <figure className={`overflow-hidden rounded-2xl ${background}`}><img src={item.src} srcSet={item.srcSet} sizes={item.sizes} alt={item.alt} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" /><figcaption className={`p-3 text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.label}</figcaption></figure>;
}
