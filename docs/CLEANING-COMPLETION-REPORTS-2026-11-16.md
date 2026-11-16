# Cleaning completion reports — audit and implementation

## Isolation and baseline

This work starts from live main `2765c15` in `codex/cleaning-completion-reports-20261116`, in its own working directory. Claude's active work is in `.claude/worktrees/crm-phase2-20261116` on `claude/crm-safety-and-scheduled-send-20261116`. Do not cherry-pick that branch, rewrite it, or deploy this feature implicitly with it.

Claude owns the current scheduled-invoice changes to the mailer, invoice routes, dashboard, invoice UI and deployment configuration. This feature consumes existing exports without changing financial documents, send behaviour or their database tables. Integration into BookingDetailPage is limited to an import and an additional guarded section. App, navigation and customer-history additions must be reviewed on integration with other pending branches. Both branches require tests after any eventual merge.

## Existing system audit

- `admin/src/components/CleaningRecordBuilder.tsx` and `admin/api/_lib/invoicePdf.js` provide invoice-attached completion text, not a standalone report lifecycle. Preserve them and historical documents.
- `admin/src/pages/BookingDetailPage.tsx` and `CustomerDetailPage.tsx` provide the natural entry and history points. A new report can link to either or be entered manually.
- `admin/api/_lib/adminAuth.js`, `supabaseAdmin.js` and `previewIsolation.js` provide existing staff allow-list checks, server-only database access and preview isolation. Reuse all three. Existing staff privileges are shared admin privileges; this feature does not introduce a new permission system.
- `admin/api/_lib/mailer.js` and `customerEmailTemplate.js` provide branded HTML/plain-text email with preview isolation and contact@vveclean.co.uk reply-to. Reuse these without edits; never send as a side effect of saving or finalising.
- Existing PDFKit, bundled fonts and business settings can render standalone reports without dependencies. Private notes must never enter customer PDFs or email text.
- Public media publishing is inappropriate for customer property evidence. Use existing Supabase storage capability with a separate private report bucket, not public gallery collections or publicly accessible R2 objects.
- `admin/vercel.json` supplies API routing and restrictive browser policy. No scheduled jobs are needed. PDF preview/download should use authenticated blobs rather than public document URLs.

## Stages

1. Define seven editable service templates and a private report model. Suggested tasks start unchecked; retain internal notes separately. Bind linked records to existing booking/customer IDs and record staff actions.
2. Implement version-checked drafts, image validation/storage, authenticated preview, immutable final PDF, duplication to a new draft and explicit send attempts. Record uncertain mail outcomes without automatic retries.
3. Integrate the editor and history into CRM navigation/bookings/customers. Group optional fields and photo controls for phone use; show draft/final/delivery states honestly.
4. Run API/UI tests, full CRM validation, real local SQL checks and visual PDF/mobile checks. No live customer data or external messages in tests.

## Release preparation evidence

Feature is disabled by default. `COMPLETION_REPORTS_ENABLED=true` is the server flag; `VITE_COMPLETION_REPORTS_ENABLED=true` exposes navigation and entry points at build time. Enable only after the migration and isolated storage/email verification pass. Navid has explicitly approved this production release and its database exception. The approved migration and both CRM Production flags are now in place; normal checked merge/release and live verification remain pending as of this record.

Navid has explicitly approved the additive completion-report migration and private storage bucket as a production database exception for this release. No existing booking, invoice, receipt, payment or public media records are rewritten. No production secrets, Stripe, prices, DNS or Ads changes are part of this task.

## Acceptance criteria

- No booked task is automatically marked completed; duplicates clear completed flags.
- Only authenticated allow-listed staff can read/write reports or access evidence.
- Uploaded originals remain unchanged. Smaller derivatives are only for display/PDF; no enhancement or invented results.
- Finalisation checks the saved revision and produces an immutable snapshot. Corrections use a new draft/report, preserving the old final.
- Explicit reviewed recipient and send approval required every time. Repeated requests cannot send twice. SMTP acceptance is not customer delivery or acknowledgement.
- One-page no-photo and multi-page photo reports fit safely; internal notes never appear in them.
- Report creation, finalisation, send attempts and staff-recorded acknowledgement are auditable.
- Existing invoice, payment and receipt tests remain passing.

## Verification and known limitations

Implemented and pushed for review in **PR #71**, not released to production. All required PR checks passed at head `8c0bd73`. Full CRM suite: **1,389 tests passed in 101 files** on the live-main-based isolated branch. This count differs from the older 1,427-test review branch because unrelated unreleased CRM changes are intentionally excluded. TypeScript and production build passed. ESLint has zero errors and the existing InvoiceItemsForm Fast Refresh warning. The existing bundle-size warning remains.

