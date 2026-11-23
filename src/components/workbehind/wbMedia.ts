import type { GalleryItem } from '../../data/galleryMedia';
import { useManagedServiceHeroMedia, useManagedWebsiteMedia } from '../../lib/managedGalleryMedia';
import { useWebsiteMediaPosition } from '../../lib/websiteMediaPositions';

export interface WbStill { src: string; srcSet?: string; alt: string }

const BASE = '/images/work-behind';
/** The concept's own job photographs, used until a CRM selection replaces them. */
export const WB_PHOTO = {
  heroWide: { src: `${BASE}/hero-action.webp`, alt: 'A VVE Clean technician in uniform pushing an extraction tool across a blue bedroom carpet, leaving clean stripes' },
  heroPhone: `${BASE}/hero-action-phone.webp`,
  blueBefore: { src: `${BASE}/blue-before.webp`, alt: 'The blue bedroom carpet before cleaning, dull and patchy with debris and dark soiling' },
  blueDuring: { src: `${BASE}/blue-during.webp`, alt: 'Close-up of the extraction tool on the blue carpet, spraying and lifting water' },
  blueAfter: { src: `${BASE}/blue-after.webp`, alt: 'The same blue carpet after cleaning, deep and even in colour with sunlight across it' },
  wasteWater: { src: `${BASE}/waste-water.webp`, alt: "Looking down into the extraction machine's tank, full of grey waste water" },
  jobStairs: { src: `${BASE}/job-stairs.webp`, alt: 'A VVE Clean technician cleaning a stair carpet with a hand tool' },
  jobSofa: { src: `${BASE}/job-sofa-hose.webp`, alt: 'A VVE Clean technician kneeling with the extraction hose beside a sofa with its cushions removed' },
  jobOven: { src: `${BASE}/job-oven.webp`, alt: 'An oven interior, racks and door glass after cleaning' },
  jobOffice: { src: `${BASE}/job-office.webp`, alt: 'An office with a dark blue carpet after cleaning' },
  van: { src: `${BASE}/van.webp`, alt: 'The VVE Clean van with extraction machine, vacuums and sprayers laid out beside it' },
} satisfies Record<string, WbStill | string>;

export const WB_PAIRS = {
  carpet: { title: 'Bedroom carpet', body: 'Heavy staining through the middle of the room, lifted by extraction.',
    before: { src: `${BASE}/brown-before.webp`, alt: 'Brown bedroom carpet before cleaning, heavily stained' },
    after: { src: `${BASE}/brown-after.webp`, alt: 'The same brown carpet after cleaning' } },
  sofa: { title: 'Corner sofa', body: 'A dark patch worn into the middle seat. The fabric is checked before treatment.',
    before: { src: `${BASE}/sofa-before.webp`, alt: 'Grey corner sofa before cleaning with a dark patch on the seat' },
    after: { src: `${BASE}/sofa-after.webp`, alt: 'The same grey corner sofa after cleaning' } },
  oven: { title: 'Oven', body: 'Baked-on residue on the door and racks. Cleaning does not repair scratches or wear.',
    before: { src: `${BASE}/oven-before.webp`, alt: 'Oven door and racks before cleaning with baked-on residue' },
    after: { src: `${BASE}/oven-after.webp`, alt: 'The same oven after cleaning' } },
  shower: { title: 'Shower screen', body: 'Staining along the seal, then the same bath and screen after cleaning.',
    before: { src: `${BASE}/shower-before.webp`, alt: 'Shower screen seal before cleaning with staining along the edge' },
    after: { src: `${BASE}/shower-after.webp`, alt: 'The same shower and bath area after cleaning' } },
};

function toStill(item: GalleryItem | null | undefined): WbStill | null {
  if (!item) return null;
  if (item.type === 'photo') return { src: item.src, srcSet: item.srcSet, alt: item.alt };
  if (item.type === 'before-after') return { src: item.after, alt: item.afterAlt };
  return null;
}

// A photo published from CRM Media for the same position still takes over, so
// "replace this photo" keeps working on the redesigned pages.
export function useHomeHeroPhoto(): WbStill | null {
  return toStill(useManagedWebsiteMedia('homepage-hero-image'));
}

export function useHomeServicePhoto(topic: 'end-of-tenancy' | 'sofa', fallback: WbStill): WbStill {
  const named = useWebsiteMediaPosition(`homepage-${topic}-image`, null);
  const service = useManagedServiceHeroMedia(topic === 'sofa' ? 'sofa-upholstery' : 'end-of-tenancy');
  return toStill(named ?? service) ?? fallback;
}

export function useEotHeroPhoto(fallback: WbStill): WbStill {
  const named = useWebsiteMediaPosition('service-end-of-tenancy-hero', null);
  const service = useManagedServiceHeroMedia('end-of-tenancy');
  return toStill(named ?? service) ?? fallback;
}

/** React 18 has no camelCase prop for this attribute; pass it through as-is. */
export const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>;
