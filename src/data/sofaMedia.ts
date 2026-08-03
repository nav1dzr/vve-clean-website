import type {
  GalleryBeforeAfterItem,
  GalleryPhotoItem,
  GalleryVideoItem,
} from './galleryMedia';

// Sofa & upholstery media manifest.
//
// Kept in its own file rather than inlined into galleryMedia.ts: this is the
// largest single set on the site (4 pairs + 11 photos + 4 clips) and it would
// otherwise bury the End of Tenancy and Carpet definitions. galleryMedia.ts
// imports SOFA_MEDIA, so the routed Gallery page and the Sofa landing page
// still read from one source.
//
// Every path points at a derivative under /sofa_upholstery/web/. The owner's
// originals are iPhone-native and never web-safe:
//   • 9 of the 19 photos are .heic — Chrome and Firefox cannot decode it at all
//   • all 4 clips are HEVC 10-bit HDR (BT.2020 / HLG) in QuickTime containers
// Each was converted once, offline; the originals stay untouched outside the
// repo. No .heic/.HEIC/.MOV path may ever reach rendered HTML — asserted in
// sofaMedia.test.ts.
//
// Before/after pairings are the owner's explicit mapping, NOT an alphabetical
// guess: `sofa_before.heic` pairs with `sofa_after.heic`, but `chair_before.heic`
// pairs with `chair_after.jpg` and `sofa2_before.heic` with `sofa2_after.png`.
// Sorting by filename would have mismatched the extensions.
//
// Alt text describes only what is visible in each frame. Where an "after" shot
// was taken mid-clean or from a different angle, the text says so rather than
// implying a like-for-like comparison the photograph does not actually show.

/** Intrinsic pixel dimensions, so a tile reserves its box before the file lands. */
export interface MediaDimensions {
  width: number;
  height: number;
}

export type SofaPhoto = GalleryPhotoItem & MediaDimensions;
export type SofaBeforeAfter = GalleryBeforeAfterItem & {
  beforeSize: MediaDimensions;
  afterSize: MediaDimensions;
};

const BA = '/sofa_upholstery/web/before-after';
const GA = '/sofa_upholstery/web/gallery';
const VI = '/sofa_upholstery/web/video';

export const SOFA_BEFORE_AFTER: SofaBeforeAfter[] = [
  {
    type: 'before-after',
    id: 'sofa-ba-seat',
    label: 'Fabric sofa seat',
    before: `${BA}/sofa-1-before.webp`,
    after: `${BA}/sofa-1-after.webp`,
    beforeAlt:
      'A taupe fabric sofa seat cushion before cleaning, marked with dark patches and the dried rings of old spills',
    afterAlt:
      'The same seat cushion after hot-water extraction, the rings and dark patches gone and the colour even across the cushion',
    beforeSize: { width: 1350, height: 1800 },
    afterSize: { width: 1350, height: 1800 },
  },
  {
    type: 'before-after',
    id: 'sofa-ba-corner',
    label: 'Grey corner sofa',
    before: `${BA}/sofa-2-before.webp`,
    after: `${BA}/sofa-2-after.webp`,
    beforeAlt:
      'A grey corner sofa before cleaning, with a large darkened patch worn into the middle of the chaise seat',
    afterAlt:
      'The same grey corner sofa after cleaning, photographed from the other end, the seat colour even throughout',
    beforeSize: { width: 1800, height: 1350 },
    afterSize: { width: 1088, height: 1445 },
  },
  {
    type: 'before-after',
    id: 'sofa-ba-seat-pad',
    label: 'Dining chair seat pad',
    before: `${BA}/chair-2-before.webp`,
    after: `${BA}/chair-2-after.webp`,
    beforeAlt:
      'A wooden dining chair with a beige linen seat pad before cleaning, dark soiling spread across the middle of the pad',
    afterAlt:
      'The same seat pad after cleaning, the soiling lifted and the weave back to an even oatmeal colour',
    beforeSize: { width: 1350, height: 1800 },
    afterSize: { width: 1350, height: 1800 },
  },
  {
    type: 'before-after',
    id: 'sofa-ba-buttoned-chair',
    // Not an "after" pair. The second photograph was taken mid-job: the hand
    // tool is still in frame and the fabric is visibly wet, so labelling it
    // "After" would present work in progress as a finished, dried result. The
    // card is titled and labelled for what it actually shows instead.
    label: 'Dining chair cleaning in progress',
    beforeLabel: 'Before cleaning',
    afterLabel: 'During extraction',
    before: `${BA}/chair-1-before.webp`,
    after: `${BA}/chair-1-after.webp`,
    beforeAlt:
      'The buttoned back of a grey upholstered chair before cleaning, the fabric dull and flecked with lint in direct sunlight',
    afterAlt:
      'The same chair back part-way through hot-water extraction — the hand tool is still on the fabric and the cleaned section is dark with moisture, not yet dry',
    beforeSize: { width: 1800, height: 1350 },
    afterSize: { width: 1200, height: 1600 },
  },
];

