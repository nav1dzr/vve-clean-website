# CRM recovery and document validation — 18 October 2026

This phase repairs interrupted saves, manual booking entry, status displays, customer matching and long receipt text. It does not change Stripe, the £30 deposit, published service prices, production records, provider secrets or DNS. No production deployment was performed during these tests.

## Recovery changes

- Standalone receipts retain an account-bound operation UUID and original input in session storage before sending. Refresh or an uncertain response retries that same operation. The existing receipt primary key prevents duplicate creation; changed payloads or another creator cannot reuse it.
- Recovery expires after 24 hours and removes customer details, retaining only a review marker. An exact authenticated UUID lookup can find the original receipt and safely clear recovery. A not-found result permits an explicit reviewed reset. Server errors, mismatched creators and late replies after switching accounts cannot silently clear recovery.
- Operational receipt allocation/insert failures return HTTP503 rather than input-validation400. A database insert may have committed before its response failed; the retryable response preserves the UUID for reconciliation. Regressions commit a row before returning an error and verify one record after retry.
- Manual booking creation uses the same existing-primary-key approach and account-bound recovery. It preserves the chosen payment plan and agreed arrival window. Phone-only customers can use the existing pay-after-clean flow; missing/failed customer delivery remains visible rather than claiming an email was sent.
- Managed booking screens display their actual agreement/payment state and remove incompatible legacy controls. No-deposit bookings do not show a false pending-deposit label. The underlying payment rules remain unchanged.
- Catalogue list requests ignore late replies from older filters/searches, preserve the current filter after mutations, and show saved/archive feedback.

Key source files: `admin/src/lib/pendingStandaloneReceipt.ts`, `admin/src/pages/ReceiptEditorPage.tsx`, `admin/api/_lib/receiptLifecycle.js`, `admin/src/lib/pendingManualBooking.ts`, `admin/src/components/ManualBookingModal.tsx`, `admin/api/_lib/customerLifecycle.js`, `admin/src/lib/invoiceDraftRecovery.ts`, `admin/src/pages/BookingDetailPage.tsx`, `admin/src/components/BookingJourneyPanel.tsx`, `admin/api/_lib/bookingFields.js`, `admin/api/bookings/[id].js`, `admin/api/dashboard-summary.js`, and `admin/src/pages/CatalogueListPage.tsx`.

## Document layout

The actual local receipt API reproduced overlapping text with a 494-character service description. The shared invoice/receipt details renderer now measures wrapped rows and uses page-aware flow for oversized content. Payment totals, balance calculations and issued historical documents are unchanged.

Before evidence: synthetic `REC-2026-000008`. After evidence: synthetic `REC-2026-000009`, UUID `0e0b3074-fd11-4864-9796-90146d4dfd9f`, amount £987.65, creation HTTP201 and PDF download HTTP200. The rendered after page was visually inspected: logo/header, address, service list, payment date/method/reference, amount £987.65, final balance £0.00 and footer are readable without overlap. Source: `admin/api/_lib/invoicePdf.js`; regressions: `admin/tests/api/_lib/invoicePdf.test.js`.

## Integration environment and limits

Tests use actual repository handlers and Supabase clients against native PostgreSQL 18.6/PostgREST 16.4, with 37 real migrations, on loopback-only ports. The CRM and public gallery share that synthetic database. Existing local data was preserved through restarts.

Authentication is a labelled local fixture adapter. Private PDF storage and image/R2 endpoints are local protocol adapters with actual file persistence. These tests prove local API/database behavior, not cloud Supabase sign-in, Cloudflare permissions/CORS, Mux processing or production readiness. Email/Telegram/Calendar delivery and Stripe/Ads providers are disabled. No real message or payment was sent. Neither production Supabase nor VVE OS was modified.

Concrete local evidence includes:

- Browser lost-response/refresh receipt retry: one `REC-2026-000007`, one created event and one generated PDF; same UUID after reload.
- Concurrent same-UUID standalone receipt and manual booking requests return one record.
- Phone-only manual booking: 7 checks pass; confirmed pay-after-clean agreement, zero deposit/checkout, explicitly failed/deferred delivery because providers are disabled.
- Booking status, deposit recording/correction and amendment lifecycle: 18 checks pass with synthetic data only.
- Customer/booking/invoice identity checks: 20 checks pass, including literal underscore/percent addresses that must not match unrelated records.
- Generated invoice/receipt PDFs were visually inspected. Native date input automation did not reliably drive the browser control; date persistence is covered by component and real API tests, not claimed as a completed browser date-picker test.

Artifacts are outside the repository in the local `crm-gallery-audit-2026-10-15` visualization folder: `local-stack/README.md`, `receipt-refresh-browser-db.json`, `receipt-refresh-recovery.md`, `standalone-receipt-pdf-after-evidence.json`, `standalone-receipt-long-fields-after-1.png`, `receipt-pdf-layout-review.md`, `manual-phone-only-runtime.json`, `booking-status-payment-runtime.json`, and connection/coverage reports.

## Final validation

The full CRM suite result is recorded in `admin-phase2-suite-results.json`; TypeScript, lint and build logs are alongside it. Final counts are appended after the last run. The earlier website baseline passed 2454 tests with 299 pending and zero failures; those pending tests are not counted as passed. No website source changed in this recovery phase.

Known non-blocking warnings: the existing `InvoiceItemsForm.tsx:67` Fast Refresh export warning and the existing Vite chunk-size warning. Provider acceptance and a production deployment remain separate work, not implied by local passing tests.
