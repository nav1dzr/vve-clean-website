import type { ReactNode } from 'react';
import type { GalleryCategory } from '../../data/galleryMedia';
import { useManagedServiceHeroMedia } from '../../lib/managedGalleryMedia';
import ServiceHeroPhoto from '../ServiceHeroPhoto';

/** Position one supplies a still image; clips stay in the results/gallery. */
export default function ManagedServiceHeroPhoto({ service, fallback, detail, managedDetail }: {
  service: GalleryCategory;
  fallback: { src: string; alt: string; caption: string };
  detail?: ReactNode;
  managedDetail?: ReactNode;
}) {
  const item = useManagedServiceHeroMedia(service);
  const photo = item?.type === 'photo'
    ? { src: item.src, srcSet: item.srcSet, alt: item.alt, caption: item.label }
    : item?.type === 'before-after'
      ? { src: item.after, alt: item.afterAlt, caption: item.label }
      : null;
  return <ServiceHeroPhoto
    {...(photo ?? fallback)}
    fallback={fallback}
    detail={photo ? managedDetail ?? detail : detail}
  />;
}
