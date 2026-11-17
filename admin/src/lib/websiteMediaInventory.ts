import type { GalleryItem } from "../../../src/data/galleryMedia";
import { getHomepageProofPairs } from "../../../src/data/homepageProof";
import { WEBSITE_MEDIA_POSITIONS } from "../../shared/mediaWebsitePositions.js";
import type { GallerySlot, MediaAsset, MediaLibrary, WebsiteSlot } from "../types/media";

export const WEBSITE_ORIGIN = "https://www.vveclean.co.uk";
export const INVENTORY_PAGES = ["Homepage", ...new Set(WEBSITE_MEDIA_POSITIONS.flatMap(position => position.pages.map(page => page.label)).filter(label => label !== "Homepage"))];
export type InventoryPosition = {
  id: string;
  page: string;
  section: string;
  href: string;
  media: GalleryItem | null;
  kind: "photo" | "video" | "before_after";
  source: "built-in" | "crm" | "empty";
  note?: string;
  fallback?: GalleryItem;
  gallerySlot?: GallerySlot;
  websiteSlot?: WebsiteSlot;
};

const SERVICES = [
  { category: "carpet", label: "Carpet cleaning", path: "/carpet-cleaning-london", main: "carpet-main-results", gallery: "gallery-carpet", anchor: "results" },
  { category: "sofa-upholstery", label: "Sofa & upholstery", path: "/sofa-cleaning-london", main: "sofa-main-results", gallery: "gallery-sofa", anchor: "gallery" },
  { category: "end-of-tenancy", label: "End of tenancy", path: "/end-of-tenancy-cleaning-london", main: "end-of-tenancy-main-results", gallery: "gallery-end-of-tenancy", anchor: "results" },
];

const photo = (id: string, src: string, alt: string): GalleryItem => ({ type: "photo", id, src, alt, label: alt });

/** Same validity rules as public referenceToItem: half-pairs and unfinished media are not photos. */
export function inventorySlotMedia(slot: GallerySlot | WebsiteSlot, assets: Map<string, MediaAsset>): GalleryItem | null {
  const find = (role: string) => {
    const value = assets.get(slot.assignments.find(assignment => assignment.role === role)?.assetId ?? "");
    return value?.status === "ready" ? value : undefined;
  };
  if ("kind" in slot && slot.kind === "before_after") {
    const before = find("before");
    const after = find("after");
    if (!before?.imageUrl || !after?.imageUrl || before.mediaType !== "image" || after.mediaType !== "image") return null;
    return { type: "before-after", id: slot.id, label: before.title || slot.label, before: before.imageUrl, after: after.imageUrl, beforeAlt: before.altText || before.title, afterAlt: after.altText || after.title };
  }
  const asset = find("primary");
  if (asset?.mediaType === "image" && asset.imageUrl) return photo(slot.id, asset.imageUrl, asset.altText || asset.title);
  if (asset?.mediaType === "video" && asset.muxPlaybackId) return { type: "video", id: slot.id, label: asset.title, src: `https://stream.mux.com/${asset.muxPlaybackId}.m3u8`, playerUrl: `https://player.mux.com/${asset.muxPlaybackId}`, poster: `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1&width=480`, description: asset.altText };
  return null;
}

