import eotGalleryImages from 'virtual:eot-gallery';
// sofaMedia imports only *types* back from this file, and `import type` is
// erased before bundling, so this pair never forms a runtime cycle.
import { SOFA_MEDIA } from './sofaMedia';
import { CARPET_PROCESS_VIDEO, CARPET_RESULT_VIDEOS } from './carpetMedia';

// Central media manifest for the routed Gallery page (and the
// source of truth the End of Tenancy landing page draws its real before/
// after cards and rotating results photos from). Approved before/after pairs
// remain explicit. The dedicated EOT gallery folder is discovered at build
// time so the owner can replace its contents without editing this file; only
// the first 15 supported image files are published.
//
// All three categories are now populated with owner-approved sets. The Sofa &
// Upholstery definitions live in ./sofaMedia and are imported below rather than
// inlined: that set alone is 4 before/after pairs, 11 photos and 4 clips, which
// would otherwise bury the other two categories in this file.

export type GalleryCategory = 'end-of-tenancy' | 'carpet' | 'sofa-upholstery';

export interface GalleryCategoryMeta {
  key: GalleryCategory;
  label: string;
}

export const GALLERY_CATEGORIES: GalleryCategoryMeta[] = [
  { key: 'end-of-tenancy', label: 'End of Tenancy' },
  { key: 'carpet', label: 'Carpet' },
  { key: 'sofa-upholstery', label: 'Sofa & Upholstery' },
];

export interface GalleryBeforeAfterItem {
  type: 'before-after';
  id: string;
  label: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  /**
   * Overrides for the two side badges and their lightbox captions. Both default
   * to 'Before' / 'After' — every Carpet and End of Tenancy pair, and three of
   * the four Sofa pairs, leave them unset and are unaffected.
   *
   * They exist for a pair whose second photograph is not a finished result: one
   * Sofa card was shot mid-extraction, and calling that "After" would claim a
   * dried, completed clean the photograph does not show.
   */
  beforeLabel?: string;
  afterLabel?: string;
  /**
   * The real area this job was done in (e.g. 'Islington, N1'), used to surface
   * the photo on that area's landing page. Omit unless the area is actually
   * known — never guessed from a filename or assumed from the owner's usual
   * coverage. See RecentJobsByArea.
   */
  location?: string;
}

export interface GalleryPhotoItem {
  type: 'photo';
  id: string;
  label: string;
  src: string;
  alt: string;
  /** See GalleryBeforeAfterItem.location. */
  location?: string;
}

export interface GalleryVideoItem {
  type: 'video';
  id: string;
  label: string;
  src: string;
  poster: string;
  /** Describes the clip for people who cannot see it. Falls back to `label`. */
  description?: string;
  /** See GalleryBeforeAfterItem.location. */
  location?: string;
}

export type GalleryItem = GalleryBeforeAfterItem | GalleryPhotoItem | GalleryVideoItem;

const EOT_BEFORE_AFTER: GalleryBeforeAfterItem[] = [
  {
    type: 'before-after',
    id: 'eot-hob',
    label: 'Kitchen hob',
    before: '/end_of_tenancy/before-after/kitchen1_before.jpg',
    after: '/end_of_tenancy/before-after/kitchen1_after.jpg',
    beforeAlt: 'Induction hob before cleaning, with visible marks across the glass surface',
    afterAlt: 'The same induction hob after cleaning, with the glass surface visibly clearer',
  },
  {
    type: 'before-after',
    id: 'eot-oven',
    label: 'Oven',
    before: '/end_of_tenancy/before-after/oven_cleaning_before.jpg',
    after: '/end_of_tenancy/before-after/oven_cleaning_after.jpg',
    beforeAlt: 'Oven door and racks before cleaning, with visible baked-on residue',
    afterAlt: 'The same oven interior, racks and door glass after cleaning',
  },
  {
    type: 'before-after',
    id: 'eot-shower',
    label: 'Shower',
    before: '/end_of_tenancy/before-after/shower_before.jpg',
    after: '/end_of_tenancy/before-after/shower_after.jpg',
    beforeAlt: 'Shower screen seal before cleaning, with visible staining along the edge',
    afterAlt: 'The same shower and bath area after cleaning',
  },
];

// Known files keep tailored labels and alt text. New filenames are still
// published safely with a neutral, numbered description until copy is added.
const EOT_GALLERY_DETAILS: Record<string, { label: string; alt: string }> = {
  '1.jpg': { label: 'Kitchen sink', alt: 'Black kitchen sink and drainer during an end of tenancy clean' },
  '2.jpg': { label: 'Hob burner caps', alt: 'Gas hob burner caps removed during deep cleaning' },
  '3.jpg': { label: 'Hob burner caps', alt: 'Gas hob burner caps after cleaning' },
  '4.jpg': { label: 'Mirrored cabinet', alt: 'Mirrored cabinet photographed after cleaning' },
  '5.jpg': { label: 'Fridge interior', alt: 'Empty fridge interior photographed after cleaning' },
  '6.jpg': { label: 'Oven door glass', alt: 'Open oven door and inner glass photographed after cleaning' },
  '7.jpg': { label: 'Shower and bath corner', alt: 'Bath corner and shower screen frame photographed after cleaning' },
  '8.jpg': { label: 'Kitchen floor', alt: 'Tiled kitchen floor photographed after cleaning' },
  '9.jpg': { label: 'Shower and bath area', alt: 'Bath and shower screen area photographed after cleaning' },
  '10.jpg': { label: 'Shower screen', alt: 'Shower screen and fittings photographed after cleaning' },
  '11.jpg': { label: 'Kitchen cabinet', alt: 'Before and after comparison of a kitchen cabinet under the sink — before on the left and after on the right' },
  '12.jpg': { label: 'Kitchen sink', alt: 'Comparison of a kitchen sink — after on the left and before on the right' },
  '13.jpg': { label: 'Fridge interior', alt: 'Before and after comparison of a fridge interior — before on the left and after on the right' },
};

