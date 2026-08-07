import BeforeAfterTile from './BeforeAfterTile';
import VideoTile from './VideoTile';
import { GALLERY_MEDIA, type GalleryItem, type GalleryVideoItem } from '../../data/galleryMedia';
import { CARPET_RESULT_VIDEOS, CARPET_PROCESS_VIDEO, type CarpetVideo } from '../../data/carpetMedia';

const DEFAULT_MEDIA: GalleryItem[] = Object.values(GALLERY_MEDIA).flat();
const DEFAULT_CARPET_CLIPS: CarpetVideo[] = [
  ...CARPET_RESULT_VIDEOS,
  ...(CARPET_PROCESS_VIDEO ? [CARPET_PROCESS_VIDEO] : []),
];

function carpetVideoToGalleryItem(clip: CarpetVideo): GalleryVideoItem {
  return {
    type: 'video',
    id: clip.id,
    label: clip.label,
    src: clip.src,
    poster: clip.poster,
    description: clip.description,
  };
}

function matchesArea(location: string | undefined, needles: string[]): boolean {
  if (!location) return false;
  const haystack = location.toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

/**
 * Collects every gallery item and carpet clip whose real `location` matches
 * this area's name or one of its postcodes. `media`/`carpetClips` default to
 * the live manifests and only need overriding in tests.
 *
 * Nothing here invents a location: an item with no `location` set never
 * matches, so an area with no tagged jobs today returns an empty array —
 * exactly what happens across all 15 areas until real jobs are tagged.
 */
export function collectAreaJobs(
  areaName: string,
  postcodes: string[],
  media: GalleryItem[] = DEFAULT_MEDIA,
  carpetClips: CarpetVideo[] = DEFAULT_CARPET_CLIPS,
): GalleryItem[] {
  const needles = [areaName, ...postcodes];
  const galleryMatches = media.filter((item) => matchesArea(item.location, needles));
  const carpetMatches = carpetClips
    .filter((clip) => matchesArea(clip.location, needles))
    .map(carpetVideoToGalleryItem);
  return [...galleryMatches, ...carpetMatches];
}

export interface RecentJobsByAreaProps {
  areaName: string;
  postcodes: string[];
}

/**
 * Renders real, area-tagged job photos/clips for an area page. Renders
 * nothing when there are none — this section must never show a placeholder
 * that implies a local job that hasn't actually happened.
 */
export default function RecentJobsByArea({ areaName, postcodes }: RecentJobsByAreaProps) {
  const items = collectAreaJobs(areaName, postcodes);
  if (items.length === 0) return null;

  return (
    <div className="mt-10">
      <h3 className="font-display text-xl md:text-2xl font-bold text-navy-900 mb-4">
        Recent jobs in {areaName}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          if (item.type === 'before-after') {
            return <BeforeAfterTile key={item.id} entry={item} placeholderLabel={item.label} />;
          }
          if (item.type === 'video') {
            return <VideoTile key={item.id} entry={item} placeholderLabel={item.label} />;
          }
          return (
            <figure
              key={item.id}
              className="rounded-2xl overflow-hidden border border-silver-200 shadow-sm bg-silver-50"
            >
              <img
                src={item.src}
                alt={item.alt}
                width={600}
                height={450}
                loading="lazy"
                decoding="async"
                className="w-full aspect-[4/3] object-contain block bg-navy-950"
              />
              <figcaption className="text-center text-sm font-semibold text-navy-800 py-3 px-4">
                {item.label}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
