// Performance-conscious inline video, shared by the Carpet and Sofa pages.
//
// (Previously src/components/carpet/LazyVideo.tsx. It moved here when the Sofa
// page picked it up — a sofa component importing from ../carpet/ would have
// been misleading. Behaviour is unchanged apart from the two additions noted
// below, and the prop type was widened from CarpetVideo to the structural
// InlineVideo shape so both manifests satisfy it.)
//
// Nothing is fetched until the clip is close to the viewport: the <video> ships
// with no <source> children at all, and preload="none", so a page with several
// clips costs nothing on first load. Sources are attached only once an
// IntersectionObserver says the clip is near, and playback is paused again as
// soon as it scrolls away so background clips never burn CPU or data.
//
// Muted + loop + playsInline keeps mobile browsers from hijacking the screen
// into fullscreen. prefers-reduced-motion is honoured by never autoplaying and
// exposing a normal control bar instead.
//
// Two additions for the Sofa clips:
//   • `autoPlay` is now declared on the element, not only driven imperatively
//     from the observer. Safari in particular is far happier starting a muted
//     clip from the attribute than from a .play() call, and the attribute is
//     what an audit actually looks for.
//   • if play() is rejected anyway (iOS Low Power Mode, a data-saver setting,
//     or a per-site autoplay block) the native controls are shown, so there is
//     always a usable play/pause path instead of a silent still frame.

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

/**
 * The structural shape LazyVideo needs. CarpetVideo and the sofa video entries
 * both satisfy it, so neither manifest has to import from the other.
 */
export interface InlineVideo {
  /** MP4 (H.264) source — required. */
  src: string;
  /** Optional WebM source, offered first when present. */
  webm?: string;
  /** Poster frame. Required: prevents a black box before playback starts. */
  poster: string;
  /** Describes the clip for people who cannot see it. */
  description: string;
  /** Optional short caption burnt into the bottom of the stage. */
  label?: string;
}

export default function LazyVideo({
  video,
  className = '',
}: {
  video: InlineVideo;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Respect the OS "reduce motion" setting, and react if it changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Attach sources only when close to the viewport; pause when it leaves.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          if (!reduced) {
            videoRef.current
              ?.play()
              .then(() => setBlocked(false))
              // Autoplay refused — fall back to native controls rather than
              // leaving the visitor looking at a frozen poster.
              .catch(() => setBlocked(true));
          }
        } else {
          videoRef.current?.pause();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden rounded-xl bg-navy-900 ${className}`}>
      <video
        ref={videoRef}
        poster={video.poster}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        preload="none"
        controls={reduced || blocked}
        aria-label={video.description}
        // object-contain, not cover, for the same reason BeforeAfterTile uses
        // it: the clips are a mix of portrait and landscape, and cropping would
        // cut the wand or the technician out of whichever one doesn't match its
        // stage. Letterboxing on the navy backdrop shows every frame in full.
        className="block h-full w-full object-contain"
      >
        {/* Sources are withheld until the clip is near the viewport, so the
            browser cannot start fetching them on initial page load. */}
        {near && video.webm && <source src={video.webm} type="video/webm" />}
        {near && <source src={video.src} type="video/mp4" />}
      </video>

      {/* Under reduced motion nothing autoplays, so signal that it is playable. */}
      {reduced && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy-900/80 px-2 py-1 text-[11px] font-semibold text-white">
          <Play className="h-3 w-3" aria-hidden="true" strokeWidth={2.5} />
          Press play
        </span>
      )}

      {video.label && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/85 to-transparent px-3 pb-2 pt-6 text-[12px] font-semibold text-white">
          {video.label}
        </span>
      )}
    </div>
  );
}
