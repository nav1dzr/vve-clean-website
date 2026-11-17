import { GALLERY_MEDIA, CARPET_FEATURED_BEFORE_AFTER, EOT_FEATURED_BEFORE_AFTER, EOT_ROTATING_PHOTOS, type GalleryCategory, type GalleryItem } from "../../../src/data/galleryMedia";
import { CARPET_RESULT_VIDEOS, CARPET_PROCESS_VIDEO } from "../../../src/data/carpetMedia";
import { SOFA_BEFORE_AFTER, SOFA_PHOTOS, SOFA_FEATURE_VIDEO, SOFA_SUPPORTING_VIDEOS } from "../../../src/data/sofaMedia";
import { getHomepageProofPairs } from "../../../src/data/homepageProof";
import { AREAS } from "../../../src/data/areas";
import { getAreaShowcaseVideos } from "../../../src/data/areaShowcase";
import { matchesNamedArea } from "../../../src/lib/areaMatch";
import { buildersJobPhotos } from "../../../src/data/afterBuildersPhotos";
import { TEAM_MEMBERS } from "../../../src/data/team";
import type { GallerySlot, MediaAsset, MediaLibrary, WebsiteSlot } from "../types/media";

export const WEBSITE_ORIGIN = "https://www.vveclean.co.uk";
export const INVENTORY_PAGES = ["Homepage", "Carpet cleaning", "Sofa & upholstery", "End of tenancy", "Gallery", "Commercial carpet", "Local area pages", "About", "After builders"];
export type InventoryPosition = {
  id: string;
  page: string;
  section: string;
  href: string;
  media: GalleryItem;
  source: "built-in" | "crm";
  note?: string;
  fallback?: GalleryItem;
  replacementHint?: string;
  gallerySlot?: GallerySlot;
  websiteSlot?: WebsiteSlot;
};

