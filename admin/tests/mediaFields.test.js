import { describe, expect, it } from "vitest";
import {
  normaliseMetadata,
  validateNewAsset,
  toMediaSummary,
} from "../api/_lib/mediaFields.js";

describe("media upload fields", () => {
  it("accepts browser-safe iPhone photo details and keeps a new upload unassigned", () => {
    const result = validateNewAsset({
      filename: "Living room.jpg",
      contentType: "image/jpeg",
      size: 1234,
      category: "carpet",
      beforeAfter: "after",
      pairKey: "Job August 2026!",
      websiteVisible: true,
      placement: "gallery-carpet",
      slotKey: "gallery-carpet-01",
      altText: "Clean carpet after extraction",
    });
    expect(result.ok).toBe(true);
    expect(result.value.mediaType).toBe("image");
    expect(result.value.pairKey).toBe("job-august-2026");
    expect(result.value.requestedSlotKey).toBe(null);
  });

  it("does not accept an untrusted content type or arbitrary slot key", () => {
    expect(
      validateNewAsset({
        filename: "script.svg",
        contentType: "image/svg+xml",
        size: 100,
      }).ok,
    ).toBe(false);
    expect(normaliseMetadata({ slotKey: "gallery-99" }).requestedSlotKey).toBe(
      null,
    );
  });
});

describe("media integrity limits", () => {
  it("rejects file extension/type mismatch, traversal and oversized originals", () => {
    for (const row of [
      { filename: "photo.svg", contentType: "image/jpeg", size: 100 },
      { filename: "../photo.jpg", contentType: "image/jpeg", size: 100 },
      {
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 41 * 1024 * 1024,
      },
      {
        filename: "video.mov",
        contentType: "video/quicktime",
        size: 501 * 1024 * 1024,
      },
    ])
      expect(validateNewAsset(row).ok).toBe(false);
  });
  it("keeps publication unavailable to upload metadata", () => {
    expect(
      validateNewAsset({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 100,
        websiteVisible: true,
      }).value.websiteVisible,
    ).toBe(false);
  });
  it("uses a supported thumbnail width without returning original storage paths", () => {
    const summary = toMediaSummary({
      media_type: "image",
      delivery_url: "https://media.example/image/{width}/id.jpg",
      r2_key: "private",
      original_filename: "photo.jpg",
    });
    expect(summary.imageUrl).toContain("/768/");
    expect(summary).not.toHaveProperty("r2_key");
  });
});