const EOT_PHOTOS: GalleryPhotoItem[] = eotGalleryImages.map((src, index) => {
  const filename = decodeURIComponent(src.split('/').pop() ?? `photo-${index + 1}`);
  const details = EOT_GALLERY_DETAILS[filename];
  return {
    type: 'photo',
    id: filename.replace(/\.[^.]+$/, ''),
    label: details?.label ?? `Cleaning result ${index + 1}`,
    src,
    alt: details?.alt ?? `End of tenancy cleaning result ${index + 1}`,
  };
});

// The three owner-approved carpet before/after pairs.
//
// Pairings are the owner's explicit mapping, not an alphabetical guess — note
// that the office "before" original is spelt `carper1_before.heic` while its
// "after" is `carpet1_after.png`, so filename order would have mismatched them.
//
// Every path below points at a derivative under /carpet/before-after/web/.
// Four of the six originals are .heic or .png, neither of which is safe to ship
// (.heic does not decode in Chrome or Firefox at all), so each was converted
// once, offline, to a ~1600px JPEG. The originals stay untouched outside the
// repo. See docs/CARPET_MEDIA_STATUS.md for the exact commands.
const CARPET_BEFORE_AFTER: GalleryBeforeAfterItem[] = [
  {
    type: 'before-after',
    id: 'carpet-office',
    label: 'Office carpet',
    before: '/carpet/before-after/web/carpet-office-before.jpg',
    after: '/carpet/before-after/web/carpet-office-after.jpg',
    beforeAlt:
      'Blue office carpet before cleaning, with dark traffic marks and spill stains spreading across the floor between the desks',
    afterAlt:
      'The same office carpet after hot-water extraction, the marks gone and the blue colour even across the whole floor',
  },
  {
    type: 'before-after',
    id: 'carpet-blue',
    label: 'Blue bedroom carpet',
    before: '/carpet/before-after/web/carpet-blue-before.jpg',
    after: '/carpet/before-after/web/carpet-blue-after.jpg',
    beforeAlt:
      'Blue carpet before cleaning, dulled and patchy with scattered debris and dark soiling across the pile',
    afterAlt:
      'The same blue carpet after cleaning, the debris lifted and the colour restored to a deep even blue',
  },
  {
    type: 'before-after',
    id: 'carpet-brown',
    label: 'Brown carpet',
    before: '/carpet/before-after/web/carpet-brown-before.jpg',
    after: '/carpet/before-after/web/carpet-brown-after.jpg',
    beforeAlt:
      'Brown carpet before cleaning, with heavy dark staining through the middle of the room and litter on the pile',
    afterAlt:
      'The same brown carpet after cleaning, the staining gone and the weave clean and uniform corner to corner',
  },
];

const CARPET_VIDEOS: GalleryVideoItem[] = [
  ...CARPET_RESULT_VIDEOS.map((video) => ({
    type: 'video' as const,
    id: video.id,
    label: video.label,
    src: video.src,
    poster: video.poster,
    description: video.description,
    location: video.location,
  })),
  ...(CARPET_PROCESS_VIDEO ? [{
    type: 'video' as const,
    id: CARPET_PROCESS_VIDEO.id,
    label: CARPET_PROCESS_VIDEO.label,
    src: CARPET_PROCESS_VIDEO.src,
    poster: CARPET_PROCESS_VIDEO.poster,
    description: CARPET_PROCESS_VIDEO.description,
    location: CARPET_PROCESS_VIDEO.location,
  }] : []),
];

/**
 * Alternates evidence types instead of publishing a long run of near-identical
 * cards. The original order inside each type is preserved, so approved pairings
 * and the owner's pinned media still lead their respective groups.
 */
export function organiseGalleryItems(items: GalleryItem[]): GalleryItem[] {
  const queues = {
    'before-after': items.filter((item) => item.type === 'before-after'),
    video: items.filter((item) => item.type === 'video'),
    photo: items.filter((item) => item.type === 'photo'),
  };
  const ordered: GalleryItem[] = [];
  while (queues['before-after'].length || queues.video.length || queues.photo.length) {
    for (const key of ['before-after', 'video', 'photo'] as const) {
      const item = queues[key].shift();
      if (item) ordered.push(item);
    }
  }
  return ordered;
}

export const GALLERY_MEDIA: Record<GalleryCategory, GalleryItem[]> = {
  'end-of-tenancy': organiseGalleryItems([...EOT_BEFORE_AFTER, ...EOT_PHOTOS]),
  carpet: organiseGalleryItems([...CARPET_BEFORE_AFTER, ...CARPET_VIDEOS]),
  'sofa-upholstery': organiseGalleryItems(SOFA_MEDIA),
};

/** The Carpet page's featured Before/After cards. */
export const CARPET_FEATURED_BEFORE_AFTER: GalleryBeforeAfterItem[] = CARPET_BEFORE_AFTER;

// The End of Tenancy page's featured Before/After cards — exactly the 3
// approved pairs, in this order.
export const EOT_FEATURED_BEFORE_AFTER: GalleryBeforeAfterItem[] = EOT_BEFORE_AFTER;

// The End of Tenancy page's rotating results photos — up to 15 files from
// the dedicated folder, in stable natural filename order (never shuffled).
export const EOT_ROTATING_PHOTOS: GalleryPhotoItem[] = EOT_PHOTOS;
