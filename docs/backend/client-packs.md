# Private customer report packs (review draft)

This additive feature extends the existing CRM deployment and Supabase report storage. It imports a bespoke completion PDF and selected original JPEG/PNG/MP4 files, rather than generating another invoice or exposing the marketing gallery. No email endpoint is added and no issued financial record changes. All code, schema and content await release approval.

## Enable after approval

1. Apply `20261117010000_cleaning_client_packs.sql` to the approved database. This creates one service-role-only table with optional customer, booking and invoice foreign keys. It expands the **existing private** report bucket to 100 MiB and MP4. Existing native report limits stay unchanged in their API.
2. Deploy the CRM changes and set `CLIENT_PACKS_ENABLED=true` on that approved environment. Frontend flag is controlled by the UI implementation. Hosted previews also require the existing isolated-preview settings; never connect them to production for writes.
3. Resolve actual customer/booking/invoice IDs, create a draft, upload files via signed upload URL, and complete each upload. File type/size is checked against server Storage metadata. A pack requires exactly one verified PDF, permits 29 media files and remains private until explicit link publication.
4. Check the resulting customer view and expiry before approved email send. The email is prepared separately; publication does not send anything.

## API

Admin `GET /api/customers?resource=client-packs` lists the newest 100 packs. `&id=UUID` reads one. Both pack handlers are dispatched by the existing customers function to preserve the 12-function deployment budget; normal customer access still requires administrator authentication. All admin requests use existing Supabase session/admin allow-list. POST actions: `create`, `update`, `reserveUpload`, `completeUpload`, `removeAsset`, `publish`, `revoke`. Every mutation except create requires current `id` and `revision`; conflicts return 409. Metadata fields are camelCase inputs (`customerName`, `propertyAddress`, `serviceDate`, `invoiceReference`, `customerId`, `bookingId`, `invoiceId`) and snake_case persisted fields.

Upload reservation `{kind,mime,size,caption,stage}` returns `{pack,asset,upload:{path,token,signedUrl}}`. Use existing Supabase `storage.from('cleaning-reports-private').uploadToSignedUrl(path, token, file, {contentType:mime,upsert:false})`, then complete with `{assetId}`. Allowed: PDF 4 MiB, JPEG/PNG 10 MiB, MP4 100 MiB; combined selection 500 MiB. Stage is `record`, `during`, `earlier` or `later`; there is no automatically inferred before/after label. Original bytes are never transformed. Removal only deselects a draft asset and preserves stored originals. Failed reservations/uploads can leave private orphan objects for deliberate future cleanup.

Publish requires `{confirmed:true,expiresInDays:1..90}` (default30). Returns `{pack,token,viewPath:'/report-view#TOKEN'}`. The 256-bit token is returned once; only its SHA-256 digest persists. Store/copy the full link securely after publication; a lost link must be revoked and reissued. Published/revoked contents are fixed. Create a new draft to change them. Revoked packs can be republished with a new token.

Public `POST /api/customers?resource=client-pack-view {token}` returns only client-safe metadata and signed assets, never record IDs (except asset IDs), storage keys, hashes, creator IDs, email addresses or any internal notes. The token belongs in the URL **fragment**, not query parameters. The frontend reads the fragment into memory and retains it for reloads; fragments are not included in HTTP requests or referrers. Do not add analytics to this route or log request bodies. Signed files last at most five minutes and no longer than the pack expiry. Re-fetch the metadata to refresh them.

## Access limits and verification

A bearer link grants access to anyone it is forwarded to. Do not present it as recipient-identity authentication. Revocation immediately blocks new metadata access; a file URL already issued can remain valid for up to five minutes. Downloaded copies cannot be recalled. Pages/API responses use no-store/noindex/no-referrer. No external service receives a page-view token by design.

The feature flag defaults off. No schema was applied, no files uploaded to production, no publication link issued and no message sent during local preparation. Local unit/route tests cover publication prerequisites, media validation, optimistic revision, expiry, revocation, wrong-token isolation and public-field filtering. Actual Supabase signed upload, browser playback and an actual inbox delivery require an approved isolated environment/live release check; mocks are not proof of those external operations.
