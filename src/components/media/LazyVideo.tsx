import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useViewportVideo } from './useViewportVideo';

export interface InlineVideo {
  src: string;
  webm?: string;
  poster: string;
  description: string;
  label?: string;
  playLabel?: string;
}

/** Shared native player: one visible clip, silent preview, user controls always. */
export default function LazyVideo({ video, className = '' }: { video: InlineVideo; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playback = useViewportVideo();
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const automaticPause = useRef(false);
  const playbackPosition = useRef(0);
  const playbackAllowed = useRef(false);
  const { load, play, manual, pause, requestPlay } = playback;
  playbackAllowed.current = play;

  useEffect(() => {
    const element = videoRef.current;
    return () => {
      playbackAllowed.current = false;
      automaticPause.current = true;
      if (element && !element.paused) element.pause();
    };
  }, []);

  useEffect(() => {
    setFailed(false);
    setBlocked(false);
    playbackPosition.current = 0;
  }, [video.src]);

  // Changing <source> children alone does not reliably update the selected
  // resource. load() starts selection, or aborts it after sources are removed.
  useEffect(() => {
    const element = videoRef.current;
    if (!element || (!load && !element.currentSrc)) return;
    automaticPause.current = true;
    element.load();
  }, [load, video.src, video.webm]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    let cancelled = false;
    if (!play) {
      automaticPause.current = true;
      if (!element.paused) element.pause();
      setPlaying(false);
      return;
    }
    automaticPause.current = false;
    // Never introduce sound as the visitor scrolls to another clip.
    if (!manual) element.muted = true;
    const result = element.play();
    result?.then(() => {
      if (cancelled) {
        // An older play promise must not pause a newer user-initiated play.
        if (!playbackAllowed.current) element.pause();
        return;
      }
      setBlocked(false);
      setPlaying(true);
    }).catch(() => {
      if (!cancelled) {
        setBlocked(true);
        pause();
      }
    });
    return () => { cancelled = true; };
  }, [play, load, manual, pause, video.src, video.webm]);

  return (
    <div ref={playback.ref} className={`relative overflow-hidden rounded-xl bg-navy-900 ${className}`}>
      <video ref={videoRef} poster={video.poster} muted loop playsInline
        autoPlay={play && !manual} preload="none" controls aria-label={video.description}
        onPlay={() => { setPlaying(true); setBlocked(false); if (!play) requestPlay(); }}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          if (playbackPosition.current > 0) {
            element.currentTime = Number.isFinite(element.duration)
              ? Math.min(playbackPosition.current, Math.max(0, element.duration - 0.1))
              : playbackPosition.current;
          }
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.readyState >= 1) playbackPosition.current = event.currentTarget.currentTime;
        }}
        onPause={(event) => {
          if (event.currentTarget.readyState >= 1) playbackPosition.current = event.currentTarget.currentTime;
          setPlaying(false);
          if (!automaticPause.current && play) pause();
        }}
        onError={() => { setFailed(true); pause(); }}
        className="block h-full w-full object-contain">
        {load && video.webm && <source src={video.webm} type="video/webm" />}
        {load && <source src={video.src} type="video/mp4" />}
      </video>
      {!playing && !failed && (
        <button type="button" onClick={requestPlay} aria-label={`Play ${video.playLabel || video.label || video.description}`}
          className="absolute left-1/2 top-1/2 inline-flex min-h-12 -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-sm font-semibold text-navy-950 shadow-lg hover:bg-sky-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
          <Play size={17} aria-hidden="true" fill="currentColor" />{blocked ? 'Tap to play' : 'Play video'}
        </button>
      )}
      {failed && <p role="status" className="absolute inset-x-3 top-3 rounded-lg bg-navy-950/90 p-3 text-sm text-white">This video could not load. Please try again later.</p>}
      {video.label && <span className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-navy-900/85 to-transparent px-3 pb-6 pt-2 text-xs font-semibold text-white">{video.label}</span>}
    </div>
  );
}