// Photo 01 is the owner's favourite and is pinned first everywhere it appears.
// Photos 02-11 may be shuffled — see useSofaGalleryOrder.
export const SOFA_PHOTOS: SofaPhoto[] = [
  {
    type: 'photo',
    id: 'sofa-gallery-01',
    label: 'Cleaning a velvet sofa',
    src: `${GA}/sofa-gallery-01.webp`,
    alt: 'A VVE Clean technician in branded uniform leaning over a navy velvet sofa mid-clean in a bright living room',
    width: 1800,
    height: 1350,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-02',
    label: 'Velvet sofa with cushions off',
    src: `${GA}/sofa-gallery-02.webp`,
    alt: 'A navy velvet sofa with its seat cushions removed, part-way through cleaning, the bare deck exposed',
    width: 1350,
    height: 1800,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-03',
    label: 'Extraction hose at work',
    src: `${GA}/sofa-gallery-03.webp`,
    alt: 'A VVE Clean technician kneeling with the blue extraction hose beside a taupe sofa stripped of its cushions',
    width: 1350,
    height: 1800,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-04',
    label: 'Oatmeal corner sofa',
    src: `${GA}/sofa-gallery-04.webp`,
    alt: 'A pale oatmeal corner sofa in a bright living room, cushions back in place after cleaning',
    width: 1800,
    height: 1350,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-05',
    label: 'Hand tool along an edge',
    src: `${GA}/sofa-gallery-05.webp`,
    alt: 'A technician drawing a hand extraction tool along the edge of a dark grey seat, machine hoses coiled on the floor behind',
    width: 1350,
    height: 1800,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-06',
    label: 'Red velvet three-seater',
    src: `${GA}/sofa-gallery-06.webp`,
    alt: 'A red velvet three-seater sofa with pale scatter cushions, photographed in a living room after cleaning',
    width: 1800,
    height: 1350,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-07',
    label: 'Green velvet sofa',
    src: `${GA}/sofa-gallery-07.webp`,
    alt: 'A deep green velvet sofa with striped scatter cushions, the pile brushed even after cleaning',
    width: 1800,
    height: 1350,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-08',
    label: 'Pale grey three-seater',
    src: `${GA}/sofa-gallery-08.webp`,
    alt: 'A technician working a hand extraction tool across the back of a pale grey three-seater sofa beside a patio door',
    width: 1600,
    height: 1200,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-09',
    label: 'Velvet sofa against brick',
    src: `${GA}/sofa-gallery-09.webp`,
    alt: 'A rust-red velvet sofa on a stripped pine floor against an exposed brick wall, photographed after cleaning',
    width: 1800,
    height: 1350,
  },
  {
    type: 'photo',
    id: 'sofa-gallery-10',
    label: 'Blue velvet, mid-clean',
    src: `${GA}/sofa-gallery-10.webp`,
    alt: 'A blue velvet bench seat and back being cleaned, the extraction tool part-way across the seat leaving a darker wet band',
    width: 1800,
    height: 1350,
  },
  // The owner's set also contained a white leather corner sofa (originally
  // random/11.jpg). It is deliberately NOT published: this page's own FAQ says
  // leather cleaning is not currently offered, so showing a leather sofa in the
  // results gallery would contradict the stated service scope. The original is
  // untouched in the source folder; only the derivative was dropped.
];

/**
 * The featured clip. It is the one that answers "does this actually do
 * anything?" — the waste water coming back out of the machine — so it leads the
 * proof section rather than sitting in the supporting grid.
 */
export const SOFA_FEATURE_VIDEO: GalleryVideoItem & { description: string } = {
  type: 'video',
  id: 'sofa-extraction-feature',
  label: 'What comes back out of the machine',
  src: `${VI}/sofa-extraction-feature.mp4`,
  poster: `${VI}/sofa-extraction-feature-poster.jpg`,
  description:
    'Dirty grey waste water pouring from the extraction machine’s outlet hose into a black bucket, thick with soil lifted out of the upholstery',
};

export const SOFA_SUPPORTING_VIDEOS: (GalleryVideoItem & { description: string })[] = [
  {
    type: 'video',
    id: 'sofa-cleaning-01',
    label: 'Cleaning a corduroy seat',
    src: `${VI}/sofa-cleaning-01.mp4`,
    poster: `${VI}/sofa-cleaning-01-poster.jpg`,
    description:
      'A hand extraction tool drawn across the seat of a pale corduroy sofa, leaving a clean damp stripe behind it, with towels laid on the floor',
  },
  {
    type: 'video',
    id: 'sofa-cleaning-02',
    label: 'Close-up on jumbo cord',
    src: `${VI}/sofa-cleaning-02.mp4`,
    poster: `${VI}/sofa-cleaning-02-poster.jpg`,
    description:
      'Close-up of a hand extraction tool worked down the ribbed back of a beige jumbo-cord sofa, the blue machine hose alongside',
  },
  {
    type: 'video',
    id: 'sofa-cleaning-03',
    label: 'Armchair cushion clean',
    src: `${VI}/sofa-cleaning-03.mp4`,
    poster: `${VI}/sofa-cleaning-03-poster.jpg`,
    description:
      'A technician in shoe covers cleaning a light grey armchair cushion with a hand extraction tool, the removed cushions stacked on a chair behind',
  },
];

export const SOFA_VIDEOS = [SOFA_FEATURE_VIDEO, ...SOFA_SUPPORTING_VIDEOS];

/** Everything, in page reading order — the shape the Gallery page consumes. */
export const SOFA_MEDIA = [...SOFA_BEFORE_AFTER, ...SOFA_PHOTOS, ...SOFA_VIDEOS];
