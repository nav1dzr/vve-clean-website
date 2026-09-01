# Media system setup (preview first)

This code intentionally does not create a Cloudflare bucket, Mux account, Supabase migration, Vercel project, DNS record, or production deployment. Do those external steps only after checking the preview.

## What the system does

- iPhone/browser uploads go straight to the private R2 bucket through a 15-minute, content-type-bound URL issued only to an authenticated VVE admin.
- A photo stays as the single original in private R2. The public website receives an optimized response from a dedicated Cloudflare Worker; the phone does not upload the source twice.
- The public website gets only an optimized Cloudflare Transformation URL or a Mux playback ID. It never receives an R2 API URL, signed source URL, original filename, or external-publishing flags.
- Media is placed through named website areas rather than file names: Main website (6 positions); each Gallery service area (20 positions); and each service page (10 positions). Replacing a position creates a new delivery asset and only swaps the position after processing succeeds. Do not overwrite an object path.

## 1. Apply the Supabase migration

Before applying anything, confirm that the target is an isolated **Preview Supabase Branch** (preferred) or a completely separate Preview project. Do not apply the original media migrations to a shared project. For the temporary `vve-os` Preview database, apply `20260901120000_create_media_preview_isolation.sql` and then `20260901200000_add_two_part_media_model.sql`. They create only separate, uniquely prefixed media objects; they do not alter VVE OS tables, functions, policies, storage, or Auth. The second migration adds the Gallery/Website/assignment/reference model and a public-safe `public_media_preview_references()` RPC.

## Two-part media manager

```text
Gallery       → Carpet / Sofa / End of Tenancy → fixed curated positions
Website       → exact page + purpose for standalone changeable media
Uploads       → private, unassigned media library
```

Each Gallery topic contains exactly five Before/After sets (`BA01`–`BA05`),
four videos (`VIDEO01`–`VIDEO04`) and ten grid photos (`PHOTO01`–`PHOTO10`).
Gallery positions can be referenced by the Gallery itself, a main service page,
or later a local page. They are pointers to one original asset, never copies.

Do not add browser RLS policies to the Preview media tables; the admin API uses `media_preview_admin_users`, a dedicated empty-by-default allow-list, and the service role. Add a row only after an administrator already exists in the Preview project's Auth users. The public RPC returns only ready, website-enabled delivery records.

## 2. Private R2 and Cloudflare Worker image delivery

Use `vve-media-originals` for private originals. Keep its S3 API private, do not enable `r2.dev`, and do not attach a public R2 custom domain. The Worker is the sole public image-delivery route.

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

Cloudflare Hosted Images is not used. Deploy `cloudflare/media-preview-worker/` as a Preview-only Worker with the existing `vve-media-originals` bucket bound as `MEDIA_ORIGINALS` and the Cloudflare Images binding as `IMAGES`. The Worker reads raw private R2 bytes, chooses AVIF/WebP/JPEG from the browser's `Accept` header (the equivalent of `format=auto`), applies one of the bounded responsive widths and quality 85, and writes immutable responses to Workers Cache.

The public route is deliberately limited to an optimized representation, for example:

```text
https://YOUR-PREVIEW-MEDIA-HOST/image/1200/ASSET-UUID.heic
```

It accepts neither raw R2 paths nor arbitrary dimensions and never returns the original object bytes. Originals use unique immutable object keys, so its one-year immutable browser/CDN cache is safe: replacing a gallery position points to a new asset URL, avoiding stale imagery without a redeploy. Do not expose the bucket's public development URL or S3 API endpoint. Do not store or return signed R2 URLs in the public RPC.

The production zone's DNS must never be changed for this setup. Use the Worker `workers.dev` hostname for an initial Preview test. A later Preview-only custom hostname such as `media-preview.vveclean.com` must be attached to the Worker manually after a separately approved DNS change; never attach it directly to R2.

The Images binding is billed by unique transformation. Confirm the Cloudflare Images plan supports the Worker binding before deployment.

## 3. Mux

Create a Mux API token with video read/write permissions. The code requests `video_quality: "plus"`, which is the Mux option intended for high-resolution/4K delivery; confirm your Mux plan permits it. Mux uses public playback only for assets a VVE admin marked as website-visible. Source originals remain in private R2.

## 4. Preview environment variables

Set the isolated Preview Supabase variables plus these names only on the `codex/media-system` branch in the **admin Vercel project Preview environment**:

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

The public Vercel project needs only the isolated Preview `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on that branch. No Cloudflare, R2, Mux, or Supabase service-role secret belongs there.

## 5. Validate the preview

1. Sign in as a Supabase user present in `admin_users`.
2. Visit `/media` in the admin app on an iPhone. Choose Photo or Video, then the destination and an unused position.
3. Confirm the original appears only in R2, while the preview card uses the Worker delivery URL.
4. Confirm it appears in the chosen preview Gallery or service page without a redeploy.
5. Upload a short MOV/MP4. It will show as “processing” until Mux finishes; use “Refresh processing” and then test playback in the Gallery.
6. Replace the same position. Confirm it shows the new result and the old original is still retained privately.

Google and social flags are eligibility metadata only. They deliberately do not send anything to Google Business Profile, Instagram, or another third party; that needs a separately approved OAuth connection and publishing workflow.
