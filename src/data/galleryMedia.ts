// Central, explicit media manifest for the routed Gallery page.
// Entries are listed by hand on purpose — nothing here auto-scans public/
// folders, so unfinished or private files are never accidentally published.
// Add future before/after pairs, photos or short video clips here under the
// relevant category; each item's `type` decides how the Gallery page renders it.
//
// All three category arrays are intentionally empty right now. The owner is
// actively reorganising the underlying photo/video folders (old paths are
// being retired, new ones aren't finished yet), so this manifest must not
// reference any current or in-progress file — that would either break on the
// next reorg or publish media before the owner has approved it. Re-populate
// each array by hand once the owner supplies a final, approved set.

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
}

export interface GalleryPhotoItem {
  type: 'photo';
  id: string;
  label: string;
  src: string;
  alt: string;
}

export interface GalleryVideoItem {
  type: 'video';
  id: string;
  label: string;
  src: string;
  poster: string;
}

export type GalleryItem = GalleryBeforeAfterItem | GalleryPhotoItem | GalleryVideoItem;

export const GALLERY_MEDIA: Record<GalleryCategory, GalleryItem[]> = {
  'end-of-tenancy': [],
  carpet: [],
  'sofa-upholstery': [],
};
