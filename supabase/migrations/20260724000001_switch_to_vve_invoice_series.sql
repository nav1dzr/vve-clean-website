-- Replaces the wrong corrective migration.
--
-- What this migration does:
--   1. Adds a `prefix` column to document_number_counters (nullable first,
--      backfilled, then set NOT NULL).
--   2. Migrates the invoice counter to a global sentinel row keyed
--      (doc_type='invoice', year=0). year=0 means the counter never resets
--      between calendar years. The year portion of the formatted number comes
--      from now() inside next_document_number(), not from the row key.
--      Starting value = GREATEST of:
--        • highest last_number across any existing invoice counter row
--        • highest trailing numeric suffix in invoices.invoice_number (any format)
--        • 13244  (series baseline — next invoice will be VVE-INV-YYYY-013245)
--   3. Corrects the 2026 receipt counter only when it is in the exact known
--      bad seed state (last_number = 13244 and no receipt with suffix >= 13244
--      has been issued). Any other counter value is left unchanged.
--   4. Replaces next_document_number() with a version that:
--        • uses year=0 for invoices (globally monotone, cross-year sequence)
--        • uses year=current_year for receipts (per-year, resets each January)
--        • reads prefix from the counter row via RETURNING clause
--        • retains single-statement INSERT ON CONFLICT atomicity
--
-- Historical invoice_number values in the invoices table are never altered.
--
-- Do NOT verify this migration by calling next_document_number() directly in
-- production — those calls allocate real numbers. Inspect document_number_counters
-- directly instead. If function behaviour must be verified against live data,
-- wrap in BEGIN / ROLLBACK (confirmed the database supports transactional DDL).

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: add prefix column as nullable (backfill follows below)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE document_number_counters
  ADD COLUMN IF NOT EXISTS prefix text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: migrate invoice counter to global sentinel row (year = 0)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_counter_max int;
  v_issued_max  int;
  v_final_max   int;
BEGIN
  -- Highest last_number already stored for invoices across any year row.
  SELECT COALESCE(MAX(last_number), 0) INTO v_counter_max
  FROM document_number_counters
  WHERE doc_type = 'invoice';

  -- Highest trailing numeric suffix of any issued invoice number, regardless
  -- of format. Works for both INV-2026-000003 and VVE-INV-2026-013245.
  SELECT COALESCE(MAX(substring(invoice_number FROM '-(\d+)$')::int), 0)
  INTO v_issued_max
  FROM invoices
  WHERE invoice_number IS NOT NULL;

  -- Never go below 13244 — ensures the next invoice is always >= 013245.
  v_final_max := GREATEST(v_counter_max, v_issued_max, 13244);

  INSERT INTO document_number_counters (doc_type, year, last_number, prefix)
  VALUES ('invoice', 0, v_final_max, 'VVE-INV')
  ON CONFLICT (doc_type, year)
  DO UPDATE SET
    prefix      = 'VVE-INV',
    last_number = GREATEST(
                    document_number_counters.last_number,
                    EXCLUDED.last_number
                  );

  -- Remove old per-year invoice rows — superseded by the year=0 global row.
  DELETE FROM document_number_counters
  WHERE doc_type = 'invoice' AND year != 0;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: correct 2026 receipt counter (only the known bad seed state)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_actual_max int;
BEGIN
  -- Highest trailing numeric suffix of any issued 2026 receipt number.
  -- COALESCE to 0 if no receipts exist for 2026.
  SELECT COALESCE(MAX(substring(receipt_number FROM '-(\d+)$')::int), 0)
  INTO v_actual_max
  FROM receipts
  WHERE receipt_number IS NOT NULL
    AND receipt_number LIKE 'REC-2026-%';

  -- Correct only the exact known bad state introduced by migration 20260724000000:
  -- counter is at exactly 13244 and no receipt with suffix >= 13244 was issued.
  -- Any other counter value is left completely unchanged.
  UPDATE document_number_counters
  SET last_number = v_actual_max
  WHERE doc_type    = 'receipt'
    AND year        = 2026
    AND last_number = 13244
    AND v_actual_max < 13244;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: backfill prefix on all rows, then enforce NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE document_number_counters
  SET prefix = 'REC'
WHERE doc_type = 'receipt';

ALTER TABLE document_number_counters
  ALTER COLUMN prefix SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: replace next_document_number()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year           int;
  v_counter_year   int;
  v_default_start  int;
  v_default_prefix text;
  v_number         int;
  v_prefix         text;
BEGIN
  v_year := date_part('year', now())::int;

  CASE p_doc_type
    WHEN 'invoice' THEN
      v_default_prefix := 'VVE-INV';
      v_counter_year   := 0;      -- global row; counter never resets between years
      v_default_start  := 13245;  -- safety net only if the global row was deleted
    WHEN 'receipt' THEN
      v_default_prefix := 'REC';
      v_counter_year   := v_year; -- per-year row; resets each January
      v_default_start  := 1;
    ELSE
      RAISE EXCEPTION 'next_document_number: unknown doc_type %', p_doc_type;
  END CASE;

  -- Single atomic statement. Two concurrent callers cannot receive the same
  -- number: Postgres takes a row-level lock on the conflicting tuple before
  -- applying DO UPDATE, serialising the increment.
  INSERT INTO document_number_counters (doc_type, year, last_number, prefix)
  VALUES (p_doc_type, v_counter_year, v_default_start, v_default_prefix)
  ON CONFLICT (doc_type, year)
  DO UPDATE SET last_number = document_number_counters.last_number + 1
  RETURNING last_number, prefix INTO v_number, v_prefix;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-migration verification (read-only — inspect only, do not allocate)
-- ─────────────────────────────────────────────────────────────────────────────
--
--   SELECT doc_type, year, last_number, prefix
--   FROM document_number_counters
--   ORDER BY doc_type, year;
--
-- Expected (seed applied, three invoices issued, three receipts issued):
--   invoice | 0    | 13244 | VVE-INV
--   receipt | 2026 |     3 | REC
--
-- If function behaviour must be verified without consuming real numbers:
--   BEGIN;
--   SELECT next_document_number('invoice');   -- VVE-INV-2026-013245
--   SELECT next_document_number('invoice');   -- VVE-INV-2026-013246
--   SELECT next_document_number('receipt');   -- REC-2026-000004
--   ROLLBACK;
