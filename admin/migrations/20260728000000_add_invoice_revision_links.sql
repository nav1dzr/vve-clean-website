-- Migration: add invoice revision tracking columns
--
-- Purpose: enables the safe "Revise issued invoice" workflow — a revised
-- draft is linked to the original via revised_from_invoice_id; the original
-- is marked superseded (via superseded_by_invoice_id / superseded_at) only
-- after the replacement is successfully issued. Snapshots the original
-- invoice number and issue date at revision-creation time so the replacement
-- PDF and UI can display them without an extra lookup.
--
-- Safety guarantees:
--   - All five columns are nullable — no existing row is affected.
--   - ON DELETE SET NULL on both FKs: deleting an invoice (unsupported in
--     production — rows are never deleted — but safe defensively) never
--     cascades into orphaned IDs.
--   - Partial indexes (WHERE NOT NULL) keep the index footprint minimal.
--   - No circular-link constraint is added in SQL; circular links
--     (invoice A revised from A) are prevented in application code
--     (reviseIssuedInvoice validates the source is 'issued', not 'draft').
--
-- Do NOT apply this migration automatically — follow the existing manual
-- process documented in admin/INVOICES_SETUP.md and admin/PHASE4_MIGRATIONS.md.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS revised_from_invoice_id   UUID        REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revised_from_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS revised_from_issue_date   DATE,
  ADD COLUMN IF NOT EXISTS superseded_by_invoice_id  UUID        REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at             TIMESTAMPTZ;

-- Partial indexes: only rows that actually use these columns are indexed.
CREATE INDEX IF NOT EXISTS idx_invoices_revised_from
  ON invoices(revised_from_invoice_id)
  WHERE revised_from_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_superseded_by
  ON invoices(superseded_by_invoice_id)
  WHERE superseded_by_invoice_id IS NOT NULL;

-- Verification (run after applying, do NOT call next_document_number() to verify):
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'invoices'
--    AND column_name IN (
--      'revised_from_invoice_id','revised_from_invoice_number','revised_from_issue_date',
--      'superseded_by_invoice_id','superseded_at'
--    );
-- -- expect 5 rows
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'invoices'
--    AND indexname IN ('idx_invoices_revised_from','idx_invoices_superseded_by');
-- -- expect 2 rows
--
-- Rollback (if needed, before any revision data exists):
--
-- ALTER TABLE invoices
--   DROP COLUMN IF EXISTS revised_from_invoice_id,
--   DROP COLUMN IF EXISTS revised_from_invoice_number,
--   DROP COLUMN IF EXISTS revised_from_issue_date,
--   DROP COLUMN IF EXISTS superseded_by_invoice_id,
--   DROP COLUMN IF EXISTS superseded_at;
-- DROP INDEX IF EXISTS idx_invoices_revised_from;
-- DROP INDEX IF EXISTS idx_invoices_superseded_by;
