import { GALLERY_MEDIA, type GalleryBeforeAfterItem, type GalleryCategory } from './galleryMedia';
import { BEFORE_AFTER_PAIRS } from './services';

export interface HomepageProofPair {
  id: string;
  service: string;
  label: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
}

const SERVICE_LABELS: Record<GalleryCategory, string> = {
  'end-of-tenancy': 'End of tenancy',
  carpet: 'Carpet cleaning',
  'sofa-upholstery': 'Sofa & upholstery',
};

export const HOMEPAGE_CURATED_PROOF: HomepageProofPair[] = BEFORE_AFTER_PAIRS.map((pair, index) => ({
  id: `curated-${index + 1}`,
  service: pair.label,
  label: pair.label,
  before: pair.before,
  after: pair.after,
  beforeAlt: `${pair.label} before cleaning`,
  afterAlt: `${pair.label} after cleaning`,
}));

const curatedPaths = new Set(HOMEPAGE_CURATED_PROOF.flatMap((pair) => [pair.before, pair.after]));

const ROTATION_POOLS = (Object.keys(SERVICE_LABELS) as GalleryCategory[])
  .map((category) => ({
    category,
    items: GALLERY_MEDIA[category].filter(
      (item): item is GalleryBeforeAfterItem =>
        item.type === 'before-after'
        && item.afterLabel !== 'During extraction'
        && !curatedPaths.has(item.before)
        && !curatedPaths.has(item.after),
    ),
  }))
  .filter((pool) => pool.items.length > 0);

function hashDateKey(dateKey: string): number {
  let hash = 2166136261;
  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toHomepagePair(category: GalleryCategory, item: GalleryBeforeAfterItem): HomepageProofPair {
  return {
    id: `daily-${category}-${item.id}`,
    service: SERVICE_LABELS[category],
    label: item.label,
    before: item.before,
    after: item.after,
    beforeAlt: item.beforeAlt,
    afterAlt: item.afterAlt,
  };
}

/**
 * Returns two real result pairs from two different service categories. The
 * date seed keeps the choice stable for the whole day, which makes the page
 * feel fresh without changing under a visitor or making analytics/QA noisy.
 */
export function selectDailyHomepageProof(dateKey: string): HomepageProofPair[] {
  if (ROTATION_POOLS.length < 2) return [];

  const hash = hashDateKey(dateKey);
  const firstPoolIndex = hash % ROTATION_POOLS.length;
  const secondPoolIndex = (firstPoolIndex + 1 + (hash % (ROTATION_POOLS.length - 1))) % ROTATION_POOLS.length;
  const firstPool = ROTATION_POOLS[firstPoolIndex];
  const secondPool = ROTATION_POOLS[secondPoolIndex];

  const first = firstPool.items[hash % firstPool.items.length];
  const second = secondPool.items[Math.floor(hash / 17) % secondPool.items.length];

  return [
    toHomepagePair(firstPool.category, first),
    toHomepagePair(secondPool.category, second),
  ];
}

export function getHomepageProofPairs(date = new Date()): HomepageProofPair[] {
  const dateKey = date.toISOString().slice(0, 10);
  return [...HOMEPAGE_CURATED_PROOF, ...selectDailyHomepageProof(dateKey)];
}
