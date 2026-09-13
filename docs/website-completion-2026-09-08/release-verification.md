# Release verification — 8 September 2026

Source milestone: **`8ec7415b556ed5ff43dfef9d7ab414a4ef30075c`**, branch `feature/website-final-completion`, pushed after validation. The preceding media phase is `a0c1c31`. This is preview release evidence, not a production launch or a completed provider integration test.

## Local checks

| Check | Result |
|---|---|
| Website full suite | 1,899 passed, 0 failed, 122 conditional skips |
| CRM full suite | 816 passed, 0 failed, 0 skipped |
| TypeScript | Website and CRM passed |
| Production builds | Both passed; website generated 38 routes, including 21 indexable sitemap pages |
| Lint | Website: 0 errors, 7 warnings. CRM: 0 errors, 1 warning |
| Dependency packaging | 525 website files, 606 CRM files; no missing required/relative or cross-root imports. One caught optional Supabase telemetry import classified separately |
| Actual disposable PostgreSQL | Booking, media, request reliability and pricebook runners all passed; no remote database connection |
| Indexable navigation | All 21 sitemap routes have incoming HTML links and are reachable from home; zero orphans |
| Git whitespace | Passed before source commit |

Conditional skips are predominantly checks requiring verified Google rating data. They are not counted as passes or a reason to invent a rating. Focused test counts in the individual phase reports overlap these totals.

## Browser evidence

The local review server at `http://127.0.0.1:8769` serves the actual generated site, supplies the bundled pricebook for preview reads and rejects write/API operations. It does not load production credentials.

- Desktop home and representative 390px mobile service layouts inspected. The checked mobile document width did not exceed the viewport.
- Adding a rug required photo assessment. Removing it restored the normal carpet quote with its existing £85 minimum.
- Submitting an empty local booking form produced nine clear field errors without a database request.
- The leaflet example showed £165 before the authorised 20% discount, £132 total, £0 at initial request, £30 later deposit and £102 after that deposit.
- A private page opened without a token gave clear recovery contacts. Its metadata is `noindex, nofollow` and `no-referrer`; no Google scripts loaded.

These checks are representative. They do not replace the complete original route/device/keyboard matrix, a formal accessibility assessment, field performance data or conversion measurement.

## Deployed previews

Vercel metadata independently confirmed both deployments at the exact full source SHA above, branch `feature/website-final-completion`, Preview target, state **READY**, with no build error:

| Project | Deployment | URL |
|---|---|---|
| Website | `dpl_2tT9is3Vme6FYm9C4SwgYdnBvaMP` | [Website preview](https://vve-clean-website-9oguspdr6-nav1dzrs-projects.vercel.app) |
| CRM | `dpl_6NgJCY65Zt5VPHqeYebP2tUmB33Q` | [CRM preview](https://vve-clean-f2gyi6h6d-nav1dzrs-projects.vercel.app) |

The signed-in browser loaded the deployed website home with its new service/price/photograph layout. DOM checks found one main landmark, no broken loaded images and no Google tracking scripts. The deployed `/manage-booking` page displayed private-link recovery guidance and the expected noindex/no-referrer metadata, with no Google scripts. Vercel's preview toolbar can still appear; this is not a claim that the preview contains no third-party tooling.

Unauthenticated HTTP checks encountered Vercel Deployment Protection: GET redirects (302) and empty-JSON POST responses (401). Those are platform responses, not evidence of the application's intended 403. Browser navigation directly to the booking API was blocked by the client and did not load the endpoint. No bypass secret was created or recovered. Remote application-guard and CRM CSP response-header checks therefore remain unverified; their local tests passed.

## Cloud configuration readbacks

- All seven existing media variables now have exactly Preview target and branch `feature/website-final-completion`. Stored values were omitted from the updates and report output. A fresh metadata listing confirmed the final state.
- R2 CORS was saved and reopened. It retains the old origin, PUT, exposed ETag and 3,600-second cache, while adding the verified completion CRM origin and `If-None-Match`.
- The private originals bucket, Worker bindings and Mux environment exist. No real media transfer/transform/encode was performed.

See [cloud connections](cloud-connections.md) for exact changes, limits and rollback.

## Outstanding release prerequisites

The account cannot resume **VVE TEST** because both free active-project slots are occupied by systems in use. No paid plan was purchased and neither active project was paused. See [database mapping](database-connections.md).

Once separate test capacity is available, inspect the test project, configure branch-specific resources, apply migrations and verify the real request → CRM agreement → test deposit → webhook → confirmation/reschedule/cancel/balance journey. Exercise JPG/HEIC/MOV uploads and shared publication, pricebook publish/rebuild/rollback, and notification retries through deployed APIs. Use synthetic records and an explicitly selected test inbox.

The [Ads package](ads-release-package.md) passed nine offline checks but has not been sent to Google for validation or activation. Live production data, DNS, Stripe collection, customer messages and serving Ads settings were unchanged. [Implementation status](implementation-status.md) maps the work and remaining evidence to all audit findings F1–F15.
