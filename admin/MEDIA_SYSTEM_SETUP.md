# Media system setup (preview first)

This code intentionally does not create a Cloudflare bucket, Mux account, Supabase migration, Vercel project, DNS record, or production deployment. Do those external steps only after checking the preview.

## What the system does

- iPhone/browser uploads go straight to the private R2 bucket through a 15-minute, content-type-bound URL issued only to an authenticated VVE admin.
- A photo stays as the single original in private R2. The public website receives an optimized response from a dedicated Cloudflare Worker; the phone does not upload the source twice.
- The public website gets only an optimized Cloudflare Transformation URL or a Mux playback ID. It never receives an R2 API URL, signed source URL, original filename, or external-publishing flags.
- Media is placed through named website areas rather than file names: Main website (6 positions); each Gallery service area (20 positions); and each service page (10 positions). Replacing a position creates a new delivery asset and only swaps the position after processing succeeds. Do not overwrite an object path.

## 1. Apply the Supabase migration

Apply `20260902090000_add_crm_media_library.sql` to the existing **CRM
Supabase project** only. It adds dedicated `media_*` tables and a narrowly
scoped `public_media_references()` RPC. It does not modify CRM business
tables, CRM Auth, VVE OS, Storage, policies on existing tables, or Production.

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

Do not add browser RLS policies to the media tables. The admin API uses the
existing CRM `admin_users` allow-list and its service role after validating the
normal CRM session. The public RPC returns only ready, website-enabled delivery
records and never exposes originals or CRM business data.

## 2. Private R2 and Cloudflare Worker image delivery

Use `vve-media-originals` for private originals. Keep its S3 API private, do not enable `r2.dev`, and do not attach a public R2 custom domain. The Worker is the sole public image-delivery route.

Create an R2 API token limited to that one bucket. Put its S3 access-key pair in the Preview environment only at first.

Configure this R2 CORS rule, replacing the preview domain with the actual Vercel preview origin. Add localhost only for intentional local testing:

```json
[
  {
    "AllowedOrigins": ["https://YOUR-ADMIN-PREVIEW.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
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

Keep `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` pointed at the CRM Supabase project: they are the
normal CRM browser-auth and server data connection. Set these media-hosting
names only on the Media feature branch in the **admin Vercel Preview**
environment:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_MEDIA_ORIGIN
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

None of the media-hosting secrets starts with `VITE_`; they must never be
included in the browser bundle or committed. `CLOUDFLARE_MEDIA_ORIGIN` is the
HTTPS origin of the dedicated Cloudflare media hostname, without a trailing
slash. It is not a secret. No Cloudflare Images API token or Hosted Images
delivery hash is needed.

The public website Media feature branch receives only
`VITE_MEDIA_SUPABASE_URL` and `VITE_MEDIA_SUPABASE_ANON_KEY` for the CRM
project's `public_media_references()` RPC. Its ordinary website connection
remains untouched. No Cloudflare, R2, Mux, or Supabase service-role secret
belongs in the public website build.

## 5. Validate the preview

1. Sign in as a Supabase user present in `admin_users`.
2. Visit `/media` in the normal CRM app on an iPhone. Use **Choose from Photos or Files** (not the camera-only control), select several items, then choose a destination and an unused position.
3. Confirm the original appears only in R2, while the preview card uses the Worker delivery URL.
4. Confirm it appears in the chosen preview Gallery or service page without a redeploy.
5. Upload a short MOV/MP4. It will show as “processing” until Mux finishes; use “Refresh processing” and then test playback in the Gallery.
6. Replace the same position. Confirm it shows the new result and the old original is still retained privately.

Google and social flags are eligibility metadata only. They deliberately do not send anything to Google Business Profile, Instagram, or another third party; that needs a separately approved OAuth connection and publishing workflow.


## September completion changes: validation required before enablement

Apply `20260908110000_media_publication.sql` after the CRM media library migration in the approved test database. It adds service-role-only transactional publication, position history, reversible archive, twenty work-photo positions per service, and the explicit During cleaning stage. It does not change bookings, Auth, payments or DNS.

Photo upload needs R2 and the delivery Worker; Mux credentials are required only for video. Confirm browser PUT CORS includes both Content-Type and If-None-Match. Signed uploads use a conditional create so an old URL cannot overwrite an already stored original. A 412 response means the original exists: use Retry processing instead of overwriting. Validate actual type/size against R2 metadata and successful image delivery before Ready.

Uploads show transfer percentage, a 60-second no-progress timeout, a 15-minute maximum, cancellation and retry. A refresh retains the server upload record; the owner chooses the same file to retry. Transfer retry restarts the file (not byte-range resume). Supported limits are 40 MB per photo and 500 MB per video. Originals are never deleted by archive.

Videos are checked every 12 seconds while the manager is open. An uncertain Mux create is reconciled against recent assets by its passthrough identifier and never automatically creates a duplicate. If the record is older than the latest 100 Mux assets, support must reconcile its provider ID. Closed-browser webhook completion is not enabled by this phase. Mux create uses the documented inputs field.

Publish previews display all affected pages and the expected old assignments. Both photos of a before/after job publish in one transaction; stale edits are rejected. A caption and accessibility description are required. Previous versions can be reviewed and restored; archived media must be restored before reusing it. Site visitors start managed videos deliberately; a gallery grid does not instantiate twenty players.

Required preview checks: small JPG and HEIC delivery, short MOV processing, interrupted/expired upload, published pair replacement and rollback, stale staff review, archive in-use rejection, image-only credentials, and shared Gallery/service-page refresh. Source/API tests do not establish cloud readiness. No cloud mutations or real uploads were performed by implementation.
