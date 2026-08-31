# Media system setup (preview first)

This code intentionally does not create a Cloudflare bucket, Cloudflare Images account, Mux account, Supabase migration, Vercel project, DNS record, or production deployment. Do those external steps only after checking the preview.

## What the system does

- iPhone/browser uploads go straight to the private R2 bucket through a 15-minute, content-type-bound URL issued only to an authenticated VVE admin.
- The private R2 original is then imported server-to-server into Cloudflare Images (photos) or Mux Plus (videos). The phone does not upload the same source twice.
- The public website gets only an optimized Cloudflare Images delivery URL or a Mux playback ID. It never receives an R2 key, source URL, original filename, or external-publishing flags.
- Media is placed through named website areas rather than file names: Main website (6 positions); each Gallery service area (20 positions); and each service page (10 positions). Replacing a position creates a new delivery asset and only swaps the position after processing succeeds. Do not overwrite an object path.

## 1. Apply the Supabase migration

Apply both media migrations in `supabase/migrations/` using the normal migration workflow for the VVE Supabase project. They create private metadata tables, the named page/gallery positions, and `public_media_slots()`, a narrowly scoped RPC that is the only public data read.

Do not add browser RLS policies to `media_assets` or `media_slots`; the admin API uses the existing `admin_users` allow-list and the service role. The public RPC returns only ready, website-enabled delivery records.

## 2. Cloudflare

Create an R2 bucket for private originals, for example `vve-media-originals`. Do not enable public bucket access and do not attach a public custom domain to it.

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

Enable Cloudflare Images and create a public variant named `public` sized for website use (for example, automatic format and quality with a 2400px maximum width). Create an API token limited to Images edit access for this account. The source in R2 remains private; only records flagged for the website can be returned by the public VVE gallery RPC.

## 3. Mux

Create a Mux API token with video read/write permissions. The code requests `video_quality: "plus"`, which is the Mux option intended for high-resolution/4K delivery; confirm your Mux plan permits it. Mux uses public playback only for assets a VVE admin marked as website-visible. Source originals remain in private R2.

## 4. Preview environment variables

Set the existing Supabase variables plus these names in the **admin Vercel project Preview environment**:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_IMAGES_DELIVERY_HASH
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

None of these starts with `VITE_`. They must never be included in the browser bundle or committed. The Cloudflare delivery hash is not a secret; it is kept server-side here because the admin API builds the delivery URL itself.

The public Vercel project needs only its existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Preview. No Cloudflare, R2, or Mux secret belongs there.

## 5. Validate the preview

1. Sign in as a Supabase user present in `admin_users`.
2. Visit `/media` in the admin app on an iPhone. Choose Photo or Video, then the destination and an unused position.
3. Confirm the original appears only in R2, while the preview card uses the Cloudflare delivery copy.
4. Confirm it appears in the chosen preview Gallery or service page without a redeploy.
5. Upload a short MOV/MP4. It will show as “processing” until Mux finishes; use “Refresh processing” and then test playback in the Gallery.
6. Replace the same position. Confirm it shows the new result and the old original is still retained privately.

Google and social flags are eligibility metadata only. They deliberately do not send anything to Google Business Profile, Instagram, or another third party; that needs a separately approved OAuth connection and publishing workflow.
