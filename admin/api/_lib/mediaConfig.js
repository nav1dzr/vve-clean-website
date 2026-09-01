import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REQUIRED_MEDIA_ENV = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_MEDIA_ORIGIN',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
];

export function getMediaConfig() {
  const missing = REQUIRED_MEDIA_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error('[admin/media] missing media environment variables:', missing.join(', '));
    return null;
  }

  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    mediaOrigin: process.env.CLOUDFLARE_MEDIA_ORIGIN.replace(/\/+$/, ''),
    bucket: process.env.R2_BUCKET_NAME,
    muxTokenId: process.env.MUX_TOKEN_ID,
    muxTokenSecret: process.env.MUX_TOKEN_SECRET,
    r2: new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    }),
  };
}

export function createR2Key(assetId, filename) {
  const extension = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return `originals/${assetId}/source.${extension}`;
}

export async function createUploadUrl(config, key, contentType) {
  return getSignedUrl(
    config.r2,
    new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }),
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

export async function originalExists(config, key) {
  try {
    await config.r2.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (error) {
    console.warn('[admin/media] R2 original was not available for delivery:', error?.name || 'unknown error');
    return false;
  }
}

// The media hostname is a Cloudflare-proxied custom domain whose origin is the
// R2 bucket. Cloudflare applies the /cdn-cgi/image path at the edge; this
// template deliberately never exposes an R2 API URL or signed source URL.
// `{width}` is filled by the website for srcset candidates.
export function createImageDeliveryTemplate(config, key) {
  return `${config.mediaOrigin}/cdn-cgi/image/width={width},format=auto,quality=85,fit=scale-down/${key}`;
}

export function muxAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.muxTokenId}:${config.muxTokenSecret}`).toString('base64')}`;
}
