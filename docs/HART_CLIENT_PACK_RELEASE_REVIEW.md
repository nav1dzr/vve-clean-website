# Private client report and media packs - release review

Prepared 17 November 2026. Originally based on `059478e14cec7ceb556864ee89a062e9d8be6ef1`; integrated with current `origin/main` at `358f041` on 17 November. The local feature branch remains `feature/website-final-completion`. No push, migration or deployment has been performed.

## 18 November release preparation

The owner requested deployment of this report page on 18 November. An isolated release checkout on `codex/hart-client-packs-release-20261118` now integrates main `30352a02ca0ede4bf8c8b5855192b8ab84be9a1a`, preserving the newly merged scheduled-invoice functionality. The integration had no conflicts. The earlier access and approval notes below describe the 17 November position; actual hosting, database and delivery outcomes must be recorded separately after verification.

Private review media is excluded from Git, and the admin build now fails before Vite can copy files whenever `public/__hart_review__` exists. A synthetic build regression verifies both rejection and a clean production build. The release checkout contains no private fixture. A production build with `VITE_CLIENT_PACKS_ENABLED=true` includes the manager and passes a scan for the Hart recipient, address, invoice reference and review fixture.

Only the existing admin CRM project requires deployment (root `admin`, build `npm run build`, output `dist`). The customer viewer and API belong to that project; no public marketing-site release or new domain is required. Before applying the additive migration, verify that the existing restrictive `cleaning_reports_block_client_access` storage policy is present as well as the private bucket.

Final integrated validation: all 132 admin test files / 1,747 tests pass; all 170 website test files / 2,752 tests pass, with 317 existing skipped tests. Both applications pass lint, TypeScript checks and production builds. Lint retains four admin and seven website Fast Refresh warnings, with no errors. The first guard run needed the Node test environment because Vite/esbuild cannot run inside jsdom; the corrected guard and full admin rerun both pass. These checks do not substitute for real storage, deployment and customer-link verification.

## Result

Customers can receive an image-free branded email with an attached bespoke PDF and one link to selected photographs, playable MP4 clips and the PDF download. The client viewer is outside CRM sign-in; it authorizes access with a 256-bit secret held in the URL fragment. Only the token hash is stored. Publishing and revocation are explicit authenticated administrator actions. No email sender is added or invoked.

The protected manager is `/client-packs`; the customer view is `/report-view`. Both APIs reuse `/api/customers?resource=client-packs` or `client-pack-view`, preserving the 12-function hosting cap. Existing customer API authentication remains unchanged for ordinary customer operations. The existing private completion-report bucket is reused. A new additive pack table references existing customer, booking and invoice IDs without updating those records.

## Validation

- Integrated full admin test suite: 124 files / 1,659 tests passed.
- Integrated full website test suite: 170 files / 2,750 tests passed, with 319 existing skipped tests.
- Website and admin lint, TypeScript checks and production builds passed. Lint reports no errors; Fast Refresh warnings remain (7 website, 4 admin).
- Existing invoice, receipt, booking and payment regression tests passed.
- Earlier local browser review before integration: desktop and 390px frame; no horizontal overflow; selected videos loaded and playback was observed. Live provider/browser checks remain required for release.
- Email preview button reached the review page; PDF download bytes matched the approved local report exactly.
- Four-page PDF rendered and inspected. Image-free email rendered at 640px and 390px.
- Integrated admin production output checked for absence of the private Hart media fixture, property address, invoice reference and recipient email. All 11 local review files were restored after the build. Actual customer data/media remains untracked and excluded from source.
- Independent source review checked token hashing, public response fields, revision conflicts and storage keys.
- Independent integration review found no material regression: current customer duplicate checks and CRM routes remain intact; CSP permits the existing website video source and private Supabase playback without broader wildcard permissions.

These are local and mocked API/database checks. The migration, real Supabase direct upload/signing, and a real inbox delivery test have not been run. Build emits the existing-style admin chunk-size warning; no build failure.

## Delivery and access status

The owner has requested delivery to Danielle at The Hart from `contact@vveclean.co.uk` by Wednesday 18 November. A conditional morning delivery check is scheduled: it may proceed only after a real published report/media link and the approved PDF have been verified; it must not deploy, migrate, or send a temporary preview link. It alerts the owner if delivery remains blocked. This is not an unconditional scheduled email.

The connected Vercel account exposes only public website project `prj_X78wbSWKlEGJon2obgBRCgMKSkDt` in team `team_QIgTuMMEB0fc4JEf1SmmkUbB`. Looking up `vve-clean-crm` in that team returned 404. The tracked media audit identifies `admin.vveclean.co.uk` and Supabase project `temlphabsqukkiqmrvhl` as the live CRM, but authorized access to its deployment and database is still unestablished. Release/migration/deployment approval remains pending.

## Release requires explicit approval

1. Obtain Navid's approval for this release before push, merge, migration or deployment. Preserve required checks and normal PR review.
2. Verify the connected admin Vercel project and isolated staging Supabase configuration. Do not retrieve or print production secrets.
3. Apply `20261117010000_cleaning_client_packs.sql` to approved isolated staging first; verify restrictive private storage policies remain intact. Test an uploaded PDF, image and MP4, expiry and revocation with synthetic records.
4. After successful checks and approved release, apply the reviewed additive migration to the existing CRM database and deploy the admin update. Enable `CLIENT_PACKS_ENABLED=true` server-side and `VITE_CLIENT_PACKS_ENABLED=true` at build time. Never include the local fixture in a production build.
5. Resolve The Hart's existing customer, booking and invoice IDs in authenticated CRM access. Do not invent IDs, create duplicate customers/bookings or modify issued invoice details. Create a draft pack, upload the reviewed four-page PDF, three selected original photos and four original MP4 clips, review captions, then explicitly publish its time-limited link.
6. Render `buildClientPackEmail` with the real published URL and attach the exact PDF through the existing mail infrastructure. Preview/test only with separately authorized recipients. Delivery to Dani from the contact account has been requested; it remains conditional on successful release and live-link/PDF verification, with no temporary preview URL sent.

## Access and rollback

Feature flags default off. Disable the flags to suspend access; revoke a pack to stop issuing new links. Signed file URLs can remain usable for up to five minutes after revocation; downloaded copies cannot be recalled. No destructive rollback is proposed; preserve private data and return to the prior admin deployment if necessary. No Stripe, deposit, invoice issuance, existing final-report PDF or payment logic is changed.

## Owner artifacts

The current owner delivery contains a four-page customer PDF, image-free email preview and refreshed ZIP. It supersedes the earlier six-page report and image-heavy email. It contains no sendable EML with a placeholder URL. The local page fixture is for review only and is not a published customer link.