**12 real PostgreSQL checks passed** using `scripts/validate-completion-reports-db.mjs` against a disposable localhost cluster. These exercise function/table grants, access denial, RLS, concurrent creation/editing/sending, immutable final records, transaction rollback, explicit uncertain-delivery recovery and restrictive storage policies even in the presence of broad existing client policies. These local checks were followed by the approved isolated Supabase verification and then the approved additive production migration described below. Existing customer and financial records were not rewritten.

Synthetic browser checks passed at desktop 1366px and mobile 390px: manual creation, unchecked template tasks, explicit completed selection, save, actual PDF preview, finalisation approval, send approval with one mocked send, and duplicate clearing completion ticks. Additional 390px browser checks passed with actual photo resizing into separate unchanged-original and compressed-display payloads, authenticated private thumbnail display, saved photo inclusion, and browser Back protection retaining the unsaved note after Keep editing. Long checklist text fields grow to fit their contents. External requests were blocked; synthetic email acceptance is not evidence of real SMTP delivery.

PDF samples were rendered to images and inspected: one-page text report and two-page photo report, with no clipping or overlap. The samples contain demonstration data only. These local samples are separate from the cloud-storage evidence below. Hosted test-email delivery has now also been verified as described below.

### Supabase compatibility and isolated cloud verification — 16 November 2026

- **Production: VVE Website (`temlphabsqukkiqmrvhl`)** — read-only compatibility checks passed, followed by successful application of the explicitly approved migration `20261116160000_cleaning_completion_reports.sql`.
- Applied migration file SHA-256: `9220df58061feb81aa4a90d97c7018741940de6f973a878edde40758d20d9ae1`.
- Six production read-only verification groups passed: all four report tables have RLS enabled; table grants are restricted; RPC execution is service-role-only; the report bucket is private with a 4 MB limit; the restrictive storage policy is present; and production contains zero completion-report test records.
- Only the two report flags were added to CRM Production: `COMPLETION_REPORTS_ENABLED=true` and `VITE_COMPLETION_REPORTS_ENABLED=true`. Existing environment settings were verified unchanged. These prepared flags do not establish that the unreleased UI/API is live.
- **Test environment: VVE OS (`spbrstpxrimuuorkbsbo`)** — the approved prerequisites and completion-report migration were applied for isolated verification.
- **Test ID:** `VVE-TEST-REPORTS-20261116-01`; **test report:** `832d55ef-bfc3-4659-ab4d-2aaece058efb`. This is synthetic test evidence, not a customer job.
- Real cloud-storage checks passed: original image bytes were preserved unchanged; private PDF storage/access and final-PDF immutability were verified; unauthorised access was denied.
- **Hosted email verified at `8c0bd73`:** one SMTP-accepted send operation `5e40812a-73eb-4746-abb4-46ec7fd502b8`. Repeating that exact operation returned `duplicatePrevented` without sending another message.
- The contact test inbox contained exactly one matching message, Gmail ID `1a1e4c9d7aa0c974`, subject `[TEST] Your cleaning completion report`, with `Reply-To: contact@vveclean.co.uk`.
- The attached PDF was 16,308 bytes; SHA-256 `0b297a96cae391d7b5734c9d06afc36785d15485d477ff7c8c07019ee1f1f83c` matched the stored final PDF. This establishes inbox arrival and attachment integrity for this labelled test, not customer reading or acceptance.
- **Still pending as of this record:** normal merge/release after required checks and post-deployment live verification. The production migration and report flags are complete under Navid's existing approval; no further approval is being requested by this document.

### Files and integration boundaries

- Data/storage: `supabase/migrations/20261116160000_cleaning_completion_reports.sql` adds four report-only tables, indexes, one atomic RPC and one private bucket. A restrictive storage policy denies browser roles access to this bucket even if another existing policy is broad.
- Backend: `admin/api/_lib/completionReports.js`, `completionReportRoute.js`, `completionReportPdf.js`; dispatch added to `admin/api/customers/index.js`. The endpoint is `/api/customers?resource=completion-reports`, retaining the existing 12-function hosting limit. Ordinary customer actions are unchanged. The existing customer function gets a 60-second maximum duration.
- Templates: `admin/shared/completionReportTemplates.js` and its declaration file. Seven editable starting templates; all suggested/booked tasks are unchecked.
- UI: `CompletionReportsPage.tsx`, `CompletionReportsSection.tsx`, `CompletionReportNavigationGuard.tsx`, `completionReportPhoto.ts`, `types/completionReport.ts` and associated tests.
- Integration: `App.tsx`, `ProtectedShell.tsx`, `BookingDetailPage.tsx`, `CustomerDetailPage.tsx`. The data-router conversion matches the existing pre-Claude CRM review baseline (`7e305fd`) so the report's browser-Back guard works. No Claude-specific scheduled-email code was imported.
- Tests: new report lifecycle, route, PDF, UI and photo tests; local SQL validation script. Existing financial tests remain unchanged and pass.

