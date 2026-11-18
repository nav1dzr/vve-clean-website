import { describe, expect, it } from "vitest";
import { GALLERY_MEDIA } from "../../../src/data/galleryMedia";
import { getAreaShowcaseVideos } from "../../../src/data/areaShowcase";
import { WEBSITE_MEDIA_POSITIONS } from "../../shared/mediaWebsitePositions.js";
import { AREAS } from "../../../src/data/areas";
import { buildWebsiteMediaInventory, inventorySlotMedia } from "./websiteMediaInventory";
import type { GallerySlot, MediaAsset, MediaLibrary } from "../types/media";

const empty = (): MediaLibrary => ({ assets: [], topics: [], gallerySlots: [], websiteSlots: [], references: [] });
const asset = (id: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({ id, mediaType: "image", status: "ready", title: id, altText: id, service: "Carpet", category: "carpet", placement: "gallery-carpet", beforeAfter: "none", pairKey: "", locationLabel: "", websiteVisible: true, googleEnabled: false, socialEnabled: false, requestedSlotKey: null, activeSlotKey: null, usages: [], imageUrl: `https://images.example/${id}.jpg`, muxPlaybackId: null, processingError: "", createdAt: "", updatedAt: "", filename: `${id}.jpg`, size: 50, contentType: "image/jpeg", ...extra });
const slot = (id: string, assetId: string, extra: Partial<GallerySlot> = {}): GallerySlot => ({ id, topicKey: "carpet", code: id, kind: "photo", label: id, sortOrder: 1, assignments: [{ role: "primary", assetId }], usages: [{ key: id, pageKey: "carpet-main-results", pageLabel: "Carpet", componentLabel: "Results" }], ...extra });

describe("website photograph inventory", () => {
  it("includes every original gallery item and keeps approved pairs intact", () => {
    const positions = buildWebsiteMediaInventory(empty(), new Map());
    for (const items of Object.values(GALLERY_MEDIA)) for (const item of items) {
      expect(positions.filter(position => position.page === "Gallery" && position.media?.id === item.id)).toHaveLength(1);
      expect(positions.find(position => position.page === "Gallery" && position.media?.id === item.id)?.media).toEqual(item);
    }
    expect(new Set(positions.map(position => position.id)).size).toBe(positions.length);
  });

  it("keeps static gallery images while adding CRM results and changes only the connected hero", () => {
    const library = empty();
    library.gallerySlots = [slot("work-photo", "new")];
    const positions = buildWebsiteMediaInventory(library, new Map([["new", asset("new")]]));
    expect(positions.find(position => position.id.startsWith("service-carpet-hero|"))).toMatchObject({ source: "crm", media: { src: "https://images.example/new.jpg" } });
    expect(positions.find(position => position.id.startsWith("homepage-hero-image|"))).toMatchObject({ source: "built-in", media: { src: "/images/carpet-cleaning-hero.webp" } });
    expect(positions.find(position => position.id.startsWith("homepage-service-carpet|"))).toMatchObject({ source: "built-in" });
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
    expect(positions.find(position => position.id.startsWith("service-carpet-hero|"))).toMatchObject({ source: "built-in", media: { src: "/images/carpet-cleaning-hero.webp" } });
    expect(positions.find(position => position.id === "carpet-main-results-first-video")?.media?.type).toBe("video");
  });

  it("does not present a half-pair or processing upload as a published photograph", () => {
    const pair = slot("pair", "before", { kind: "before_after", assignments: [{ role: "before", assetId: "before" }] });
    expect(inventorySlotMedia(pair, new Map([["before", asset("before")]]))).toBeNull();
    expect(inventorySlotMedia(slot("pending", "pending"), new Map([["pending", asset("pending", { status: "processing" })]]))).toBeNull();
  });

  it("connects an empty named photo independently of other positions sharing its original photograph", () => {
    const library = empty();
    const ref = { key: "home-carpet-card", pageKey: "homepage-service-carpet", pageLabel: "Homepage", componentLabel: "Service card" };
    const card = { id: "card", key: "homepage-service-carpet", pageLabel: "Homepage", purposeLabel: "Carpet card", description: "", sortOrder: 1, assignments: [], usages: [ref] };
    library.websiteSlots = [card];
    const positions = buildWebsiteMediaInventory(library, new Map());
    expect(positions.find(position => position.id.startsWith("homepage-service-carpet|"))).toMatchObject({ websiteSlot: card, source: "built-in" });
    expect(positions.find(position => position.id.startsWith("homepage-hero-image|"))?.websiteSlot).toBeUndefined();
  });

  it("shows the published replacement, records its real fallback, and restores the default after clearing", () => {
    const entry = WEBSITE_MEDIA_POSITIONS.find(position => position.kind === "before_after" && position.category === "carpet")!;
    const library = empty();
    const pair = slot("pair", "before", { code: entry.slotKey, kind: "before_after", usages: [{ key: "pair", pageKey: entry.key, pageLabel: "Carpet", componentLabel: "Results" }], assignments: [{ role: "before", assetId: "before" }, { role: "after", assetId: "after" }] });
    library.gallerySlots = [pair];
    const assets = new Map([["before", asset("before")], ["after", asset("after")]]);
    const first = buildWebsiteMediaInventory(library, assets).filter(position => position.id.startsWith(entry.key + "|"));
    expect(first.length).toBeGreaterThan(1);
    expect(first.every(position => position.source === "crm" && position.fallback === entry.defaultMedia)).toBe(true);
    pair.assignments = [];
    const restored = buildWebsiteMediaInventory(library, assets).filter(position => position.id.startsWith(entry.key + "|"));
    expect(restored.every(position => position.source === "built-in" && position.media === entry.defaultMedia)).toBe(true);
  });

  it("shows the after image for a complete leading pair on both sofa hero and homepage slideshow", () => {
    const library = empty();
    library.gallerySlots = [slot("pair", "before", { topicKey: "sofa", kind: "before_after", assignments: [{ role: "before", assetId: "before" }, { role: "after", assetId: "after" }], usages: [{ key: "sofa-pair", pageKey: "gallery-sofa", pageLabel: "Gallery", componentLabel: "Pair" }] })];
    const positions = buildWebsiteMediaInventory(library, new Map([["before", asset("before")], ["after", asset("after")]]));
    for (const id of ["service-sofa-hero", "homepage-sofa-image"]) expect(positions.find(position => position.id.startsWith(id + "|"))).toMatchObject({ source: "crm", media: { type: "photo", src: "https://images.example/after.jpg" }, fallback: { src: "/sofa_upholstery/web/gallery/sofa-gallery-01.webp" } });
  });

  it("maps the commercial pair and area-specific video selection without inventing local job claims", () => {
    const positions = buildWebsiteMediaInventory(empty(), new Map());
    expect(positions.find(position => position.page === "Commercial carpet")?.media?.id).toBe("carpet-office");
    for (const area of AREAS) {
      const actual = positions.filter(position => position.href === `/cleaning-${area.slug}#area-services`);
      expect(actual.map(position => position.media?.id).sort()).toEqual(area.coverageConfirmed === false ? [] : getAreaShowcaseVideos(area.slug).map(video => video.id).sort());
      expect(actual.every(position => position.note?.includes("across London"))).toBe(true);
    }
    expect(positions.find(position => position.page === "Carpet cleaning" && position.media?.id === "carpet-process")?.href).toBe("/carpet-cleaning-london#process");
    expect(positions.find(position => position.page === "Sofa & upholstery" && position.media?.id === "sofa-extraction-feature")?.href).toBe("/sofa-cleaning-london#extraction");
  });

  it("lists only current daily comparisons and marks upcoming builders positions as empty", () => {
    const first = buildWebsiteMediaInventory(empty(), new Map(), new Date("2026-11-17T12:00:00Z"));
    const second = buildWebsiteMediaInventory(empty(), new Map(), new Date("2026-11-17T20:00:00Z"));
    expect(first.filter(position => position.href === "/#gallery")).toEqual(second.filter(position => position.href === "/#gallery"));
    const builders = first.filter(position => position.page === "After builders");
    expect(builders).toHaveLength(2);
    expect(builders.every(position => position.source === "empty" && position.media === null)).toBe(true);
  });
});
