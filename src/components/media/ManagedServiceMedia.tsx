import type { GalleryItem } from '../../data/galleryMedia';
import { useManagedPlacementMedia } from '../../lib/managedGalleryMedia';

export default function ManagedServiceMedia({ placement, dark = false }: { placement: string; dark?: boolean }) {
  const items = useManagedPlacementMedia(placement);
  if (!items.length) return null;
  const headingColor = dark ? 'text-white' : 'text-navy-900';
  const copyColor = dark ? 'text-silver-300' : 'text-slate-500';
  return <div className="mb-10"><h3 className={`text-center font-display text-2xl font-bold ${headingColor}`}>Latest results</h3><p className={`mt-2 text-center text-sm ${copyColor}`}>Newly added work from VVE Clean.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <MediaTile key={item.id} item={item} dark={dark} />)}</div></div>;
}

function MediaTile({ item, dark }: { item: GalleryItem; dark: boolean }) {
  const background = dark ? 'bg-navy-900' : 'bg-silver-100';
  if (item.type === 'video') return <figure className={`overflow-hidden rounded-2xl ${background}`}><iframe className="aspect-video w-full" src={item.playerUrl || item.src} title={item.description || item.label} loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen /><figcaption className={`p-3 text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.label}</figcaption></figure>;
  if (item.type === 'photo') return <figure className={`overflow-hidden rounded-2xl ${background}`}><img src={item.src} srcSet={item.srcSet} sizes={item.sizes} alt={item.alt} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" /><figcaption className={`p-3 text-sm font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>{item.label}</figcaption></figure>;
  return null;
}
