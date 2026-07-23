-- Reverts the accidental numbering seed introduced by
-- 20260724000000_seed_document_numbering_start.sql which bumps counters
-- to 13244 (making the next number INV-2026-013245).
--
-- This migration is safe to re-run:
--   - If the counter was bumped to 13244 by the previous migration, it is
--     reset to the actual count of issued documents in 2026.
--   - If the counter grew naturally and is still below 13244 (i.e. the
--     seed migration was never applied or was applied to an empty table
--     and invoices were then issued sequentially), the WHERE clause does
--     not match and nothing changes.
--
-- On a brand-new database both migrations run in order: the seed bumps the
-- counter to 13244, then this migration resets it to 0 (no issued docs yet),
-- so the first real invoice gets INV-2026-000001.

UPDATE document_number_counters
SET last_number = (
  SELECT COUNT(*)
  FROM invoices
  WHERE EXTRACT(YEAR FROM issue_date) = 2026
    AND document_status = 'issued'
)
WHERE doc_type = 'invoice'
  AND year = 2026
  AND last_number >= 13244;

UPDATE document_number_counters
SET last_number = (
  SELECT COUNT(*)
  FROM receipts
  WHERE payment_date IS NOT NULL
    AND EXTRACT(YEAR FROM payment_date) = 2026
)
WHERE doc_type = 'receipt'
  AND year = 2026
  AND last_number >= 13244;
