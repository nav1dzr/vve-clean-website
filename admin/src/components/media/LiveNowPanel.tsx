import type { ReactNode } from "react";
import type {
  GallerySlot,
  MediaAsset,
  MediaLibrary,
  MediaUsage,
  WebsiteSlot,
} from "../../types/media";
import { formatMediaDate } from "../../lib/mediaStatus";
import { MediaPreview } from "./MediaPreview";
import WebsitePhotoInventory from "./WebsitePhotoInventory";

const SERVICES: { topicKey: string; label: string }[] = [
  { topicKey: "carpet", label: "Carpet" },
  { topicKey: "sofa", label: "Sofa & upholstery" },
  { topicKey: "end-of-tenancy", label: "End of tenancy" },
];
const KIND_LABEL: Record<GallerySlot["kind"], string> = {
  before_after: "Before / after pair",
  photo: "Work photo",
  video: "Video",
};
const ROLE_ORDER = ["before", "after", "primary"];

function LiveCard({
  title,
  subtitle,
  slot,
  assets,
  usages,
  action,
  onReplace,
}: {
  title: string;
  subtitle: string;
  slot: GallerySlot | WebsiteSlot;
  assets: Map<string, MediaAsset>;
  usages: ReactNode;
  action: string;
  onReplace: () => void;
}) {
  const rows = [...slot.assignments].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
  const since = formatMediaDate(slot.publishedAt);
  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-300 bg-white">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          ● Live{since ? ` since ${since}` : ""}
        </p>
        <h4 className="mt-1 font-semibold text-navy-950">{title}</h4>
        <p className="text-xs text-navy-700">{subtitle}</p>
      </div>
      <div className={rows.length > 1 ? "grid grid-cols-2" : "block"}>
        {rows.map((row) => (
          <MediaPreview
            key={row.role}
            asset={assets.get(row.assetId)}
            label={row.role === "primary" ? "live" : row.role}
          />
        ))}
      </div>
      <div className="p-4">
        <ul className="text-sm text-navy-900">
          {rows.map((row) => {
            const asset = assets.get(row.assetId);
            return (
              <li key={row.role} className="break-words">
                {row.role !== "primary" && <span className="font-semibold capitalize">{row.role}: </span>}
                {asset?.title || "Caption needed"}
                {asset && <span className="text-xs text-navy-700"> — {asset.filename}</span>}
              </li>
            );
          })}
        </ul>
        {usages}
        <button
          type="button"
          className="mt-4 min-h-11 rounded-lg border border-silver-300 bg-white px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500"
          onClick={onReplace}
        >
          {action}
        </button>
      </div>
    </article>
  );
}

/**
 * One screen answering "what from my library is on the website right now?"
 * across every service, without choosing a service, tab or position type.
 */
export default function LiveNowPanel({
  library,
  assets,
  isConnected,
  renderUsages,
  onReplaceGallery,
  onReplaceWebsite,
}: {
  library: MediaLibrary;
  assets: Map<string, MediaAsset>;
  isConnected: (usages: MediaUsage[]) => boolean;
  renderUsages: (usages: MediaUsage[]) => ReactNode;
  onReplaceGallery: (slot: GallerySlot, serviceLabel: string) => void;
  onReplaceWebsite: (slot: WebsiteSlot) => void;
}) {
  const liveGallery = library.gallerySlots.filter((slot) => slot.assignments.length);
  const liveWebsite = library.websiteSlots.filter(
    (slot) => slot.assignments.length && isConnected(slot.usages),
  );
  const total = liveGallery.length + liveWebsite.length;
  return (
    <section aria-labelledby="live-now-heading">
      <h2 id="live-now-heading" className="text-xl font-semibold text-navy-950">
        Live on the website now
      </h2>
      <p className="mb-5 mt-2 max-w-3xl text-navy-700">
        {total
          ? `${total} ${total === 1 ? "position shows" : "positions show"} media from your library. Use the page browser below to see those selections alongside the website's original photos and videos.`
          : "Nothing from your library is on the website yet. The page browser below shows the original website photos and videos."}
      </p>
      <WebsitePhotoInventory library={library} assets={assets} onReplaceGallery={onReplaceGallery} onReplaceWebsite={onReplaceWebsite} />
      <h3 className="mb-5 text-xl font-semibold text-navy-950">Manage published CRM positions</h3>
      {SERVICES.map((service) => {
        const slots = liveGallery
          .filter((slot) => slot.topicKey === service.topicKey)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section key={service.topicKey} aria-label={`${service.label} — live media`} className="mb-8">
            <h3 className="mb-3 text-lg font-semibold text-navy-950">
              {service.label} ({slots.length} live)
            </h3>
            {slots.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => (
                  <LiveCard
                    key={slot.id}
                    title={slot.label}
                    subtitle={`${KIND_LABEL[slot.kind]} · ${slot.code}`}
                    slot={slot}
                    assets={assets}
                    usages={renderUsages(slot.usages)}
                    action={slot.kind === "before_after" ? "Replace this pair" : slot.kind === "video" ? "Replace this video" : "Replace this photo"}
                    onReplace={() => onReplaceGallery(slot, service.label)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-navy-700">
                No library media is live for this service. Its pages show built-in photos only.
              </p>
            )}
          </section>
        );
      })}
      <section aria-label="Other website positions — live media" className="mb-8">
        <h3 className="mb-3 text-lg font-semibold text-navy-950">
          Homepage and other positions ({liveWebsite.length} live)
        </h3>
        {liveWebsite.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {liveWebsite.map((slot) => (
              <LiveCard
                key={slot.id}
                title={slot.purposeLabel}
                subtitle={slot.pageLabel}
                slot={slot}
                assets={assets}
                usages={renderUsages(slot.usages)}
                action="Replace this photo"
                onReplace={() => onReplaceWebsite(slot)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-navy-700">
            These positions show their built-in photos. See Other website positions to compare them.
          </p>
        )}
      </section>
    </section>
  );
}
