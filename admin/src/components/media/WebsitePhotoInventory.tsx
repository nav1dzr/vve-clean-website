import { useMemo, useState } from "react";
import type { GalleryItem } from "../../../../src/data/galleryMedia";
import type { GallerySlot, MediaAsset, MediaLibrary, WebsiteSlot } from "../../types/media";
import { buildWebsiteMediaInventory, INVENTORY_PAGES, WEBSITE_ORIGIN, type InventoryPosition } from "../../lib/websiteMediaInventory";

const publicUrl = (path: string) => path.startsWith("/") ? `${WEBSITE_ORIGIN}${path}` : path;
const control = "min-h-11 rounded-lg border border-silver-300 bg-white px-3 py-2 text-sm font-semibold text-navy-950 focus-visible:ring-2 focus-visible:ring-sky-500";

function InventoryImage({ src, alt, label }: { src: string; alt: string; label?: string }) {
  const [failedSource, setFailedSource] = useState("");
  return <figure className="min-w-0 bg-silver-100">
    {failedSource === src ? <div className="flex aspect-[4/3] items-center justify-center p-4 text-center text-sm text-navy-700">Preview unavailable. Open the website to check this image.</div>
      : <img src={publicUrl(src)} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSource(src)} className="aspect-[4/3] w-full object-contain" />}
    {label && <figcaption className="px-3 py-2 text-xs font-semibold text-navy-700">{label}</figcaption>}
  </figure>;
}

function InventoryMedia({ item }: { item: GalleryItem }) {
  const [playing, setPlaying] = useState(false);
  if (item.type === "before-after") return <div className="grid grid-cols-2 gap-px bg-silver-200">
    <InventoryImage src={item.before} alt={item.beforeAlt} label={item.beforeLabel ?? "Before"} />
    <InventoryImage src={item.after} alt={item.afterAlt} label={item.afterLabel ?? "After"} />
  </div>;
  if (item.type === "photo") return <InventoryImage src={item.src} alt={item.alt} />;
  return <div className="relative bg-silver-100">
    {playing ? item.playerUrl ? <iframe src={item.playerUrl} title={`Website video: ${item.label}`} allow="fullscreen" allowFullScreen className="aspect-[4/3] w-full border-0" />
      : <video src={publicUrl(item.src)} poster={publicUrl(item.poster)} controls playsInline preload="metadata" className="aspect-[4/3] w-full object-contain" aria-label={item.label} />
      : <><InventoryImage src={item.poster} alt={`Video poster: ${item.label}`} /><button type="button" onClick={() => setPlaying(true)} className={`absolute inset-x-6 bottom-4 shadow ${control}`}>Preview this video</button></>}
  </div>;
}

function PositionCard({ position, onReplaceGallery, onReplaceWebsite }: {
  position: InventoryPosition;
  onReplaceGallery: (slot: GallerySlot, serviceLabel: string) => void;
  onReplaceWebsite: (slot: WebsiteSlot) => void;
}) {
  const canChange = Boolean(position.gallerySlot || position.websiteSlot);
  const label = position.gallerySlot?.topicKey === "sofa" ? "Sofa & upholstery" : position.gallerySlot?.topicKey === "end-of-tenancy" ? "End of tenancy" : "Carpet";
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-silver-300 bg-white" aria-label={`${position.page} · ${position.section} · ${position.media.label}`}>
    <div className="space-y-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">{position.page}</p>
      <h4 className="text-base font-semibold leading-6 text-navy-950">{position.section}</h4>
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${position.source === "crm" ? "bg-emerald-50 text-emerald-900" : "bg-sky-50 text-navy-700"}`}>{position.source === "crm" ? "Published from CRM" : "Built-in website media"}</span>
    </div>
    <InventoryMedia key={JSON.stringify(position.media)} item={position.media} />
    <div className="space-y-3 p-4">
      <p className="break-words text-sm font-medium text-navy-950">{position.media.label}</p>
      {position.note && <p className="text-sm leading-6 text-navy-700">{position.note}</p>}
      {position.fallback && <details className="rounded-lg border border-silver-200 p-3 text-sm text-navy-700"><summary className="cursor-pointer font-medium">Backup image if this is unavailable</summary><div className="mt-3"><InventoryMedia item={position.fallback} /></div></details>}
      <a href={publicUrl(position.href)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy-700 underline underline-offset-4">Open this website section</a>
      {canChange ? <button type="button" className={`${control} block w-full !border-navy-950 !bg-navy-950 !text-white`} onClick={() => position.websiteSlot ? onReplaceWebsite(position.websiteSlot) : position.gallerySlot && onReplaceGallery(position.gallerySlot, label)}>Manage this position</button>
        : <p className="border-t border-silver-200 pt-3 text-xs leading-5 text-silver-700">{position.replacementHint ?? "Website edit needed to replace this item. Uploading a new gallery photo will keep this original in place."}</p>}
    </div>
  </article>;
}

export default function WebsitePhotoInventory({ library, assets, onReplaceGallery, onReplaceWebsite }: {
  library: MediaLibrary;
  assets: Map<string, MediaAsset>;
  onReplaceGallery: (slot: GallerySlot, serviceLabel: string) => void;
  onReplaceWebsite: (slot: WebsiteSlot) => void;
}) {
  const [page, setPage] = useState("Homepage");
  const [source, setSource] = useState("all");
  const positions = useMemo(() => buildWebsiteMediaInventory(library, assets), [library, assets]);
  const shown = positions.filter(position => (page === "all" || position.page === page) && (source === "all" || position.source === source));
  return <section aria-labelledby="website-photo-map-heading" className="mb-10 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5">
    <h3 id="website-photo-map-heading" className="text-xl font-semibold text-navy-950">Find the photo you want to change</h3>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-navy-700">Browse the website by page, including its original photos and videos. The same image may appear in several places. Open the page to check its crop and position; the preview below keeps the full picture visible.</p>
    <div className="my-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold text-navy-950">Website page<select value={page} onChange={event => setPage(event.target.value)} className={`${control} mt-1 block w-full`}><option value="all">All pages</option>{INVENTORY_PAGES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-navy-950">Media source<select value={source} onChange={event => setSource(event.target.value)} className={`${control} mt-1 block w-full`}><option value="all">All sources</option><option value="crm">Published from CRM</option><option value="built-in">Built-in website media</option></select></label>
    </div>
    <p className="mb-4 text-sm text-navy-700" role="status">{shown.length} {shown.length === 1 ? "position" : "positions"} shown</p>
    {shown.length ? <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(position => <PositionCard key={position.id} position={position} onReplaceGallery={onReplaceGallery} onReplaceWebsite={onReplaceWebsite} />)}</div>
      : <p className="rounded-xl border border-silver-200 bg-white p-5 text-sm leading-6 text-navy-700">{page === "After builders" && source !== "crm" ? "No approved After Builders photographs are currently configured. Its empty photo sections stay hidden until real job photos are added." : "No positions match these filters. Choose another page or show all sources."}</p>}
    <p className="mt-5 text-xs leading-5 text-navy-700">Original media comes from the website files in this release; published selections come from the CRM. Website and CRM should be on the same release. Daily homepage comparisons and shuffled photo order can vary. Logos and decorative icons are not included.</p>
  </section>;
}
