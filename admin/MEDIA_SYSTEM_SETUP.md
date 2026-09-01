# Media system setup (preview first)

This code intentionally does not create a Cloudflare bucket, Mux account, Supabase migration, Vercel project, DNS record, or production deployment. Do those external steps only after checking the preview.

## What the system does

- iPhone/browser uploads go straight to the private R2 bucket through a 15-minute, content-type-bound URL issued only to an authenticated VVE admin.
- A photo stays as the single original in private R2. The public website receives a Cloudflare Image Transformation URL through a dedicated media hostname; the phone does not upload the source twice.
- The public website gets only an optimized Cloudflare Transformation URL or a Mux playback ID. It never receives an R2 API URL, signed source URL, original filename, or external-publishing flags.
- Media is placed through named website areas rather than file names: Main website (6 positions); each Gallery service area (20 positions); and each service page (10 positions). Replacing a position creates a new delivery asset and only swaps the position after processing succeeds. Do not overwrite an object path.

## 1. Apply the Supabase migration

Apply both media migrations in `supabase/migrations/` using the normal migration workflow for the VVE Supabase project. They create private metadata tables, the named page/gallery positions, and `public_media_slots()`, a narrowly scoped RPC that is the only public data read.

Do not add browser RLS policies to `media_assets` or `media_slots`; the admin API uses the existing `admin_users` allow-list and the service role. The public RPC returns only ready, website-enabled delivery records.

## 2. Cloudflare R2 and Image Transformations

Create an R2 bucket for private originals, for example `vve-media-originals`. Keep its S3 API private and do not enable the `r2.dev` public development URL. The only exception is the dedicated Preview media hostname described below, which is required for URL-based Transformations.

Create an R2 API token limited to that one bucket. Put its S3 access-key pair in the Preview environment only at first.

Configure this R2 CORS rule, replacing the preview domain with the actual Vercel preview origin. Add localhost only for intentional local testing:

```json
[
  {
    "AllowedOrigins": ["https://YOUR-ADMIN-PREVIEW.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Cloudflare Hosted Images is not used. Configure a dedicated **Preview-only Cloudflare media hostname** whose origin is this R2 bucket, then enable **Cloudflare Image Transformations** for that hostname. It must serve a transformation path like:

```text
https://YOUR-PREVIEW-MEDIA-HOST/cdn-cgi/image/width=1200,format=auto,quality=85,fit=scale-down/originals/...
```

Set long CDN caching for `/cdn-cgi/image/*`. Originals use unique immutable object keys, so a one-year immutable edge cache is safe. Do not enable the bucket's public development URL or publish its S3 API endpoint. The media hostname is the only delivery route exposed to the website; do not store or return signed R2 URLs in the public RPC.

Important: a custom domain attached directly to R2 makes objects reachable through that domain. The R2 API and `r2.dev` endpoint remain private/disabled, and VVE exposes only the transformed URLs with unguessable immutable object paths, but this URL-based Cloudflare feature cannot make the underlying object strictly private. If strict origin privacy is required, use Cloudflare's paid Images Worker binding instead; do not claim that direct custom-domain R2 delivery is private.

Cloudflare Transformations require a Cloudflare-proxied hostname. Creating or attaching a custom domain can involve DNS, so use a dedicated preview hostname only after explicit DNS approval. Until then, use a dedicated Cloudflare preview Worker/Pages hostname that fronts this bucket, or leave this setting unset and do not deploy the media flow.

## 3. Mux

Create a Mux API token with video read/write permissions. The code requests `video_quality: "plus"`, which is the Mux option intended for high-resolution/4K delivery; confirm your Mux plan permits it. Mux uses public playback only for assets a VVE admin marked as website-visible. Source originals remain in private R2.

## 4. Preview environment variables

Set the existing Supabase variables plus these names in the **admin Vercel project Preview environment**:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_MEDIA_ORIGIN
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

None of these starts with `VITE_`. They must never be included in the browser bundle or committed. `CLOUDFLARE_MEDIA_ORIGIN` is the HTTPS origin of the dedicated Cloudflare media hostname, without a trailing slash. It is not a secret. No Cloudflare Images API token or Hosted Images delivery hash is needed.

The public Vercel project needs only its existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Preview. No Cloudflare, R2, or Mux secret belongs there.

## 5. Validate the preview

1. Sign in as a Supabase user present in `admin_users`.
2. Visit `/media` in the admin app on an iPhone. Choose Photo or Video, then the destination and an unused position.
3. Confirm the original appears only in R2, while the preview card uses the transformed Cloudflare delivery URL.
4. Confirm it appears in the chosen preview Gallery or service page without a redeploy.
5. Upload a short MOV/MP4. It will show as “processing” until Mux finishes; use “Refresh processing” and then test playback in the Gallery.
6. Replace the same position. Confirm it shows the new result and the old original is still retained privately.

Google and social flags are eligibility metadata only. They deliberately do not send anything to Google Business Profile, Instagram, or another third party; that needs a separately approved OAuth connection and publishing workflow.
