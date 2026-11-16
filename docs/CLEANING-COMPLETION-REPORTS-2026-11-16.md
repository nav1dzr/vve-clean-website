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

## Release gates

Feature is disabled by default. `COMPLETION_REPORTS_ENABLED=true` is the server flag; `VITE_COMPLETION_REPORTS_ENABLED=true` exposes navigation and entry points at build time. Do not enable either before the migration, isolated storage/email verification and specific release approval.

The additive completion-report migration and private storage bucket need an explicit production database exception. No existing booking, invoice, receipt, payment or public media records are rewritten. No production secrets, Stripe, prices, DNS or Ads changes are part of this task.

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

Implemented locally, not deployed. Full CRM suite: **1,387 tests passed in 101 files** on the live-main-based isolated branch. This count differs from the older 1,427-test review branch because unrelated unreleased CRM changes are intentionally excluded. TypeScript and production build passed. ESLint has zero errors and the existing InvoiceItemsForm Fast Refresh warning. The existing bundle-size warning remains.

**11 real PostgreSQL checks passed** using `scripts/validate-completion-reports-db.mjs` against a disposable localhost cluster. These exercise access denial, RLS, concurrent creation/editing/sending, immutable final records, transaction rollback, explicit uncertain-delivery recovery and restrictive storage policies even in the presence of broad existing client policies. No Supabase project was modified.

Synthetic browser checks passed at desktop 1366px and mobile 390px: manual creation, unchecked template tasks, explicit completed selection, save, actual PDF preview, finalisation approval, send approval with one mocked send, and duplicate clearing completion ticks. Additional 390px browser checks passed with actual photo resizing into separate unchanged-original and compressed-display payloads, authenticated private thumbnail display, saved photo inclusion, and browser Back protection retaining the unsaved note after Keep editing. Long checklist text fields grow to fit their contents. External requests were blocked; synthetic email acceptance is not evidence of real SMTP delivery.

PDF samples were rendered to images and inspected: one-page text report and two-page photo report, with no clipping or overlap. The samples contain demonstration data only. Production compatibility and cloud/provider verification remain separate from these local tests.

### Files and integration boundaries

- Data/storage: `supabase/migrations/20261116160000_cleaning_completion_reports.sql` adds four report-only tables, indexes, one atomic RPC and one private bucket. A restrictive storage policy denies browser roles access to this bucket even if another existing policy is broad.
- Backend: `admin/api/_lib/completionReports.js`, `completionReportRoute.js`, `completionReportPdf.js`; dispatch added to `admin/api/customers/index.js`. The endpoint is `/api/customers?resource=completion-reports`, retaining the existing 12-function hosting limit. Ordinary customer actions are unchanged. The existing customer function gets a 60-second maximum duration.
- Templates: `admin/shared/completionReportTemplates.js` and its declaration file. Seven editable starting templates; all suggested/booked tasks are unchecked.
- UI: `CompletionReportsPage.tsx`, `CompletionReportsSection.tsx`, `CompletionReportNavigationGuard.tsx`, `completionReportPhoto.ts`, `types/completionReport.ts` and associated tests.
- Integration: `App.tsx`, `ProtectedShell.tsx`, `BookingDetailPage.tsx`, `CustomerDetailPage.tsx`. The data-router conversion matches the existing pre-Claude CRM review baseline (`7e305fd`) so the report's browser-Back guard works. No Claude-specific scheduled-email code was imported.
- Tests: new report lifecycle, route, PDF, UI and photo tests; local SQL validation script. Existing financial tests remain unchanged and pass.

Do not overwrite Claude's branch or replace its App/booking files wholesale. Integrate the guarded route, navigation entry and report-history section as small additions, then rerun the combined suite. The existing mailer, invoice/receipt code, Stripe, dashboard, public media publisher, Vercel JSON and dependency manifests were not changed.

### Setup required before use

1. Confirm the intended CRM Supabase project and review the migration against its current schema. Required existing tables are `admin_users`, `bookings`, `customers`, `booking_journeys` and Supabase `storage` tables. Do not assume an old checkout's project reference identifies production.
2. Apply the new migration only to an approved isolated test environment first. Verify private uploads/downloads and real test-mail delivery there. Hosted previews must also satisfy the existing preview-isolation configuration and test inbox safeguards.
3. Configure both report feature flags in that environment. Existing server-only Supabase credentials and Gmail sending configuration are reused; no new provider or paid dependency is introduced.
4. Obtain specific release and production database approval before applying the migration, enabling flags or deploying live. Rollback: disable both flags/redeploy, preserving the report tables, PDFs and evidence. Do not delete stored reports or revert financial data.

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
- Real cloud storage/SMTP and production schema compatibility have not been tested. These remain release gates, not completed evidence.

## Saved local stages

- `f280186`: private report backend, templates, PDF, migration and database/API tests.
- `5e1b01c`: reviewed CRM editor, history links, photo tools, navigation protection and UI tests.
- No push, merge, database application or production deployment has been performed for this feature.
- Local synthetic preview: http://127.0.0.1:8955/completion-reports (sample data only, no real email sending).
- Sample PDF artifacts are under `admin/output/pdf/` and intentionally not committed as application assets.
