# Managed website prices

The CRM **Website prices** section saves a named, immutable draft, previews representative totals and the exact price changes, then publishes that reviewed version. Restoring a previous version creates a new recorded publication. Existing bookings and invoices keep their saved agreed amounts; this feature does not recalculate them.

No catalogue price amount was changed in this implementation. The £30 deposit, payment policies, postcode coverage, guarantee and discount rules cannot be edited through this price editor. Standard service prices and applicable minimums are editable; derived figures such as Complete EOT headlines and commercial minimum charges come from the same selected version.

## Data and calculation

- `shared/pricingCatalogue.js` contains the existing calculation rules inside `createPricingCatalogue(overrides)`. Each call returns a separate immutable catalogue; one request cannot change another request's prices.
- `website_pricebook_versions` stores complete, immutable snapshots of all 97 editable prices. Both API and database reject unknown/protected fields, incomplete saved snapshots, invalid amounts and a Complete EOT price below its matching Tailored price. `website_pricebook_state` points to the current version. The SQL publication function locks and compares the version reviewed by the administrator, preventing a stale review from overwriting a newer publication. Adding an editable field requires a corresponding database shape migration.
- The public API exposes only the published version ID, overrides and publication date. Drafts and staff identifiers are not public.
- Browser startup resolves one published version before importing the application, so module-level service tables, captions containing prices, calculators and structured service data use the same version. The request carries its version so the server can require a fresh review when current prices differ.
- The private booking-management page uses its agreed booking snapshot and remains available when the public pricebook endpoint is down.

## Isolated setup and release

1. Apply `20260908130000_website_pricebook.sql` to the approved isolated database and test draft, preview, publish, concurrent publication, rollback and failure states.
2. Keep `WEBSITE_PRICEBOOK_ENABLED` disabled until the website API, CRM and database are ready. While disabled, the public API/build use bundled prices and the CRM cannot publish.
3. Configure `WEBSITE_PRICEBOOK_ENABLED=true` consistently in the website and CRM environments. The website build also needs `WEBSITE_PRICEBOOK_SOURCE_URL` pointing to its HTTPS public pricebook endpoint.
4. Configure `WEBSITE_PRICEBOOK_REFRESH_URL` on the CRM server as the approved website build hook. Treat that URL as a secret; never place it in browser variables or logs. The editor blocks publication without an enabled runtime and this connection.
5. The prebuild command `node scripts/sync-website-pricebook.mjs` fetches and validates the published version before the client and server bundles are produced. With managed prices enabled, a failed read stops the build instead of shipping an old snapshot.

Interactive pages use new published prices on new visits. Search-visible prerendered pages update after the website build completes. A successful hook request means the build was requested, not that deployment finished. The CRM reports this distinction and exposes retry for a failed/pending hook. Verify the completed deployment and public version before treating the search-page refresh as complete.

Hosted previews also require the separate database and destination declarations in [preview isolation](deployment-isolation-readiness.md), including `VVE_PREVIEW_PRICEBOOK_REFRESH_URL` matching the selected preview build hook. Do not inherit a production build hook or enable an approval marker against either active database.

Production data, environment variables and build hooks have not been changed by these implementation files. The actual migration has passed the disposable PostgreSQL checks below. Connected Supabase, authentication and build-hook flows still require isolated environment verification before release.

## Validation

Tests cover unchanged default amounts, isolated concurrent price versions, derived totals and minimums, immutable inputs, protected/invalid edits, the existing leaflet discount and rug assessment, authenticated publication, non-writing previews, missing configuration, optimistic publication conflicts, and the CRM's saved-review-before-publish flow.

Run `node scripts/validate-website-pricebook-db.mjs` with `@electric-sql/pglite` available, or pass `--pglite` with its local module entry-point path. The runner executes the actual migration in a fresh in-memory database, tests all three roles, immutable version data, malformed drafts, pointer changes, conflicting publications and rollback, and closes the database. It never reads a database URL or connects to a remote database. PGlite serializes one connection; competing publication checks verify the SQL comparison and lock logic but are not a production load test.

After building, `node scripts/validate-indexable-links.mjs` verifies that all sitemap routes have incoming links from other indexable pages and are reachable from the homepage. The current 21 routes pass; all five formerly unlinked audit pages now have useful links in their corresponding service or coverage sections.
