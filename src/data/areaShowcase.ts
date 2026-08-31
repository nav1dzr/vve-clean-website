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

/** Stable for a whole day, but varied by area. One clip comes from each of
 * two different services so the section never looks like a carpet-only page. */
export function selectAreaShowcaseVideos(areaSlug: string, dateKey: string): AreaShowcaseVideo[] {
  if (CARPET_POOL.length === 0 || SOFA_POOL.length === 0) return [];
  const hash = hashSeed(`${areaSlug}:${dateKey}`);
  return [
    CARPET_POOL[hash % CARPET_POOL.length],
    SOFA_POOL[Math.floor(hash / 13) % SOFA_POOL.length],
  ];
}

export function getAreaShowcaseVideos(areaSlug: string, date = new Date()): AreaShowcaseVideo[] {
  return selectAreaShowcaseVideos(areaSlug, date.toISOString().slice(0, 10));
}
