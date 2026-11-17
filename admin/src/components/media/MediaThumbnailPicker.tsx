import type { MediaAsset } from "../../types/media";
import { formatMediaDate } from "../../lib/mediaStatus";

const thumbnail = (asset: MediaAsset) =>
  asset.imageUrl ||
  (asset.muxPlaybackId
    ? `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1&width=480`
    : null);

/**
 * Visual companion to the position dropdown: the owner picks by looking at
 * the photograph rather than by reading file names.
 */
export default function MediaThumbnailPicker({
  label,
  assets,
  selectedId,
  currentId,
  disabled,
  onSelect,
}: {
  label: string;
  assets: MediaAsset[];
  selectedId: string;
  /** The item published in this position now, if any. */
  currentId?: string;
  disabled?: boolean;
  onSelect: (assetId: string) => void;
}) {
  if (!assets.length)
    return (
      <p className="mt-2 text-sm font-normal normal-case text-navy-700">
        Nothing suitable is ready yet. Upload a file for this service, wait
        for it to finish, and add its caption and description.
      </p>
    );
  return (
    <div role="group" aria-label={`${label} — choose by picture`} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map((asset) => {
        const src = thumbnail(asset);
        const selected = asset.id === selectedId;
        const name = asset.title || asset.filename;
        return (
          <button
            key={asset.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`Choose ${name}${asset.id === currentId ? " (in this position now)" : ""}`}
            onClick={() => onSelect(asset.id)}
            className={`overflow-hidden rounded-xl border-2 bg-white text-left font-normal normal-case focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${selected ? "border-navy-950 ring-2 ring-sky-400" : "border-silver-300 hover:border-sky-400"}`}
          >
            <span className="relative block aspect-video bg-silver-100">
              {src ? (
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
              ) : (
                <span className="flex h-full items-center justify-center p-2 text-center text-xs text-navy-700">No preview</span>
              )}
              {selected && <span className="absolute right-1 top-1 rounded bg-navy-950 px-2 py-0.5 text-xs font-semibold text-white">Selected</span>}
            </span>
            <span className="block p-2">
              <span className="block break-words text-sm font-semibold text-navy-950">{asset.title || "Caption needed"}</span>
              <span className="block break-words text-xs text-navy-700">{asset.filename}</span>
              <span className="block text-xs text-navy-700">Uploaded {formatMediaDate(asset.createdAt)}</span>
              {asset.id === currentId ? (
                <span className="mt-1 block text-xs font-semibold text-emerald-800">In this position now</span>
              ) : asset.usages.length > 0 ? (
                <span className="mt-1 block text-xs font-semibold text-emerald-800">Also live elsewhere</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
