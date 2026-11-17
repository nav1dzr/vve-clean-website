import { useMemo, useState } from "react";
import type { GalleryItem } from "../../../../src/data/galleryMedia";
import type { GallerySlot, MediaAsset, MediaLibrary, WebsiteSlot } from "../../types/media";
import { buildWebsiteMediaInventory, INVENTORY_PAGES, WEBSITE_ORIGIN, type InventoryPosition } from "../../lib/websiteMediaInventory";

const publicUrl = (path: string) => path.startsWith("/") ? `${WEBSITE_ORIGIN}${path}` : path;
const control = "min-h-11 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm text-navy-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

function InventoryImage({ src, alt, label }: { src: string; alt: string; label?: string }) {
  const [failedSource, setFailedSource] = useState("");
  return <figure className="relative flex h-full min-w-0 flex-col bg-silver-100">
    {failedSource === src ? <div className="flex h-full items-center justify-center p-4 text-center text-sm text-navy-700">Preview unavailable. Use View page to check.</div>
      : <img src={publicUrl(src)} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSource(src)} className="h-full min-h-0 w-full flex-1 object-contain" />}
    {label && <figcaption className="absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-navy-950 shadow-sm">{label}</figcaption>}
  </figure>;
}

export function InventoryMedia({ item }: { item: GalleryItem }) {
  const [playing, setPlaying] = useState(false);
  if (item.type === "before-after") return <div className="grid aspect-[4/3] sm:aspect-video grid-cols-2 gap-px overflow-hidden bg-silver-200">
    <InventoryImage src={item.before} alt={item.beforeAlt} label={item.beforeLabel ?? "Before"} />
    <InventoryImage src={item.after} alt={item.afterAlt} label={item.afterLabel ?? "After"} />
  </div>;
  if (item.type === "photo") return <div className="aspect-[4/3] sm:aspect-video overflow-hidden"><InventoryImage src={item.src} alt={item.alt} /></div>;
  return <div className="relative aspect-[4/3] sm:aspect-video overflow-hidden bg-silver-100">
    {playing ? item.playerUrl ? <iframe src={item.playerUrl} title={`Website video: ${item.label}`} allow="fullscreen" allowFullScreen className="h-full w-full border-0" />
      : <video src={publicUrl(item.src)} poster={publicUrl(item.poster)} controls playsInline preload="metadata" className="h-full w-full object-contain" aria-label={item.label} />
      : <><InventoryImage src={item.poster} alt={`Video poster: ${item.label}`} /><button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${item.label}`} className="absolute inset-0 flex items-center justify-center bg-navy-950/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky-500"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-navy-950 shadow-lg"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M8 5v14l11-7z" /></svg></span></button></>}
  </div>;
}

function PositionCard({ position, onReplaceGallery, onReplaceWebsite }: {
  position: InventoryPosition;
  onReplaceGallery: (slot: GallerySlot, serviceLabel: string) => void;
  onReplaceWebsite: (slot: WebsiteSlot) => void;
}) {
  const canChange = Boolean(position.gallerySlot || position.websiteSlot);
  const serviceLabel = position.gallerySlot?.topicKey === "property-services" ? "Property services" : position.gallerySlot?.topicKey === "sofa" ? "Sofa & upholstery" : position.gallerySlot?.topicKey === "end-of-tenancy" ? "End of tenancy" : "Carpet";
  const kind = position.kind === "before_after" ? "pair" : position.kind === "video" ? "video" : "photo";
  const action = `${position.media ? "Change" : "Add"} ${kind}`;
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-sm" aria-label={`${position.page} · ${position.section} · ${position.media?.label ?? "Awaiting first upload"}`}>
    <div className="px-4 pb-3 pt-4"><p className="text-xs font-semibold text-navy-700">{position.page}</p>
      <h3 className="mt-1 text-base font-semibold leading-6 text-navy-950">{position.section}</h3></div>
    {position.media ? <InventoryMedia key={JSON.stringify(position.media)} item={position.media} /> : <div className="flex aspect-[4/3] sm:aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-sky-50 to-silver-100 p-6 text-center text-navy-700"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-9 w-9 text-sky-700"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m3 17 6-6 4 4 3-3 5 5" /><circle cx="16" cy="8" r="1.5" /></svg><p className="text-sm font-medium">Ready for your first {kind}</p></div>}
    <div className="p-4">
      <div className="flex items-start gap-2"><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${position.source === "crm" ? "bg-emerald-50 text-emerald-900" : "bg-silver-100 text-navy-700"}`}>{position.source === "crm" ? "Your upload" : position.source === "empty" ? "Empty" : "Website original"}</span></div>
      <div className="mt-3 flex items-center gap-3">
        {canChange ? <button type="button" aria-label={`${action}: ${position.page} · ${position.section}`} className={`${control} flex-1 !border-navy-950 !bg-navy-950 font-semibold !text-white hover:!bg-navy-800`} onClick={() => position.websiteSlot ? onReplaceWebsite(position.websiteSlot) : position.gallerySlot && onReplaceGallery(position.gallerySlot, serviceLabel)}>{action}</button>
          : <span className="flex-1 text-xs text-navy-700">Setup needed to change this</span>}
        <a href={publicUrl(position.href)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-navy-700 underline underline-offset-4">View page <span aria-hidden="true">↗</span></a>
      </div>
      {(position.note || position.fallback || position.media?.label) && <details className="mt-3 border-t border-silver-200 pt-3 text-xs leading-5 text-navy-700"><summary className="w-fit cursor-pointer rounded font-medium focus-visible:ring-2 focus-visible:ring-sky-500">Details</summary>
        {position.media?.label && <p className="mt-2 break-words">{position.media.label}</p>}
        {position.note && <p className="mt-2">{position.note}</p>}
        {position.fallback && <div className="mt-3"><p className="mb-2 font-semibold">Shown if your selection is removed</p><InventoryMedia item={position.fallback} /></div>}
      </details>}
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
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const positions = useMemo(() => buildWebsiteMediaInventory(library, assets), [library, assets]);
  const shown = positions.filter(position => (page === "all" || position.page === page) && (source === "all" || position.source === source)
    && (kind === "all" || position.kind === kind)
    && [position.page, position.section, position.media?.label, position.href].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const filtered = source !== "all" || kind !== "all" || Boolean(query);
  const clearFilters = () => { setSource("all"); setKind("all"); setQuery(""); setLimit(12); };
  return <section aria-labelledby="website-photo-map-heading">
    <div className="mb-5"><h2 id="website-photo-map-heading" className="text-xl font-semibold text-navy-950">Choose the photo you want to change</h2><p className="mt-1 text-sm text-navy-700">Pick a page, find its photo, then choose a replacement.</p></div>
    <div className="rounded-2xl border border-silver-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-navy-700">Website page<select value={page} onChange={event => { setPage(event.target.value); setLimit(12); }} className={`${control} mt-1 block w-full font-medium`}><option value="all">All pages</option>{INVENTORY_PAGES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold text-navy-700">Find a photo or video<input type="search" className={`${control} mt-1 block w-full`} value={query} placeholder="Search photos, videos or sections" onChange={event => { setQuery(event.target.value); setLimit(12); }} /></label>
      </div>
      <details className="mt-3 text-sm text-navy-700"><summary className="w-fit cursor-pointer rounded py-1 font-medium focus-visible:ring-2 focus-visible:ring-sky-500">More filters{source !== "all" || kind !== "all" ? " · active" : ""}</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Media type<select className={`${control} mt-1 block w-full`} value={kind} onChange={event => { setKind(event.target.value); setLimit(12); }}><option value="all">All types</option><option value="photo">Photos</option><option value="before_after">Before and after</option><option value="video">Videos</option></select></label>
        <label className="text-xs font-semibold">Media source<select value={source} onChange={event => { setSource(event.target.value); setLimit(12); }} className={`${control} mt-1 block w-full`}><option value="all">All sources</option><option value="crm">Your published uploads</option><option value="built-in">Website originals</option><option value="empty">Empty positions</option></select></label>
      </div></details>
    </div>
    <div className="my-4 flex min-h-8 items-center justify-between gap-3 text-sm text-navy-700"><p role="status">{shown.length} {shown.length === 1 ? "position" : "positions"}{shown.length > limit ? ` · showing ${limit}` : ""}</p>{filtered && <button type="button" onClick={clearFilters} className="min-h-11 rounded px-2 font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-sky-500">Clear filters</button>}</div>
    {shown.length ? <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.slice(0, limit).map(position => <PositionCard key={position.id} position={position} onReplaceGallery={onReplaceGallery} onReplaceWebsite={onReplaceWebsite} />)}</div>
      : <div className="rounded-2xl border border-dashed border-silver-300 bg-white p-8 text-center"><p className="font-semibold text-navy-950">No matching media</p><p className="mt-1 text-sm text-navy-700">Try another page or clear your filters.</p></div>}
    {shown.length > limit && <button type="button" className={`${control} mt-5 w-full font-semibold sm:w-auto`} onClick={() => setLimit(value => value + 12)}>Show more photos & videos</button>}
    <details className="mt-5 text-xs leading-5 text-navy-700"><summary className="w-fit cursor-pointer rounded py-2 focus-visible:ring-2 focus-visible:ring-sky-500">About these previews</summary><p className="mt-1 max-w-2xl">Photos are shown uncropped. Use View page for their exact layout. Website originals come from this release; your published selections come from the CRM. Daily homepage photos and gallery order can vary.</p></details>
  </section>;
}
