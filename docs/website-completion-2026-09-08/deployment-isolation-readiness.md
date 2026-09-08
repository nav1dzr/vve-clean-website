# Deployment packaging and preview isolation — 8 September 2026

Local validation passed and both code previews reached READY. The separate [cloud configuration phase](cloud-connections.md) repaired seven media variable scopes and R2 CORS. Production records, uploads and real messages remain untouched. Preview write access stays disabled until the explicit configuration below is supplied.

## Packaging result

The website has 10 API entry files and the CRM has 12. The website count conservatively includes the existing `api/servicePrices.js` export shim. New helpers remain under `_lib`, and the CRM's media, enquiries and pricebook operations share its existing search function. The CRM is at the documented 12-function limit for direct API routes on Hobby. [Vercel runtime limits](https://vercel.com/docs/functions/runtimes)

`scripts/verify-function-packaging.mjs` ran actual `@vercel/nft@1.10.0` dependency tracing with the two deployment roots enforced separately. Website tracing excludes `admin/node_modules`, so it cannot accidentally depend on a locally installed CRM dependency. CRM tracing refuses files outside `admin`, so it cannot silently borrow the parent website's dependencies. Results:

| Project | Traced files | Missing required or relative dependencies | Cross-root dependencies |
| --- | ---: | ---: | ---: |
| Website | 525 | 0 | 0 |
| CRM | 606 | 0 | 0 |

The public bundle includes the imported CRM booking-journey and enquiry helpers because both are inside the website deployment root. CRM pricing uses its generated local catalogue. The current CRM journey calls Stripe through bounded REST requests; it does not need the Stripe SDK. An initially proposed SDK dependency was removed after tracing established that fact; `admin/package.json` and its lockfile have no change from this phase.

One optional CRM trace warning remains: Supabase dynamically imports `@opentelemetry/api` and explicitly catches its absence, returning no trace context. This optional warning is classified separately by the runner. There are no other trace warnings. The standalone CRM front-end build also passed; it retains the existing bundle-size advisory.

To reproduce from the website root, install `@vercel/nft@1.10.0` in a separate tools directory, or use the existing local CLI dependency:

```powershell
$env:NFT_MODULE='file:///C:/Users/navid/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/@vercel/nft/out/index.js'
node scripts/verify-function-packaging.mjs
```

The runner performs static local reads only. It does not load credentials, execute an API handler, or contact Vercel.

## Default preview behaviour

Vercel preview, development and other nonproduction deployments return **403 before database authentication, persistence, payment or notification work** unless the isolated test-resource checks pass. `NODE_ENV=production` does not bypass this protection: previews commonly have that value. An actual `VERCEL_ENV=production` deployment retains normal behaviour. Unhosted environments with no Vercel context retain their existing local/test behaviour.

The public guard covers initial booking requests, contact enquiries, booking management/workers, legacy checkout, Stripe webhooks, backfill and private confirmation/payment readers. The shared CRM auth boundary blocks all CRM data access in an unapproved preview, including legacy PDF preview routes that write audit events despite using GET. Public price and published-gallery reads remain available.

Both currently active Supabase projects are hard-denied as staging targets even when the approval marker is set:

- `temlphabsqukkiqmrvhl` — active website/CRM project.
- `spbrstpxrimuuorkbsbo` — VVE OS, with active private-schema activity; the presence of media in its public schema does not make it an isolated test project.

## Exact preview configuration

Set these only after an isolated test project and safe destinations have been reviewed. No setting below was added to Vercel by this phase.

| Variable | Required value or rule |
| --- | --- |
| `VVE_PREVIEW_ISOLATION_APPROVED` | Exact string `true`, after the test-resource review. |
| `VVE_PREVIEW_SUPABASE_PROJECT_REF` | The separate test project's 20-character lowercase project ref. Neither active ref above is accepted. |
| `VITE_SUPABASE_URL` | `https://<the-approved-test-ref>.supabase.co`. |
| `SUPABASE_URL` | Leave unset, or use exactly the same approved test project. A conflicting alternate URL fails closed. |
| `SUPABASE_SERVICE_ROLE_KEY` | The test project's service-role key, never a production key. The guard checks destination URLs; authentication subsequently checks the key. |
| `VVE_PREVIEW_TEST_EMAIL` | One valid, explicitly selected inbox for all preview emails. Missing, malformed or multiple-recipient values fail closed. |
| `STRIPE_SECRET_KEY` | A Stripe test key when testing payment; `sk_live_` and `rk_live_` keys are rejected. |
| `BOOKING_JOURNEY_MODE` | Use `test`; `live` is explicitly rejected in a preview. |

