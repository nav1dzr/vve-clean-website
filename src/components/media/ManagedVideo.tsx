import { useState } from "react";

/** No player request or video download until the visitor chooses Play. */
export default function ManagedVideo({
  playerUrl,
  poster,
  title,
}: {
  playerUrl: string;
  poster?: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-navy-950">
      {playing ? (
        <iframe
          src={playerUrl}
          title={title}
          className="h-full w-full border-0"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative h-full w-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-400"
          aria-label={`Play ${title}`}
        >
          {poster && (
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="rounded-full bg-white px-5 py-3 font-semibold text-navy-950">
              Play video
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
