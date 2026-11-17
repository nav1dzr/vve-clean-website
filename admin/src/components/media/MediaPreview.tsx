import { useState } from "react";
import type { MediaAsset } from "../../types/media";
import { mediaStatusSummary, type MediaStatusTone } from "../../lib/mediaStatus";

/** Thumbnail for a photo, or poster with an explicit Play control for a video. */
export function MediaPreview({ asset, label }: { asset?: MediaAsset; label: string }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const playing = Boolean(asset?.id && playingId === asset.id);
  const src =
    asset?.imageUrl ||
    (asset?.muxPlaybackId
      ? `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1&width=480`
      : null);

  return (
    <figure className="relative aspect-video bg-silver-100">
      {playing && asset?.muxPlaybackId ? <iframe className="h-full w-full" src={`https://player.mux.com/${encodeURIComponent(asset.muxPlaybackId)}`} title={`Video preview: ${asset.title || label}`} allow="fullscreen" allowFullScreen /> : src && src !== failedImage ? (
        <img
          src={src}
          onError={() => setFailedImage(src)}
          alt={asset?.altText || ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-navy-700">
          {src && failedImage === src ? "Thumbnail unavailable" : asset ? mediaStatusSummary(asset).label : "No media assigned"}
        </div>
      )}
      {asset?.muxPlaybackId && !playing && <button type="button" className="absolute inset-x-8 top-1/3 rounded-lg bg-white p-3 font-semibold text-navy-950 shadow" onClick={() => setPlayingId(asset.id)}>Play video</button>}
      {!playing && <figcaption className="absolute bottom-2 left-2 rounded bg-navy-950 px-2 py-1 text-xs capitalize text-white">
        {label}
      </figcaption>}
    </figure>
  );
}

const TONES: Record<MediaStatusTone, string> = {
  live: "border-emerald-300 bg-emerald-50 text-emerald-900",
  ready: "border-silver-300 bg-silver-100 text-navy-900",
  waiting: "border-sky-300 bg-sky-50 text-sky-900",
  problem: "border-red-300 bg-red-50 text-red-900",
  muted: "border-silver-300 bg-white text-navy-700",
};

/** Text carries the meaning; colour only reinforces it. */
export function MediaStatusBadge({ asset }: { asset: MediaAsset }) {
  const status = mediaStatusSummary(asset);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONES[status.tone]}`}>
      <span aria-hidden="true">{status.tone === "live" ? "●" : status.tone === "problem" ? "!" : "○"}</span>
      {status.label}
    </span>
  );
}
