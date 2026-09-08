import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImageDeliveryTemplate,
  getMediaConfig,
  createR2Key,
} from "../api/_lib/mediaConfig.js";

describe("R2 image transformation delivery", () => {
  it("builds a Worker route without exposing a signed, API, or raw R2 source URL", () => {
    const assetId = "11111111-2222-3333-4444-555555555555";
    const url = createImageDeliveryTemplate(
      { mediaOrigin: "https://media-preview.example.test" },
      assetId,
      `originals/${assetId}/source.jpg`,
    );

    expect(url).toBe(
      `https://media-preview.example.test/image/{width}/${assetId}.jpg`,
    );
    expect(url).not.toContain("r2.cloudflarestorage.com");
    expect(url).not.toContain("X-Amz-");
    expect(url).not.toContain("originals/");
  });
});

afterEach(() => vi.unstubAllEnvs());
it("does not require video credentials for photographs", () => {
  for (const key of [
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_BUCKET_NAME",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ])
    vi.stubEnv(key, "test");
  vi.stubEnv("CLOUDFLARE_MEDIA_ORIGIN", "https://media.example");
  vi.stubEnv("MUX_TOKEN_ID", "");
  vi.stubEnv("MUX_TOKEN_SECRET", "");
  expect(getMediaConfig("image")).not.toBeNull();
  expect(getMediaConfig("video")).toBeNull();
});
it("rejects a different asset object path", () => {
  expect(() =>
    createImageDeliveryTemplate(
      { mediaOrigin: "https://media.example" },
      "11111111-2222-3333-4444-555555555555",
      "originals/99999999-2222-3333-4444-555555555555/source.jpg",
    ),
  ).toThrow();
  expect(() => createR2Key("../unsafe", "photo.jpg")).toThrow();
});
