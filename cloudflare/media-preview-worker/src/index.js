const ALLOWED_WIDTHS = new Set([480, 768, 1200, 1600, 2400]);
const ALLOWED_EXTENSIONS = new Set(['avif', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function outputFormat(accept = '') {
  if (accept.includes('image/avif')) return 'image/avif';
  if (accept.includes('image/webp')) return 'image/webp';
  return 'image/jpeg';
}

export function mediaRequest(pathname) {
  const match = /^\/image\/(\d+)\/([0-9a-f-]{36})\.([a-z0-9]{1,8})$/i.exec(pathname);
  if (!match) return null;
  const width = Number(match[1]);
  const assetId = match[2].toLowerCase();
  const extension = match[3].toLowerCase();
  if (!ALLOWED_WIDTHS.has(width) || !ALLOWED_EXTENSIONS.has(extension)) return null;
  return { width, assetId, extension, key: `originals/${assetId}/source.${extension}` };
}

function responseHeaders(response, format) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', CACHE_CONTROL);
  headers.set('CDN-Cache-Control', CACHE_CONTROL);
  headers.set('Vary', 'Accept');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('Content-Type', format);
  return headers;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    const target = mediaRequest(new URL(request.url).pathname);
    if (!target) return new Response('Not found', { status: 404 });

    // Each representation has a unique cache key, so `format=auto` can safely
    // negotiate AVIF/WebP/JPEG from Accept without serving the wrong variant.
    const format = outputFormat(request.headers.get('Accept') || '');
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('__format', format);
    const cacheKey = new Request(cacheUrl, { method: 'GET' });
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;

    const original = await env.MEDIA_ORIGINALS.get(target.key);
    if (!original?.body) return new Response('Not found', { status: 404 });

    try {
      const transformed = await env.IMAGES
        .input(original.body)
        .transform({ width: target.width, fit: 'scale-down' })
        .output({ format, quality: 85 })
        .response();
      const response = new Response(transformed.body, { status: transformed.status, headers: responseHeaders(transformed, format) });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      console.error('Image transformation failed', { assetId: target.assetId, message: error instanceof Error ? error.message : 'unknown' });
      return new Response('Image unavailable', { status: 422 });
    }
  },
};
