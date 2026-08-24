# Photo and video upload guide

The deployable `public` folder is currently about 40 MB, so there is room for more optimised assets. Do not copy camera originals directly into it.

## Recommended workflow

1. Keep original photos and videos in a separate local archive or cloud drive.
2. Choose only the strongest, genuinely relevant files for the website.
3. Export photos as AVIF plus WebP fallback.
4. Export short videos as H.264 MP4 plus a poster image. Remove sound unless it adds useful context.
5. Add the area only when the location is known and can be published honestly.

## Target sizes

- Hero photo: 768px and 1280px wide; aim for 60 to 180 KB per derivative.
- Before/after tile: 600 to 900px wide; aim for 50 to 140 KB.
- Team portrait: 700 to 1000px wide; aim for 70 to 160 KB.
- Thumbnail: 320 to 480px wide; aim for 20 to 60 KB.
- Video: normally 720p, 15 to 30 seconds, preferably under 4 MB.

## Naming

Use lowercase names such as `carpet-cleaning-islington-before-01.webp`. Do not put customer names, house numbers or other personal details in filenames or metadata.

## Placeholders to replace before release

- About page team/owner photograph and confirmed names/roles.
- Any location page that needs local job media before it can be indexed.
- Service hero imagery where the existing image does not show that service clearly.

Vercel's current limits are documented at <https://vercel.com/docs/limits>. VVE Clean is a commercial website, so the Vercel plan should be checked against the current commercial-use terms before release.