Normal journey prerequisites still apply: the staging migration, feature flag, separate token/worker secrets, mail credentials and `BOOKING_JOURNEY_SITE_URL` pointing to the test website. Preview email delivery uses `VVE_PREVIEW_TEST_EMAIL` even if an older `BOOKING_JOURNEY_TEST_EMAIL` or business/customer address was inherited.

Additional destination selection is required before media provider actions or pricebook build hooks become ready:

| Variable | Rule |
| --- | --- |
| `VVE_PREVIEW_R2_BUCKET_NAME` | Must exactly match the explicitly selected test `R2_BUCKET_NAME`. |
| `VVE_PREVIEW_MEDIA_ORIGIN` | For images, must exactly match the test worker's `CLOUDFLARE_MEDIA_ORIGIN`. |
| `VVE_PREVIEW_MUX_TOKEN_ID` | For videos, must exactly match the selected test Mux environment's `MUX_TOKEN_ID`. |
| `VVE_PREVIEW_PRICEBOOK_REFRESH_URL` | Must exactly match the test build hook in `WEBSITE_PRICEBOOK_REFRESH_URL`. |

These explicit comparisons prevent inherited destinations from silently becoming usable. They are an operator declaration after checking the resources; they cannot independently prove that a selected R2 bucket, Mux environment or build hook is isolated. Keep credentials and build-hook URLs out of reports and logs.

## Notification and payment limits in an approved preview

- Initial request and enquiry emails, booking-journey emails and the shared CRM invoice/receipt mailer route to the selected test inbox. They use a `[TEST]` subject prefix. Request/enquiry/journey reply-to addresses also use the test inbox.
- Enquiry Sheets and Telegram delivery, and initial-request Telegram delivery, stay disabled in previews. No separate chat-destination override was introduced.
- Legacy checkout, backfill and historical confirmation/payment-reader endpoints stay disabled even after preview approval.
- Stripe webhooks in previews accept only `livemode: false` events whose object has `metadata.journey: v1`. Production events and the legacy email path are rejected before database or notification work. A test webhook secret remains required.
- These guards do not turn an unhosted local server into an isolated environment. Do not start a local API process with production credentials for write testing.

## Execution limits and validation

The CRM `connect-src` policy now includes exactly `https://storage.googleapis.com`, alongside existing Supabase and R2 destinations. Mux direct upload URLs use this destination; without it, the browser blocks video transfers before progress advances. Other directives remain unchanged, and a two-case test checks the exact connection allow-list and retained restrictions. The source is included in the READY `8ec7415` CRM preview; remote response-header inspection is limited by Deployment Protection. [Mux CSP guidance](https://www.mux.com/docs/core/content-security-policy), [Mux Uploader](https://www.mux.com/docs/guides/mux-uploader)

Both Vercel configurations now explicitly allow 60 seconds for the email-bearing public request/contact/booking-management/webhook functions and the CRM search/booking functions. This is a ceiling, not a delivery-time promise. The public form still waits 45 seconds and the CRM client 20 seconds; slow destinations can require refreshing a saved record. Worker batches and delayed deliveries still need an isolated end-to-end run before scheduling. [Vercel function duration configuration](https://vercel.com/docs/functions/configuring-functions/duration)

Passed **81 focused public tests**, **61 focused CRM tests**, focused lint in each project, actual dependency tracing, and the standalone CRM build. Tests prove unapproved previews stop before database/client/input work, both active project refs remain blocked, approved preview mail never targets the normal customer/business addresses, inherited Sheets/Telegram/build hooks stay unused, media providers require explicit preview destinations, and unsafe webhook events remain blocked. All providers in these tests are mocked.

Main touched paths: mirrored `_lib/previewIsolation.js` helpers; public handler entry guards; shared CRM auth and mailers; media/pricebook readiness checks; both Vercel configurations; focused tests; and the packaging runner. These source changes are included in pushed commit `8ec7415`. Full-suite and browser results are recorded in [release verification](release-verification.md).