Do not overwrite Claude's branch or replace its App/booking files wholesale. Integrate the guarded route, navigation entry and report-history section as small additions, then rerun the combined suite. The existing mailer, invoice/receipt code, Stripe, dashboard, public media publisher, Vercel JSON and dependency manifests were not changed.

### Release preparation status and remaining steps

1. Production is VVE Website (`temlphabsqukkiqmrvhl`). Compatibility review, the approved additive migration and six post-migration verification groups passed on 16 November. No production test report was created.
2. The approved isolated VVE OS environment (`spbrstpxrimuuorkbsbo`) now has the prerequisites and migration, and real private storage checks passed. Hosted test-email delivery, exact-operation deduplication and attachment integrity also passed. Hosted previews must also satisfy the existing preview-isolation configuration and test inbox safeguards.
3. Hosted verification used the isolated test-only Supabase/email configuration and report feature flags. Existing server-only Supabase credentials and Gmail sending functionality are reused; no new provider or paid dependency is introduced. Only the two report flags were added to CRM Production; existing configuration was verified unchanged.
4. Navid has approved the specific release and production database exception; migration and flags are complete. Complete the normal merge after required checks, monitor production deployment and verify the live feature. Rollback: disable both flags/redeploy, preserving the report tables, PDFs and evidence. Do not delete stored reports or revert financial data.

### Owner usage

1. Open a booking or customer and choose **Create completion report**, or use **Completion reports → Create report** for a manual job.
2. Check the imported details. For a booking-start or standalone report, explicitly choose the existing customer record if you want it in their customer history. The property address is kept separate from contact details.
3. Review the booked tasks or choose a service template. Edit the list and tick only the tasks actually completed. Add observations and unfinished/excluded work. Internal notes remain staff-only.
4. Add photographs. Choose Before, After or Area/observation. Give one before and one after the same comparison label to pair them; leave that label empty for standalone photographs. Reorder and caption as needed. Originals can be downloaded privately.
5. Save the draft and preview the PDF. Finalise only after approving the work/date/photos. Finalisation does not mark a booking completed, record payment or send email.
6. **Review and send email** shows the recipient, text and attachment before a separate explicit approval. Provider acceptance does not mean delivery or reading. For uncertain results, inspect Sent mail/provider records and record the investigation; never blindly resend.
7. A final report is fixed. Duplicate it for a new draft/correction; the original stays accessible. Duplication clears task completion, summary, observations, exclusions, photos and actual service date so old work is not silently asserted again.
8. Record customer acknowledgement only when they explicitly confirm receiving the report. This does not imply approval of the cleaning or agency acceptance.

### Current limits

- JPEG/PNG originals up to 2 MB each, preserved unchanged; no HEIC/video uploads in this report feature. The PDF copy is resized to at most 1600px and 300 KB. Up to 12 selected photographs and a 4 MB final PDF keep preview/email payloads bounded. Larger evidence sets require multiple reports or a later signed-upload expansion.
- Drafts save explicitly to the server. Unsaved edits have navigation/reload protection; there is no automatic cross-device or crash recovery for unsaved text.
- Existing authorised CRM staff share access under the current allow-list. Granular report roles/invitations are outside this feature.
- Acknowledgement and ambiguous-delivery investigation are manually recorded; no email-open tracking, electronic signature or automatic delivery receipt is claimed.
- Failed storage/database steps may leave private unreferenced objects; no automatic deletion is introduced, preserving evidence. A future retention/cleanup process must distinguish those from final report files.
- Real cloud storage was verified in VVE OS and production schema compatibility passed read-only checks. Hosted test-email delivery and attachment integrity passed. The approved production migration and flags are complete. Merge/release and post-release verification remain pending under the existing approval.

## Saved stages and release status

- `f280186`: private report backend, templates, PDF, migration and database/API tests.
- `5e1b01c`: reviewed CRM editor, history links, photo tools, navigation protection and UI tests.
- `8c0bd73`: enforced report write permissions and customer-address defaults.
- PR #71 is pushed, with every required check passing at `8c0bd73`. It has not been merged or released to production.
- Approved test-only prerequisites and the completion-report migration were applied in VVE OS. The approved report-only migration and two report flags are also prepared in Production, with existing customer records and unrelated configuration preserved.
- Hosted test-email evidence and production release preparation are complete. Remaining sequence under Navid's existing approval: normal checked merge/release, then live verification. Do not describe the feature as live until that verification is recorded.
- Local synthetic preview: http://127.0.0.1:8955/completion-reports (sample data only, no real email sending).
- Sample PDF artifacts are under `admin/output/pdf/` and intentionally not committed as application assets.
