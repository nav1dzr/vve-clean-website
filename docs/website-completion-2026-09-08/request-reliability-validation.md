# Request reliability and measurement validation — 8 September 2026

Implemented and validated locally. No production database, email, Google Ads request or customer record was used. The new SQL migration is still a release prerequisite; these results do not establish that it is deployed.

## Corrections

- Concurrent contact saves share one UUID and one enquiry row. A losing unique-key insert reads the saved result and does not send a second notification.
- Notification claims return the current database row and a unique lease token. A stale CRM snapshot cannot resend channels that another worker already completed. Each channel records `sending` before delivery and checkpoints its result separately; a worker with an obsolete token cannot overwrite results or release a newer lease.
- Unconfirmed channels require the staff destination-check checkbox before a manual retry. Completed channels are always skipped. SMTP and the existing external notification services cannot guarantee exactly-once delivery after an ambiguous timeout; this is surfaced in the CRM. A notification error never reverses a successfully saved enquiry.
- Staff edits include the displayed `updated_at` revision and receive a conflict instead of silently overwriting another change. Unsaved notes are protected from refresh, filter changes and notification retries. Delayed list responses cannot replace a newer result.
- Contact request parsing preserves UTF-8 across stream chunks and accepts a bounded 32 KB body. Invalid retry UUIDs are rejected. Browser retry storage contains only a SHA-256 fingerprint and UUID; older browsers retain the payload comparison in memory and generate UUIDs using secure random bytes.
- Google tags and analytics events run only on `vveclean.co.uk` and `www.vveclean.co.uk`. Localhost, IP preview servers and Vercel preview domains send no events through this path. The private `/manage-booking` path is blocked before tag loading, including uppercase and percent-encoded variants; it receives noindex and no-referrer metadata. Conversion identifiers must be UUIDs, and optional request conversions require the actual full `AW-18214693277/<label>` environment value. No real request label was invented or configured.
- Withdrawing advertising consent removes session measurement deduplication records while retaining essential enquiry retry and requested discount storage. Private paths and query parameters are excluded from stored landing-page values.
- Contact acknowledgement HTML and plain text now agree on replies during opening hours and the registered company identity. Long Telegram notifications point staff to the complete CRM message.

## Verification

Passed 104 focused public tests, 16 focused CRM tests, both public and CRM TypeScript checks, and focused lint in each project. Tests cover simultaneous enquiry saves, stale notification rows, overlapping sends, failed durable checkpoints, partial completed deliveries, explicit retry checks, CRM edit conflicts, UTF-8 parsing, secure browser retry identities, consent cleanup, private URLs and production-host gating. Email tests now inspect the actual enquiry notification helper; a mocked delivery test checks the constructed multipart customer email.

Public tests:

```powershell
npx vitest run tests/api/contactReliability.test.js tests/api/emailBrand.test.js tests/api/emailDeliverability.test.js tests/api/privatePageGuard.test.js src/lib/analytics.test.ts src/lib/submissionIdentity.test.ts src/lib/attribution.test.ts src/lib/attribution.integration.test.tsx src/components/ContactLinkTracking.test.tsx
npx tsc --noEmit -p tsconfig.app.json
```

From `admin`:

```powershell
npx vitest run tests/enquiryNotifications.test.js tests/enquiries.test.js src/pages/EnquiriesPage.test.tsx
npx tsc --noEmit -p tsconfig.app.json
```

## Reproducible local SQL verification

`admin/tests/requestReliabilityDatabase.integration.mjs` creates a fresh in-memory PostgreSQL instance with only synthetic records. It applies the migration twice, checks booking and enquiry uniqueness, fresh-row claiming, concurrent claim exclusion, stale-token fencing, channel validation, persisted partial outcomes, RLS and service-only RPC permissions. It does not accept a database connection URL.

The validated dependency was `@electric-sql/pglite@0.5.8`, installed in a separate temporary tools folder. With that package installed, either import it through normal Node resolution or set `PGLITE_MODULE` to its local `dist/index.js` file URL. The command used on this workstation, from the website root, was:

```powershell
$env:PGLITE_MODULE='file:///C:/Users/navid/.codex/tmp/vve-media-db-validation/node_modules/@electric-sql/pglite/dist/index.js'
node admin/tests/requestReliabilityDatabase.integration.mjs
```

All SQL assertions passed. The runner itself and complete fixture setup are versioned in this repository; only the PGlite dependency location is workstation-specific.

## Integration and operational limits

- Apply `20260908120000_request_reliability.sql` only to an approved isolated database first, alongside the booking prerequisites. Deploy the matching website and CRM code together. The claim RPC now returns JSON rather than a boolean.
- The contact API and manual CRM retry retain the existing Sheets, Telegram and email pipeline. Provider readiness still depends on configured credentials. Slow providers can exceed the public client's 45-second timeout or CRM client's 20-second timeout; refresh the saved enquiry and check the destinations before retrying. The database lease is two minutes, and outcome checkpoints survive an interrupted final response.
- The root integration owner handles the private-page layout/pricebook bypass and the separate legacy `public/confirmation.html` Google tag guard. The host guard here covers `index.html` and `src/lib/analytics.ts`.
- This is a focused reliability phase. Full application builds, complete test-suite results and deployment readiness are tracked separately.

## Files owned in this phase

```text
api/contact.js
admin/api/_lib/enquiries.js
admin/api/_lib/enquiryNotifications.js
admin/api/_lib/enquiryPlainText.js
admin/src/pages/EnquiriesPage.tsx
admin/src/pages/EnquiriesPage.test.tsx
admin/tests/enquiries.test.js
admin/tests/enquiryNotifications.test.js
admin/tests/requestReliabilityDatabase.integration.mjs
supabase/migrations/20260908120000_request_reliability.sql
src/lib/analytics.ts
src/lib/analytics.test.ts
src/lib/attribution.ts
src/lib/attribution.test.ts
src/lib/submissionIdentity.ts
src/lib/submissionIdentity.test.ts
src/lib/privatePage.ts
src/components/ContactLinkTracking.test.tsx
index.html (early tag and private-page guards only)
tests/api/contactReliability.test.js
tests/api/privatePageGuard.test.js
tests/api/emailBrand.test.js
tests/api/emailDeliverability.test.js
docs/website-completion-2026-09-08/request-reliability-validation.md
```

`src/lib/attribution.integration.test.tsx` was validated without further edits in this phase. `api/create-booking-request.js`, app registrations, shared admin body/auth helpers and deployment configuration remained with their integration owners. No index or Git history mutation was performed by this reviewer.
