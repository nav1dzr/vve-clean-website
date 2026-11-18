import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImageDeliveryTemplate,
  getMediaConfig,
  createR2Key,
  inspectOriginal,
  originalExists,
  createUploadUrl,
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

describe('private original verification', () => {
  const expected = { original_size_bytes: 1234, original_content_type: 'image/jpeg' };
  const storage = (send) => ({ bucket: 'synthetic-test-bucket', r2: { send } });
  it('verifies exact size and type using a bounded HEAD request', async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(signal);
    const send = vi.fn().mockResolvedValue({ ContentLength: 1234, ContentType: 'image/jpeg' });
    expect(await inspectOriginal(storage(send), 'synthetic/original.jpg', expected)).toEqual({ status: 'verified' });
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: { Bucket: 'synthetic-test-bucket', Key: 'synthetic/original.jpg' } }), { abortSignal: signal });
    timeout.mockRestore();
  });
  it.each([
    [{ ContentLength: 12, ContentType: 'image/jpeg' }, 'size'],
    [{ ContentLength: 1234, ContentType: 'application/octet-stream' }, 'type'],
    [{ ContentLength: 12, ContentType: 'image/png' }, 'size-and-type'],
  ])('does not mistake an existing mismatched object for a missing one', async (metadata, reason) => {
    expect(await inspectOriginal(storage(vi.fn().mockResolvedValue(metadata)), 'synthetic/key', expected)).toEqual({ status: 'mismatch', reason });
  });
  it.each([
    { name: 'NotFound', $metadata: { httpStatusCode: 404 } },
    { name: 'NoSuchKey' },
  ])('classifies only confirmed missing-object responses as missing', async (error) => {
    expect(await inspectOriginal(storage(vi.fn().mockRejectedValue(error)), 'synthetic/key', expected)).toEqual({ status: 'missing' });
  });
  it.each([
    [{ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }, 'access'],
    [{ name: 'NotFound', $metadata: { httpStatusCode: 403 } }, 'access'],
    [{ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } }, 'access'],
    [{ name: 'SlowDown', $metadata: { httpStatusCode: 429 } }, 'temporary'],
    [{ name: 'ServiceUnavailable', $metadata: { httpStatusCode: 503 } }, 'temporary'],
    [{ name: 'AbortError' }, 'temporary'],
    [{ name: 'NetworkError' }, 'temporary'],
  ])('preserves unknown existence during access or transient failures', async (error, reason) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await inspectOriginal(storage(vi.fn().mockRejectedValue(error)), 'private-customer-key', expected)).toEqual({ status: 'unavailable', reason });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-customer-key');
    warn.mockRestore();
  });
  it('keeps the old boolean helper strict for compatibility', async () => {
    expect(await originalExists(storage(vi.fn().mockResolvedValue({ ContentLength: 1234, ContentType: 'image/jpeg' })), 'key', expected)).toBe(true);
    expect(await originalExists(storage(vi.fn().mockResolvedValue({ ContentLength: 12, ContentType: 'image/jpeg' })), 'key', expected)).toBe(false);
  });
});

it('signs a browser upload without an empty-body checksum and preserves immutable PUT protection', async () => {
  for (const key of ['CLOUDFLARE_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])
    vi.stubEnv(key, 'synthetic-presign-test');
  vi.stubEnv('CLOUDFLARE_MEDIA_ORIGIN', 'https://media.example.test');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  const config = getMediaConfig('image');
  try {
    // This uses the real installed SDK/presigner, with synthetic credentials.
    // Generating a signed URL is local and makes no storage request.
    const url = new URL(await createUploadUrl(config, 'synthetic/original.jpg', 'image/jpeg'));
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false);
    expect(url.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false);
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toContain('if-none-match');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
  } finally { config.r2.destroy(); }
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
it('requires explicit preview destinations before constructing any image or video upload configuration', () => {
  for (const key of ['CLOUDFLARE_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','MUX_TOKEN_ID','MUX_TOKEN_SECRET']) vi.stubEnv(key, 'synthetic');
  vi.stubEnv('CLOUDFLARE_MEDIA_ORIGIN', 'https://preview-media.example.com'); vi.stubEnv('VERCEL_ENV', 'preview');
  expect(getMediaConfig('image')).toBeNull(); expect(getMediaConfig('video')).toBeNull();
  vi.stubEnv('VVE_PREVIEW_R2_BUCKET_NAME', 'synthetic'); vi.stubEnv('VVE_PREVIEW_MEDIA_ORIGIN', 'https://preview-media.example.com');
  expect(getMediaConfig('image')).not.toBeNull(); expect(getMediaConfig('video')).toBeNull();
  vi.stubEnv('VVE_PREVIEW_MUX_TOKEN_ID', 'synthetic'); expect(getMediaConfig('video')).not.toBeNull();
});
