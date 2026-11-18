import { describe, expect, it } from "vitest";
import {
  checkMediaFile,
  formatFileSize,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MEDIA_ACCEPT,
  mediaContentType,
} from "./mediaFileCheck";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("media file check before upload", () => {
  it("accepts supported photos and videos and reports their kind", () => {
    expect(checkMediaFile(file("kitchen.JPG", "image/jpeg"))).toEqual({
      ok: true, kind: "photo", contentType: "image/jpeg",
    });
    expect(checkMediaFile(file("sofa.mov", "video/quicktime"))).toEqual({
      ok: true, kind: "video", contentType: "video/quicktime",
    });
  });

  it("recognises an iPhone photo or video when the browser reports no type", () => {
    expect(mediaContentType(file("IMG_0001.HEIC", ""))).toBe("image/heic");
    expect(checkMediaFile(file("IMG_0002.MOV", ""))).toEqual({
      ok: true, kind: "video", contentType: "video/quicktime",
    });
  });

  it("offers supported extensions to phone pickers and handles a generic file-provider type", () => {
    const accepted = MEDIA_ACCEPT.split(",");
    for (const extension of [".heic", ".heif", ".mov", ".m4v", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".mp4", ".webm"])
      expect(accepted).toContain(extension);
    expect(accepted).not.toContain("application/octet-stream");
    expect(checkMediaFile(file("IMG_001.HEIC", "application/octet-stream"))).toEqual({
      ok: true, kind: "photo", contentType: "image/heic",
    });
    expect(checkMediaFile(file("IMG_002.MOV", "application/octet-stream"))).toEqual({
      ok: true, kind: "video", contentType: "video/quicktime",
    });
    expect(checkMediaFile(file("document.pdf", "application/octet-stream"))).toMatchObject({ ok: false });
    expect(checkMediaFile(file("unknown", "application/octet-stream"))).toMatchObject({ ok: false });
  });

  it("never guesses a type the browser has identified as unsupported", () => {
    expect(checkMediaFile(file("notes.jpg", "application/pdf"))).toMatchObject({ ok: false });
    expect(checkMediaFile(file("logo.svg", "image/svg+xml"))).toMatchObject({
      ok: false, reason: expect.stringContaining("not supported"),
    });
  });

  it("explains a mismatched extension, an empty file and an over-long name", () => {
    expect(checkMediaFile(file("photo.png", "image/jpeg"))).toMatchObject({
      ok: false, reason: expect.stringContaining(".jpg"),
    });
    expect(checkMediaFile(file("photo.jpg", "image/jpeg", 0))).toMatchObject({
      ok: false, reason: expect.stringContaining("empty"),
    });
    expect(checkMediaFile(file(`${"a".repeat(180)}.jpg`, "image/jpeg"))).toMatchObject({
      ok: false, reason: expect.stringContaining("too long"),
    });
  });

  it("rejects photos above the provider's decimal 20 MB boundary before upload", () => {
    expect(MAX_PHOTO_BYTES).toBe(20_000_000);
    expect(checkMediaFile(file("a.jpg", "image/jpeg", MAX_PHOTO_BYTES))).toMatchObject({ ok: true });
    expect(checkMediaFile(file("a.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1))).toMatchObject({
      ok: false, reason: expect.stringContaining("20 MB"),
    });
    expect(checkMediaFile(file("a.HEIC", "", 20 * 1024 * 1024))).toMatchObject({ ok: false });
  });

  it("retains the 500 MB video boundary", () => {
    expect(checkMediaFile(file("a.mp4", "video/mp4", MAX_VIDEO_BYTES))).toMatchObject({ ok: true });
    expect(checkMediaFile(file("a.mp4", "video/mp4", MAX_VIDEO_BYTES + 1))).toMatchObject({ ok: false });
  });

  it("formats sizes for people", () => {
    expect(formatFileSize(500)).toBe("500 bytes");
    expect(formatFileSize(81443)).toBe("80 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(formatFileSize(120 * 1024 * 1024)).toBe("120 MB");
  });
});
