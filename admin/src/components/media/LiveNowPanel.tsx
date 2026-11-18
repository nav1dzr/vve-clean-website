import type { ReactNode } from "react";
import type { GallerySlot, MediaAsset, MediaLibrary, MediaUsage, WebsiteSlot } from "../../types/media";
import { formatMediaDate } from "../../lib/mediaStatus";
import WebsitePhotoInventory from "./WebsitePhotoInventory";

const serviceLabel = (topic: string) => topic === "property-services" ? "Property services" : topic === "sofa" ? "Sofa & upholstery" : topic === "end-of-tenancy" ? "End of tenancy" : "Carpet";

/** Website images are shown once; the saved-selection index stays optional. */
export default function LiveNowPanel({ library, assets, isConnected, renderUsages, onReplaceGallery, onReplaceWebsite }: {
  library: MediaLibrary;
  assets: Map<string, MediaAsset>;
  isConnected: (usages: MediaUsage[]) => boolean;
  renderUsages: (usages: MediaUsage[]) => ReactNode;
  onReplaceGallery: (slot: GallerySlot, serviceLabel: string) => void;
  onReplaceWebsite: (slot: WebsiteSlot) => void;
}) {
  const liveGallery = library.gallerySlots.filter(slot => slot.assignments.length);
  const liveWebsite = library.websiteSlots.filter(slot => slot.assignments.length && isConnected(slot.usages));
  const total = liveGallery.length + liveWebsite.length;
  const rows = [
    ...liveGallery.map(slot => ({ slot, title: `${serviceLabel(slot.topicKey)} · ${slot.label}`, replace: () => onReplaceGallery(slot, serviceLabel(slot.topicKey)) })),
    ...liveWebsite.map(slot => ({ slot, title: `${slot.pageLabel} · ${slot.purposeLabel}`, replace: () => onReplaceWebsite(slot) })),
  ];
  return <section aria-label="Website media">
    <WebsitePhotoInventory library={library} assets={assets} onReplaceGallery={onReplaceGallery} onReplaceWebsite={onReplaceWebsite} />
    <details className="mt-7 rounded-xl border border-silver-200 bg-white text-sm text-navy-700">
      <summary className="cursor-pointer rounded-xl p-4 font-semibold focus-visible:ring-2 focus-visible:ring-sky-500">Published selections ({total})</summary>
      <div className="border-t border-silver-200 px-4">
        {!total && <p className="py-4">No uploads published yet. The photos above are the website originals.</p>}
        {rows.map(({ slot, title, replace }) => <div key={slot.id} className="border-b border-silver-200 py-4 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-semibold text-navy-950">{title}</p><p className="mt-1 text-xs">{formatMediaDate(slot.publishedAt) ? `Published ${formatMediaDate(slot.publishedAt)}` : "Published"} · {slot.assignments.length} {slot.assignments.length === 1 ? "file" : "files"}</p></div>
            <button type="button" aria-label={`Manage published selection: ${title}`} onClick={replace} className="min-h-11 rounded-lg border border-silver-300 px-3 py-2 font-semibold text-navy-950 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500">Manage</button>
          </div>
          <details className="mt-2 text-xs"><summary className="w-fit cursor-pointer py-1">Where this is shown</summary>{renderUsages(slot.usages)}</details>
        </div>)}
      </div>
    </details>
  </section>;
}
