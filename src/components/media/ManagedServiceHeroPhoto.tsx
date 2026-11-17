import type { ReactNode } from 'react';
import type { GalleryCategory } from '../../data/galleryMedia';
import { useManagedServiceHeroMedia } from '../../lib/managedGalleryMedia';
import ServiceHeroPhoto from '../ServiceHeroPhoto';
import { useWebsiteMediaPosition } from '../../lib/websiteMediaPositions';

/** Position one supplies a still image; clips stay in the results/gallery. */
export default function ManagedServiceHeroPhoto({ service, fallback, detail, managedDetail }: {
  service: GalleryCategory;
  fallback: { src: string; alt: string; caption: string };
  detail?: ReactNode;
  managedDetail?: ReactNode;
}) {
  const item = useManagedServiceHeroMedia(service);
  const named = useWebsiteMediaPosition(`service-${service === 'sofa-upholstery' ? 'sofa' : service}-hero`, null);
  const selected = named ?? item;
  const photo = selected?.type === 'photo'
    ? { src: selected.src, srcSet: selected.srcSet, alt: selected.alt, caption: selected.label }
    : selected?.type === 'before-after'
      ? { src: selected.after, alt: selected.afterAlt, caption: selected.label }
      : null;
  return <ServiceHeroPhoto
    {...(photo ?? fallback)}
    fallback={fallback}
    detail={photo ? managedDetail ?? detail : detail}
  />;
}
