import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { GALLERY_MEDIA, type GalleryItem } from "../../../src/data/galleryMedia";
import { getAreaShowcaseVideos } from "../../../src/data/areaShowcase";
import { AREAS } from "../../../src/data/areas";
import { buildWebsiteMediaInventory, inventorySlotMedia } from "./websiteMediaInventory";
import type { GallerySlot, MediaAsset, MediaLibrary } from "../types/media";

const empty = (): MediaLibrary => ({ assets: [], topics: [], gallerySlots: [], websiteSlots: [], references: [] });
const asset = (id: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({ id, mediaType: "image", status: "ready", title: id, altText: id, service: "Carpet", category: "carpet", placement: "gallery-carpet", beforeAfter: "none", pairKey: "", locationLabel: "", websiteVisible: true, googleEnabled: false, socialEnabled: false, requestedSlotKey: null, activeSlotKey: null, usages: [], imageUrl: `https://images.example/${id}.jpg`, muxPlaybackId: null, processingError: "", createdAt: "", updatedAt: "", filename: `${id}.jpg`, size: 50, contentType: "image/jpeg", ...extra });
const slot = (id: string, assetId: string, extra: Partial<GallerySlot> = {}): GallerySlot => ({ id, topicKey: "carpet", code: id, kind: "photo", label: id, sortOrder: 1, assignments: [{ role: "primary", assetId }], usages: [{ key: id, pageKey: "carpet-main-results", pageLabel: "Carpet", componentLabel: "Results" }], ...extra });
const sources = (item: GalleryItem): string[] => item.type === "photo" ? [item.src] : item.type === "before-after" ? [item.before, item.after] : [item.src, item.poster];

describe("website photograph inventory", () => {
  it("includes every original gallery item and keeps approved pairs intact", () => {
    const positions = buildWebsiteMediaInventory(empty(), new Map());
    for (const items of Object.values(GALLERY_MEDIA)) for (const item of items) {
      expect(positions.filter(position => position.page === "Gallery" && position.media.id === item.id)).toHaveLength(1);
      expect(positions.find(position => position.page === "Gallery" && position.media.id === item.id)?.media).toEqual(item);
    }
    expect(new Set(positions.map(position => position.id)).size).toBe(positions.length);
    for (const position of positions) for (const source of sources(position.media)) {
      if (source.startsWith("/")) expect(existsSync(resolve(process.cwd(), "../public", decodeURIComponent(source.slice(1)))), source).toBe(true);
    }
  });

  it("keeps static gallery images while adding CRM results and changes only the connected hero", () => {
    const library = empty();
    library.gallerySlots = [slot("work-photo", "new")];
    const positions = buildWebsiteMediaInventory(library, new Map([["new", asset("new")]]));
    expect(positions.find(position => position.id === "carpet-hero")).toMatchObject({ source: "crm", media: { src: "https://images.example/new.jpg" } });
    expect(positions.find(position => position.id === "homepage-hero-image")).toMatchObject({ source: "built-in", media: { src: "/images/carpet-cleaning-hero.webp" } });
    expect(positions.find(position => position.id === "home-service-carpet")).toMatchObject({ source: "built-in" });
    expect(positions.filter(position => position.page === "Gallery" && position.source === "built-in")).toHaveLength(Object.values(GALLERY_MEDIA).flat().length);
  });

  it("uses public reference order and falls back for a leading video instead of promoting another photo", () => {
    const library = empty();
    library.gallerySlots = [slot("later-photo", "new", { sortOrder: 1 }), slot("first-video", "clip", { kind: "video", sortOrder: 9 })];
    library.references = [
      { id: "r1", key: "first", pageKey: "carpet-main-results", pageLabel: "Carpet", componentLabel: "Results", gallerySlotId: "first-video", websiteSlotId: null, sortOrder: 1 },
      { id: "r2", key: "later", pageKey: "carpet-main-results", pageLabel: "Carpet", componentLabel: "Results", gallerySlotId: "later-photo", websiteSlotId: null, sortOrder: 2 },
    ];
    const positions = buildWebsiteMediaInventory(library, new Map([["new", asset("new")], ["clip", asset("clip", { mediaType: "video", imageUrl: null, muxPlaybackId: "test-playback" })]]));
    expect(positions.find(position => position.id === "carpet-hero")).toMatchObject({ source: "built-in", gallerySlot: { id: "first-video" }, media: { src: "/images/carpet-cleaning-hero.webp" } });
    expect(positions.find(position => position.id === "carpet-main-results-first-video")?.media.type).toBe("video");
  });

  it("does not present a half-pair or processing upload as a published photograph", () => {
    const pair = slot("pair", "before", { kind: "before_after", assignments: [{ role: "before", assetId: "before" }] });
    expect(inventorySlotMedia(pair, new Map([["before", asset("before")]]))).toBeNull();
    expect(inventorySlotMedia(slot("pending", "pending"), new Map([["pending", asset("pending", { status: "processing" })]]))).toBeNull();
  });

  it("offers the first connected still-image slot for a service with no published result", () => {
    const library = empty();
    library.gallerySlots = [slot("unconnected", "", { assignments: [], usages: [] }), slot("empty-video", "", { kind: "video", assignments: [], sortOrder: 1 }), slot("empty-photo", "", { assignments: [], sortOrder: 2 })];
    const hero = buildWebsiteMediaInventory(library, new Map()).find(position => position.id === "carpet-hero");
    expect(hero).toMatchObject({ source: "built-in", media: { src: "/images/carpet-cleaning-hero.webp" }, gallerySlot: { id: "empty-photo" } });
  });

  it("explains the shared-gallery route when no editable hero slot is returned", () => {
    const hero = buildWebsiteMediaInventory(empty(), new Map()).find(position => position.id === "carpet-hero");
    expect(hero?.gallerySlot).toBeUndefined();
    expect(hero?.replacementHint).toContain("Shared gallery positions");
    expect(buildWebsiteMediaInventory(empty(), new Map()).find(position => position.id === "home-service-carpet")?.replacementHint).toBeUndefined();
  });

  it("shows the after image for a complete leading pair on both sofa hero and homepage slideshow", () => {
    const library = empty();
    library.gallerySlots = [slot("pair", "before", { topicKey: "sofa", kind: "before_after", assignments: [{ role: "before", assetId: "before" }, { role: "after", assetId: "after" }], usages: [{ key: "sofa-pair", pageKey: "gallery-sofa", pageLabel: "Gallery", componentLabel: "Pair" }] })];
    const positions = buildWebsiteMediaInventory(library, new Map([["before", asset("before")], ["after", asset("after")]]));
    for (const id of ["sofa-hero", "home-carousel-sofa"]) expect(positions.find(position => position.id === id)).toMatchObject({ source: "crm", media: { type: "photo", src: "https://images.example/after.jpg" }, fallback: { src: "/sofa_upholstery/web/gallery/sofa-gallery-01.webp" } });
  });

  it("maps the commercial pair and area-specific video selection without inventing local job claims", () => {
    const positions = buildWebsiteMediaInventory(empty(), new Map());
    expect(positions.find(position => position.id === "commercial-office-result")?.media.id).toBe("carpet-office");
    for (const area of AREAS) {
      const actual = positions.filter(position => position.id.startsWith(`area-${area.slug}-`));
      expect(actual.map(position => position.media.id)).toEqual(area.coverageConfirmed === false ? [] : getAreaShowcaseVideos(area.slug).map(video => video.id));
      expect(actual.every(position => position.note?.includes("not a claim"))).toBe(true);
    }
    expect(positions.find(position => position.id === "service-carpet-carpet-process")?.href).toBe("/carpet-cleaning-london#process");
    expect(positions.find(position => position.id === "service-sofa-sofa-extraction-feature")?.href).toBe("/sofa-cleaning-london#extraction");
  });

  it("lists daily homepage comparisons reproducibly and leaves missing builders photos hidden", () => {
    const first = buildWebsiteMediaInventory(empty(), new Map(), new Date("2026-11-17T12:00:00Z"));
    const second = buildWebsiteMediaInventory(empty(), new Map(), new Date("2026-11-17T20:00:00Z"));
    expect(first.filter(position => position.id.startsWith("home-proof-"))).toEqual(second.filter(position => position.id.startsWith("home-proof-")));
    expect(first.filter(position => position.page === "After builders")).toHaveLength(0);
  });
});
