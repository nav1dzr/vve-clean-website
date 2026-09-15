import BeforeAfterTile from './BeforeAfterTile';
import VideoTile from './VideoTile';
import { GALLERY_MEDIA, type GalleryItem, type GalleryVideoItem } from '../../data/galleryMedia';
import { CARPET_RESULT_VIDEOS, CARPET_PROCESS_VIDEO, type CarpetVideo } from '../../data/carpetMedia';
import { matchesNamedArea } from '../../lib/areaMatch';

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

/**
 * Collects gallery items and carpet clips explicitly tagged with this area's
 * name. A postcode district can span several neighbourhoods and cannot prove
 * that a job took place in any one of them.
 *
 * Nothing here invents a location: an item with no `location` set never
 * matches, so an area with no tagged jobs today returns an empty array —
 * exactly what happens across all 15 areas until real jobs are tagged.
 */
export function collectAreaJobs(
  areaName: string,
  media: GalleryItem[] = DEFAULT_MEDIA,
  carpetClips: CarpetVideo[] = DEFAULT_CARPET_CLIPS,
): GalleryItem[] {
  const galleryMatches = media.filter((item) => matchesNamedArea(item.location, areaName));
  const carpetMatches = carpetClips
    .filter((clip) => matchesNamedArea(clip.location, areaName))
    .map(carpetVideoToGalleryItem);
  return [...galleryMatches, ...carpetMatches];
}

export interface RecentJobsByAreaProps {
  areaName: string;
}

/**
 * Renders real, area-tagged job photos/clips for an area page. Renders
 * nothing when there are none — this section must never show a placeholder
 * that implies a local job that hasn't actually happened.
 */
export default function RecentJobsByArea({ areaName }: RecentJobsByAreaProps) {
  const items = collectAreaJobs(areaName);
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
