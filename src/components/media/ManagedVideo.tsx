import { useViewportVideo } from './useViewportVideo';

/** Hosted controls are isolated in an iframe, so require an explicit Play gesture. */
export default function ManagedVideo({ playerUrl, poster, title }: {
  playerUrl: string;
  poster?: string;
  title: string;
}) {
  const playback = useViewportVideo(false);
  const url = new URL(playerUrl);
  // Mux embed parameters use the same names as Mux Player attributes. Muted
  // autoplay is a request: the embedded player's own controls remain available
  // when the browser declines. Keep adaptive streaming rather than assuming MP4.
  url.searchParams.set('autoplay', 'muted');
  url.searchParams.set('muted', 'true');
  url.searchParams.set('loop', 'true');
  url.searchParams.set('preload', 'none');
  url.searchParams.set('disable-tracking', 'true');
  url.searchParams.set('disable-cookies', 'true');
  url.searchParams.set('accent-color', '#0b83b5');

  return (
    <div ref={playback.ref} className="relative aspect-video overflow-hidden rounded-2xl bg-navy-950">
      {playback.play ? (
        <>
          <iframe src={url.toString()} title={title} className="h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          <button type="button" onClick={playback.pause} aria-label={`Stop ${title}`}
            className="absolute right-2 top-2 min-h-11 rounded-full bg-navy-950/90 px-3 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            Stop video
          </button>
        </>
      ) : (
        <button type="button" onClick={playback.requestPlay} aria-label={`Play ${title}`}
          className="relative h-full w-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-400">
          {poster && <img src={poster} alt="" width={640} height={360} loading="lazy" decoding="async" className="h-full w-full object-contain" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-navy-950">Play video</span>
          </span>
        </button>
      )}
    </div>
  );
}
