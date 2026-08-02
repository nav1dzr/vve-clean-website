// Carpet-cleaning video manifest.
//
// All four clips are real job footage from the owner's camera roll. The
// originals are 4K HEVC 10-bit HDR (BT.2020 / HLG) in QuickTime containers,
// 23–38 MB each — unplayable in Chrome and Firefox and far too heavy for the
// web. Each was transcoded once, offline, to H.264 MP4 (BT.709 SDR, faststart,
// audio stripped since the page always plays muted) at roughly 1.6–2.3 MB.
// Originals are untouched and stay out of the repo.
// See docs/CARPET_MEDIA_STATUS.md for the exact commands.
//
// Three sources carry a -90° display matrix and are therefore portrait; those
// sit beside the before/after cards. The one landscape source drives the wider
// process section, which is why CARPET_PROCESS_VIDEO is separate.

export interface CarpetVideo {
  id: string;
  /** Short caption shown under the clip. */
  label: string;
  /** MP4 (H.264) source — required. */
  src: string;
  /** Optional WebM source, offered first when present. */
  webm?: string;
  /** Poster frame. Required: prevents a black box before playback starts. */
  poster: string;
  /** Describes the clip for people who cannot see it. */
  description: string;
  /**
   * Pairs the clip with a before/after card by that card's id. Clips without a
   * pairing are available for the wider process section.
   */
  pairedWith?: string;
}

/**
 * Clips shown beneath the matching before/after result cards.
 *
 * Captions describe what each clip actually shows rather than claiming it is
 * the same room as the card above it — only carpet-2 is filmed on the same job
 * as its card (the blue carpet), and overstating the other two would be the
 * kind of thing a customer can spot.
 */
export const CARPET_RESULT_VIDEOS: CarpetVideo[] = [
  {
    id: 'carpet-stairs',
    label: 'Stair carpet, tread by tread',
    src: '/carpet/video/web/carpet-1.mp4',
    poster: '/carpet/video/web/carpet-1-poster.jpg',
    description:
      'A VVE Clean technician working a hand extraction tool down a flight of stair carpet, one tread at a time, with the machine hose running behind them.',
    pairedWith: 'carpet-office',
  },
  {
    id: 'carpet-blue-clean',
    label: 'Hot-water extraction on the blue carpet',
    src: '/carpet/video/web/carpet-2.mp4',
    poster: '/carpet/video/web/carpet-2-poster.jpg',
    description:
      'An extraction wand drawn across the blue carpet from the card above, leaving a clean stripe behind it as the soiling and debris lift out.',
    pairedWith: 'carpet-blue',
  },
  {
    id: 'carpet-bedroom-pass',
    label: 'Cleaning a bedroom carpet',
    src: '/carpet/video/web/carpet-3.mp4',
    poster: '/carpet/video/web/carpet-3-poster.jpg',
    description:
      'An extraction wand pulled through a grey bedroom carpet, laying a clean stripe through the pile beside a chest of drawers.',
    pairedWith: 'carpet-brown',
  },
];

/** The wider "equipment in action" clip, shown in the process section. */
export const CARPET_PROCESS_VIDEO: CarpetVideo | null = {
  id: 'carpet-process',
  label: 'Hot-water extraction in action',
  src: '/carpet/video/web/carpet-4.mp4',
  poster: '/carpet/video/web/carpet-4-poster.jpg',
  description:
    'A VVE Clean technician in branded uniform drawing a professional extraction wand across a blue carpet, each pass leaving a visibly cleaner stripe.',
};