const SERVICES: { category: GalleryCategory; topic: string; label: string; path: string; main: string; gallery: string; hero: string; alt: string }[] = [
  { category: "carpet", topic: "carpet", label: "Carpet cleaning", path: "/carpet-cleaning-london", main: "carpet-main-results", gallery: "gallery-carpet", hero: "/images/carpet-cleaning-hero.webp", alt: "Carpet extraction in progress" },
  { category: "sofa-upholstery", topic: "sofa", label: "Sofa & upholstery", path: "/sofa-cleaning-london", main: "sofa-main-results", gallery: "gallery-sofa", hero: "/sofa_upholstery/web/gallery/sofa-gallery-01.webp", alt: "Upholstery cleaning in progress" },
  { category: "end-of-tenancy", topic: "end-of-tenancy", label: "End of tenancy", path: "/end-of-tenancy-cleaning-london", main: "end-of-tenancy-main-results", gallery: "gallery-end-of-tenancy", hero: "/end_of_tenancy/before-after/kitchen1_after.jpg", alt: "Kitchen hob after cleaning" },
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

function websiteSlot(library: MediaLibrary, pageKey: string) {
  return library.websiteSlots.find(slot => slot.usages.some(usage => usage.pageKey === pageKey));
}

export function buildWebsiteMediaInventory(library: MediaLibrary, assets: Map<string, MediaAsset>, date = new Date()): InventoryPosition[] {
  const positions: InventoryPosition[] = [];
  const push = (position: InventoryPosition) => positions.push(position);
  const fixed = (id: string, page: string, section: string, href: string, media: GalleryItem, note?: string) => push({ id, page, section, href, media, source: "built-in", note });

  for (const service of SERVICES) {
    const fallback = photo(`${service.topic}-hero`, service.hero, service.alt);
    const lead = slotsOnPage(library, service.main)[0] ?? slotsOnPage(library, service.gallery)[0];
    const editableLead = lead
      ?? slotsOnPage(library, service.main, true).find(slot => slot.kind !== "video")
      ?? slotsOnPage(library, service.gallery, true).find(slot => slot.kind !== "video");
    const leadItem = lead ? inventorySlotMedia(lead, assets) : null;
    const heroMedia = leadItem?.type === "before-after" ? photo(leadItem.id, leadItem.after, leadItem.afterAlt) : leadItem?.type === "photo" ? leadItem : null;
    const hero: InventoryPosition = { id: `${service.topic}-hero`, page: service.label, section: "Opening photograph", href: `${service.path}#main-content`, media: heroMedia ?? fallback, source: heroMedia ? "crm" : "built-in", fallback: heroMedia ? fallback : undefined, gallerySlot: editableLead,
      replacementHint: "Choose a first service result in Shared gallery positions to change this opening photo. A complete photo pair or work photo can supply it; a video cannot.",
      note: leadItem?.type === "video" ? "The leading position is a video, so the page keeps its built-in opening photo." : lead ? "Uses the first published service result. Changing that position also changes its connected gallery pages." : "Uses the built-in photo until a suitable first service result is published." };
    push(hero);
    if (service.category !== "carpet") push({ ...hero, id: `home-carousel-${service.topic}`, page: "Homepage", section: `Opening slideshow · ${service.label}`, href: "/#cleaning-photos" });
    fixed(`home-service-${service.topic}`, "Homepage", `Service card · ${service.label}`, "/#services", fallback, "This service card is built into the website; gallery publishing does not replace it.");

    // Match each rendered component's subset. Gallery membership alone does not
    // imply that the same item is displayed on a service or local-area page.
    const serviceMedia: GalleryItem[] = service.category === "carpet" ? [
      ...CARPET_FEATURED_BEFORE_AFTER,
      ...CARPET_FEATURED_BEFORE_AFTER.flatMap(pair => {
        const clip = CARPET_RESULT_VIDEOS.find(video => video.pairedWith === pair.id);
        return clip ? [{ ...clip, type: "video" as const }] : [];
      }),
      ...(CARPET_PROCESS_VIDEO ? [{ ...CARPET_PROCESS_VIDEO, type: "video" as const }] : []),
    ] : service.category === "sofa-upholstery" ? [...SOFA_BEFORE_AFTER, ...SOFA_PHOTOS, SOFA_FEATURE_VIDEO, ...SOFA_SUPPORTING_VIDEOS] : [...EOT_FEATURED_BEFORE_AFTER, ...EOT_ROTATING_PHOTOS];
    for (const item of serviceMedia) {
      const section = item.type === "before-after" ? "Before-and-after results" : item.type === "video" ? "Cleaning videos" : "Job photographs";
      const anchor = item.id === CARPET_PROCESS_VIDEO?.id ? "process" : item.type === "before-after" ? "results" : service.category === "sofa-upholstery" ? (item.id === SOFA_FEATURE_VIDEO.id ? "extraction" : "gallery") : "results";
      fixed(`service-${service.topic}-${item.id}`, service.label, section, `${service.path}#${anchor}`, item, "This original website item stays visible when you add a CRM gallery position.");
    }
    for (const item of GALLERY_MEDIA[service.category]) {
      const section = item.type === "before-after" ? "Before-and-after results" : item.type === "video" ? "Cleaning videos" : "Job photographs";
      fixed(`gallery-${service.topic}-${item.id}`, "Gallery", `${service.label} · ${section}`, `/gallery?category=${service.category}#gallery-collection`, item, "Built-in gallery item. Publishing a new CRM position adds to the gallery; it does not replace this item.");
    }
    for (const [pageKey, page, href] of [[service.main, service.label, `${service.path}#${service.category === "sofa-upholstery" ? "gallery" : "results"}`], [service.gallery, "Gallery", `/gallery?category=${service.category}#gallery-collection`]]) {
      for (const slot of slotsOnPage(library, pageKey)) {
        const media = inventorySlotMedia(slot, assets);
        if (media) push({ id: `${pageKey}-${slot.id}`, page, href, section: `${service.label} · ${slot.label}`, media, source: "crm", gallerySlot: slot, note: "Published CRM position. Review all connected pages before replacing it." });
      }
    }
  }

  for (const [pageKey, section, src, alt] of [
    ["homepage-hero-image", "Opening slideshow · Carpet cleaning", "/images/carpet-cleaning-hero.webp", "Carpet extraction in progress"],
    ["homepage-equipment-image", "The equipment we bring", "/gallery/van-equipment.webp", "VVE Clean van and cleaning equipment"],
  ]) {
    const slot = websiteSlot(library, pageKey);
    const candidate = slot ? inventorySlotMedia(slot, assets) : null;
    const managed = candidate?.type === "photo" ? candidate : null;
    const fallback = photo(pageKey, src, alt);
    push({ id: pageKey, page: "Homepage", section, href: pageKey === "homepage-hero-image" ? "/#cleaning-photos" : "/#equipment", media: managed ?? fallback, source: managed ? "crm" : "built-in", websiteSlot: slot, fallback: managed ? fallback : undefined, note: "This named homepage position is separate from the service-page opening photo." });
  }

  for (const pair of getHomepageProofPairs(date)) fixed(`home-proof-${pair.id}`, "Homepage", `Before-and-after results · ${pair.service}`, "/#gallery", { ...pair, type: "before-after" }, pair.id.startsWith("daily-") ? "Part of the daily rotation. The selection can change each day." : "Built-in homepage comparison.");
  fixed("about-equipment", "About", "Our story", "/about#main-content", photo("about-equipment", "/gallery/van-equipment.webp", "VVE Clean van and cleaning equipment"), "This is independent of the editable homepage equipment position.");
  for (const member of TEAM_MEMBERS) if (member.photo) fixed(`team-${member.name}`, "About", "Our team", "/about#main-content", photo(`team-${member.name}`, member.photo, member.name));
  const office = GALLERY_MEDIA.carpet.find(item => item.id === "carpet-office" && item.type === "before-after");
  if (office) fixed("commercial-office-result", "Commercial carpet", "Office carpet before and after", "/commercial-carpet-cleaning-london#main-content", office);
  for (const area of AREAS.filter(item => item.coverageConfirmed !== false)) {
    for (const video of getAreaShowcaseVideos(area.slug)) fixed(`area-${area.slug}-${video.id}`, "Local area pages", `${area.name} · Cleaning in progress`, `/cleaning-${area.slug}#area-services`, { ...video, type: "video" }, "A showcase clip from work across London; this is not a claim that the job was in this area.");
    for (const item of Object.values(GALLERY_MEDIA).flat().filter(item => matchesNamedArea(item.location, area.name))) fixed(`area-proof-${area.slug}-${item.id}`, "Local area pages", `${area.name} · Tagged job`, `/cleaning-${area.slug}#main-content`, item);
  }
  const buildersHero = buildersJobPhotos.hero;
  if (buildersHero?.src && buildersHero.alt.trim()) fixed("builders-hero", "After builders", "Opening photograph", "/after-builders-cleaning-london#main-content", photo("builders-hero", buildersHero.src, buildersHero.alt));
  const { before, after } = buildersJobPhotos;
  if (before?.src && after?.src && before.alt.trim() && after.alt.trim()) fixed("builders-comparison", "After builders", "Before and after the builders’ clean", "/after-builders-cleaning-london#builders-results", { type: "before-after", id: "builders-comparison", label: "Before and after the builders’ clean", before: before.src, after: after.src, beforeAlt: before.alt, afterAlt: after.alt });
  return positions;
}
