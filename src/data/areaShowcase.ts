import { CARPET_RESULT_VIDEOS, type CarpetVideo } from './carpetMedia';
import { SOFA_VIDEOS } from './sofaMedia';

export interface AreaShowcaseVideo {
  id: string;
  service: 'Carpet cleaning' | 'Sofa & upholstery';
  label: string;
  src: string;
  poster: string;
  description: string;
}

const CARPET_POOL: AreaShowcaseVideo[] = CARPET_RESULT_VIDEOS.map((video: CarpetVideo) => ({
  id: video.id,
  service: 'Carpet cleaning',
  label: video.label,
  src: video.src,
  poster: video.poster,
  description: video.description,
}));

const SOFA_POOL: AreaShowcaseVideo[] = SOFA_VIDEOS.map((video) => ({
  id: video.id,
  service: 'Sofa & upholstery',
  label: video.label,
  src: video.src,
  poster: video.poster,
  description: video.description ?? video.label,
}));

function hashSeed(seed: string): number {
  let hash = 5381;
  for (const character of seed) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return hash >>> 0;
}

/** Deterministic for an area and selection key. One clip comes from each of
 * two different services so the section never looks like a carpet-only page. */
export function selectAreaShowcaseVideos(areaSlug: string, selectionKey: string): AreaShowcaseVideo[] {
  if (CARPET_POOL.length === 0 || SOFA_POOL.length === 0) return [];
  const hash = hashSeed(`${areaSlug}:${selectionKey}`);
  return [
    CARPET_POOL[hash % CARPET_POOL.length],
    SOFA_POOL[Math.floor(hash / 13) % SOFA_POOL.length],
  ];
}

// A fixed key keeps the prerendered HTML and client navigation identical, even
// when a visitor opens the page on a later day than the build.
export function getAreaShowcaseVideos(areaSlug: string): AreaShowcaseVideo[] {
  return selectAreaShowcaseVideos(areaSlug, 'published');
}