/** Use reference order, not the library filter or the file's upload date. */
function slotsOnPage(library: MediaLibrary, pageKey: string, includeEmpty = false): GallerySlot[] {
  const references = library.references.filter(reference => reference.pageKey === pageKey && reference.gallerySlotId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  if (references.length) return references.flatMap(reference => {
    const slot = library.gallerySlots.find(candidate => candidate.id === reference.gallerySlotId);
    return slot && (includeEmpty || slot.assignments.length) ? [slot] : [];
  });
  // Older API snapshots include usages on each slot but no separate references.
  return library.gallerySlots.filter(slot => (includeEmpty || slot.assignments.length) && slot.usages.some(usage => usage.pageKey === pageKey))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}


export function serviceOpeningPhoto(library: MediaLibrary, assets: Map<string, MediaAsset>, category: string) {
  const service = SERVICES.find(entry => entry.category === category);
  if (!service) return null;
  const slot = slotsOnPage(library, service.main)[0] ?? slotsOnPage(library, service.gallery)[0];
  const media = slot && inventorySlotMedia(slot, assets);
  if (media?.type === "before-after") return photo(media.id, media.after, media.afterAlt);
  return media?.type === "photo" ? media : null;
}

export function buildWebsiteMediaInventory(library: MediaLibrary, assets: Map<string, MediaAsset>, date = new Date()): InventoryPosition[] {
  const positions: InventoryPosition[] = [];
  const todaysProof = getHomepageProofPairs(date);
  for (const entry of WEBSITE_MEDIA_POSITIONS) {
    const websiteSlot = entry.targetType === "website" ? library.websiteSlots.find(slot => slot.usages.some(usage => usage.pageKey === entry.key)) : undefined;
    const gallerySlot = entry.targetType === "gallery" ? library.gallerySlots.find(slot => slot.code === entry.slotKey && slot.usages.some(usage => usage.pageKey === entry.key)) : undefined;
    const slot = websiteSlot ?? gallerySlot;
    const assigned = slot && inventorySlotMedia(slot, assets);
    const current = assigned?.type === (entry.kind === "before_after" ? "before-after" : entry.kind) ? assigned : null;
    const inherited = entry.fallbackService ? serviceOpeningPhoto(library, assets, entry.fallbackService) : null;
    const underlying = inherited ?? entry.defaultMedia;
    const media = current ?? underlying;
    for (const page of entry.pages) {
      // A replacement has no verified location from the original job.
      if (current && page.label === "Local area pages" && page.section.endsWith(" · Tagged job")) continue;
      const original = entry.defaultMedia;
      const proof = page.path === "/#gallery" && original?.type === "before-after"
        ? todaysProof.find(pair => pair.before === original.before && pair.after === original.after) : undefined;
      if (page.path === "/#gallery" && !proof) continue;
      const note = proof?.id.startsWith("daily-") ? "Part of today’s rotating homepage selection."
        : inherited && !current ? "Currently uses the first published service result. You can choose a separate opening photo here."
        : page.label === "Local area pages" && entry.kind === "video" ? "This area page shows a selection of cleaning videos from across London."
        : entry.pages.length > 1 ? "This item is shared. Preview the affected pages before publishing." : undefined;
      positions.push({
        id: [entry.key, page.path, page.section].join("|"), page: page.label, section: page.section, href: page.path, kind: entry.kind,
        media, source: current || inherited ? "crm" : media ? "built-in" : "empty",
        fallback: current ? underlying ?? undefined : inherited ? entry.defaultMedia ?? undefined : undefined,
        websiteSlot, gallerySlot, note,
      });
    }
  }
  for (const service of SERVICES) {
    const routes = [[service.main, service.label, `${service.path}#${service.anchor}`], [service.gallery, "Gallery", `/gallery?category=${service.category}#gallery-collection`]];
    if (service.category === "carpet") routes.push(["carpet-process-results", "How we clean carpets", "/how-we-clean-carpets#results"]);
    for (const [pageKey, page, href] of routes) {
      for (const slot of slotsOnPage(library, pageKey)) {
        const media = inventorySlotMedia(slot, assets);
        if (media) positions.push({ id: `${pageKey}-${slot.id}`, page, href, section: `${service.label} · ${slot.label}`, media, kind: slot.kind, source: "crm", gallerySlot: slot });
      }
    }
  }
  // Follow the homepage from top to bottom, keeping the slideshow frames together.
  const homeSections = ["/#cleaning-photos", "/#services", "/#equipment", "/#gallery"];
  const home = positions.filter(position => position.page === "Homepage")
    .sort((a, b) => homeSections.indexOf(a.href) - homeSections.indexOf(b.href));
  return [...home, ...positions.filter(position => position.page !== "Homepage")];
}
