import type { ReactNode } from "react";
import type { MediaAsset, MediaAssignment } from "../../types/media";
import { MediaPreview } from "./MediaPreview";

const ORDER = ["before", "after", "primary"];
const sorted = (rows: MediaAssignment[]) =>
  [...rows].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
const roleLabel = (role: string) => (role === "primary" ? "" : `${role}: `);

function Column({
  heading,
  tone,
  rows,
  assets,
  empty,
}: {
  heading: string;
  tone: string;
  rows: MediaAssignment[];
  assets: Map<string, MediaAsset>;
  empty: ReactNode;
}) {
  return (
    <section aria-label={heading} className={`rounded-xl border-2 p-3 ${tone}`}>
      <h4 className="text-sm font-semibold uppercase tracking-wide text-navy-950">{heading}</h4>
      {rows.length ? (
        <div className={`mt-2 grid gap-2 ${rows.length > 1 ? "grid-cols-2" : ""}`}>
          {sorted(rows).map((row) => {
            const asset = assets.get(row.assetId);
            return (
              <div key={row.role}>
                <MediaPreview asset={asset} label={row.role === "primary" ? (asset?.mediaType === "video" ? "video" : "photo") : row.role} />
                <p className="mt-1 break-words text-sm text-navy-900">
                  <span className="capitalize">{roleLabel(row.role)}</span>
                  {asset?.title || asset?.filename || "Details unavailable — refresh to check"}
                </p>
                {asset && <p className="break-words text-xs text-navy-700">{asset.filename}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 text-sm text-navy-800">{empty}</div>
      )}
    </section>
  );
}

/**
 * Shown at the final review step so the owner sees exactly what leaves the
 * website and what replaces it before pressing Publish.
 */
export default function ReplacementComparison({
  current,
  next,
  assets,
  whenEmpty,
}: {
  current: MediaAssignment[];
  next: MediaAssignment[];
  assets: Map<string, MediaAsset>;
  /** What visitors see in this position when no CRM media is published. */
  whenEmpty: ReactNode;
}) {
  const unchanged = sorted(current).map((row) => `${row.role}:${row.assetId}`).join()
    === sorted(next).map((row) => `${row.role}:${row.assetId}`).join();
  return (
    <div>
      <p className="text-sm font-semibold text-navy-950">
        {unchanged
          ? "This is the same as what is live now. Publishing changes nothing."
          : current.length
            ? "Publishing removes what is on the website now and shows your new choice instead."
            : "Nothing from your library is in this position yet. Publishing adds your new choice."}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Column heading="On the website now" tone="border-silver-300 bg-silver-100" rows={current} assets={assets} empty={whenEmpty} />
        <Column heading="After you publish" tone="border-emerald-400 bg-emerald-50" rows={next} assets={assets} empty="Choose media above." />
      </div>
    </div>
  );
}
