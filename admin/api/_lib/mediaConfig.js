import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REQUIRED_MEDIA_ENV = [
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

export function getMediaConfig(mediaType = "image") {
  const required =
    mediaType === "video"
      ? [...REQUIRED_MEDIA_ENV, "MUX_TOKEN_ID", "MUX_TOKEN_SECRET"]
      : [...REQUIRED_MEDIA_ENV, "CLOUDFLARE_MEDIA_ORIGIN"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      "[admin/media] missing media environment variables:",
      missing.join(", "),
    );
    return null;
  }

  let origin;
  try {
    origin = process.env.CLOUDFLARE_MEDIA_ORIGIN ? new URL(process.env.CLOUDFLARE_MEDIA_ORIGIN) : null;
  } catch { if (mediaType === "image") return null; }
  if (mediaType === "image" && (!origin ||
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash)
  )
    return null;
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    mediaOrigin: origin?.origin || "",
    bucket: process.env.R2_BUCKET_NAME,
    muxTokenId: process.env.MUX_TOKEN_ID,
    muxTokenSecret: process.env.MUX_TOKEN_SECRET,
    r2: new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    }),
  };
}

export function createR2Key(assetId, filename) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      assetId,
    )
  )
    throw new Error("Invalid media identifier");
  const extension =
    (filename.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
  return `originals/${assetId}/source.${extension}`;
}

export async function createUploadUrl(config, key, contentType) {
  return getSignedUrl(
    config.r2,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      IfNoneMatch: "*",
    }),
    { expiresIn: 15 * 60 },
  );
}

export async function createDownloadUrl(config, key) {
  return getSignedUrl(
    config.r2,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 20 * 60 },
  );
}

export async function originalExists(config, key, expected) {
  try {
    const object = await config.r2.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    return (
      !expected ||
      (Number(object.ContentLength) === Number(expected.original_size_bytes) &&
        object.ContentType === expected.original_content_type)
    );
  } catch (error) {
    console.warn(
      "[admin/media] R2 original was not available for delivery:",
      error?.name || "unknown error",
    );
    return false;
  }
}

// The Worker reconstructs the immutable private R2 key from this constrained
// public route. The URL never reveals an R2 endpoint, a signed URL, the source
// filename, or a route that can return original bytes. `{width}` is filled by
// the website for srcset candidates.
export function createImageDeliveryTemplate(config, assetId, key) {
  const match = /^originals\/([0-9a-f-]{36})\/source\.([a-z0-9]{1,8})$/i.exec(
    key,
  );
  const extension = match?.[2]?.toLowerCase();
  if (!extension || match[1].toLowerCase() !== assetId.toLowerCase())
    throw new Error("Media image key does not belong to this asset");
  return `${config.mediaOrigin}/image/{width}/${assetId}.${extension}`;
}

export function muxAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.muxTokenId}:${config.muxTokenSecret}`).toString("base64")}`;
}
