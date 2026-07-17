-- Seeds the invoice/receipt numbering sequence so the first real document
-- issued in 2026 starts at INV-2026-013245 / REC-2026-013245 instead of
-- ...-000001 — a business decision, not a technical requirement (see
-- admin/INVOICE_NUMBERING_POLICY.md for the numbering scheme itself, which
-- this does not change).
--
-- Additive only, and safe to re-run. next_document_number() (see
-- 20260722000000_create_invoice_receipt_tables.sql) does
-- `last_number = last_number + 1` on top of whatever is stored here, so
-- seeding last_number = 13244 makes the *next* allocation for that
-- doc_type/year return 13245.
--
-- GREATEST(...) is what makes this idempotent and non-destructive:
--   - No invoice/receipt issued yet for 2026 → row doesn't exist yet →
--     INSERT sets last_number = 13244 → next number is 13245.
--   - One or more already issued for 2026 with last_number < 13244 →
--     bumped up to 13244 → next number is 13245.
--   - Already issued past 13245 (last_number >= 13244) → GREATEST keeps
--     the existing, higher value untouched → this migration is a no-op for
--     that doc_type. Existing issued invoice/receipt numbers are never
--     renumbered — this only affects the *next* number allocated.
INSERT INTO document_number_counters (doc_type, year, last_number)
VALUES ('invoice', 2026, 13244), ('receipt', 2026, 13244)
ON CONFLICT (doc_type, year)
DO UPDATE SET last_number = GREATEST(document_number_counters.last_number, 13244);

-- Manual verification (run after applying, see admin/INVOICES_SETUP.md):
--   SELECT doc_type, year, last_number FROM document_number_counters WHERE year = 2026;
--   -- expect last_number >= 13244 for both 'invoice' and 'receipt'
