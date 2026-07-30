// Central, explicit media manifest for the routed Gallery page (and the
// source of truth the End of Tenancy landing page draws its real before/
// after cards and rotating results photos from). Entries are listed by hand
// on purpose — nothing here auto-scans public/ folders, so unfinished or
// private files are never accidentally published.
//
// End of Tenancy is populated with the owner-approved photo set. Carpet and
// Sofa & Upholstery remain empty placeholders: the owner is still organising
// those folders, so nothing unapproved should be referenced here until a
// final set is supplied.

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

// Photos 1–10: real recent-clean photos used for the EOT page's rotating
// results area (in this fixed, numeric order — never shuffled) and shown
// again on the full Gallery page.
const EOT_PHOTOS: GalleryPhotoItem[] = [
  { type: 'photo', id: '1',  label: 'Kitchen sink',            src: '/end_of_tenancy/gallery/1.jpg',  alt: 'Black kitchen sink and drainer during an end of tenancy clean' },
  { type: 'photo', id: '2',  label: 'Hob burner caps',         src: '/end_of_tenancy/gallery/2.jpg',  alt: 'Gas hob burner caps removed during deep cleaning' },
  { type: 'photo', id: '3',  label: 'Hob burner caps',         src: '/end_of_tenancy/gallery/3.jpg',  alt: 'Gas hob burner caps after cleaning' },
  { type: 'photo', id: '4',  label: 'Mirrored cabinet',        src: '/end_of_tenancy/gallery/4.jpg',  alt: 'Mirrored cabinet photographed after cleaning' },
  { type: 'photo', id: '5',  label: 'Fridge interior',         src: '/end_of_tenancy/gallery/5.jpg',  alt: 'Empty fridge interior photographed after cleaning' },
  { type: 'photo', id: '6',  label: 'Oven door glass',         src: '/end_of_tenancy/gallery/6.jpg',  alt: 'Open oven door and inner glass photographed after cleaning' },
  { type: 'photo', id: '7',  label: 'Shower and bath corner',  src: '/end_of_tenancy/gallery/7.jpg',  alt: 'Bath corner and shower screen frame photographed after cleaning' },
  { type: 'photo', id: '8',  label: 'Kitchen floor',           src: '/end_of_tenancy/gallery/8.jpg',  alt: 'Tiled kitchen floor photographed after cleaning' },
  { type: 'photo', id: '9',  label: 'Shower and bath area',    src: '/end_of_tenancy/gallery/9.jpg',  alt: 'Bath and shower screen area photographed after cleaning' },
  { type: 'photo', id: '10', label: 'Shower screen',           src: '/end_of_tenancy/gallery/10.jpg', alt: 'Shower screen and fittings photographed after cleaning' },
];

// Photos 11–13 are already-combined before/after comparison images (both
// halves baked into one file), shown only on the full Gallery page — not in
// the single-photo rotating area. 12.jpg is the odd one out: After is on the
// left and Before is on the right.
const EOT_COMBINED_COMPARISONS: GalleryPhotoItem[] = [
  {
    type: 'photo',
    id: '11',
    label: 'Kitchen cabinet',
    src: '/end_of_tenancy/gallery/11.jpg',
    alt: 'Before and after comparison of a kitchen cabinet under the sink — before on the left and after on the right',
  },
  {
    type: 'photo',
    id: '12',
    label: 'Kitchen sink',
    src: '/end_of_tenancy/gallery/12.jpg',
    alt: 'Comparison of a kitchen sink — after on the left and before on the right',
  },
  {
    type: 'photo',
    id: '13',
    label: 'Fridge interior',
    src: '/end_of_tenancy/gallery/13.jpg',
    alt: 'Before and after comparison of a fridge interior — before on the left and after on the right',
  },
];

export const GALLERY_MEDIA: Record<GalleryCategory, GalleryItem[]> = {
  'end-of-tenancy': [...EOT_BEFORE_AFTER, ...EOT_PHOTOS, ...EOT_COMBINED_COMPARISONS],
  carpet: [],
  'sofa-upholstery': [],
};

// The End of Tenancy page's featured Before/After cards — exactly the 3
// approved pairs, in this order.
export const EOT_FEATURED_BEFORE_AFTER: GalleryBeforeAfterItem[] = EOT_BEFORE_AFTER;

// The End of Tenancy page's rotating results photos — exactly 1–10, in this
// fixed numeric order.
export const EOT_ROTATING_PHOTOS: GalleryPhotoItem[] = EOT_PHOTOS;
