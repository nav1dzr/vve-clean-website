-- Phase 2 CRM fields — additive and backwards-compatible only.
--
-- Every column here is nullable (or defaulted for existing rows) and none of
-- them are written by the public site's checkout/webhook code, which is not
-- modified by this migration. Existing rows will have NULL in every new
-- column except `status` (defaulted to 'new') — the admin UI must handle
-- that honestly (ADMIN_CRM_PLAN.md §12), not guess or fabricate values.

-- ── Operational booking status — separate from payment_status ────────────────
-- See ADMIN_CRM_PLAN.md §21. Deliberately excludes deposit_paid/refunded/
-- payment_issue, which describe payment/balance state, not job state.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status text;

UPDATE bookings SET status = 'new' WHERE status IS NULL;

ALTER TABLE bookings ALTER COLUMN status SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'new';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_status_check' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_status_check
        CHECK (status IN (
          'new', 'confirmed', 'scheduled', 'in_progress',
          'completed', 'rescheduled', 'cancelled', 'no_show'
        ));
  END IF;
END $$;

-- ── Approved future data fields (ADMIN_CRM_PLAN.md §24) ──────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_config jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_date date;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_status text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_payment_method text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_balance_status_check' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_balance_status_check
        CHECK (balance_status IS NULL OR balance_status IN (
          'not_due', 'outstanding', 'paid', 'waived'
        ));
  END IF;
END $$;

-- Index for the booking-list "service date" sort/filter (§18). Partial index
-- (WHERE service_date IS NOT NULL) since most historical rows will be NULL
-- until backfilled or set going forward — keeps the index small and useful.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_service_date'
  ) THEN
    CREATE INDEX idx_bookings_service_date ON bookings (service_date) WHERE service_date IS NOT NULL;
  END IF;
END $$;

-- Index for the booking-list "highest value" sort (§18), same partial-index
-- rationale as above.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_total_price'
  ) THEN
    CREATE INDEX idx_bookings_total_price ON bookings (total_price) WHERE total_price IS NOT NULL;
  END IF;
END $$;

-- Index for status/date filtering on the booking list and dashboard summary.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'bookings' AND indexname = 'idx_bookings_status_created_at'
  ) THEN
    CREATE INDEX idx_bookings_status_created_at ON bookings (status, created_at DESC);
  END IF;
END $$;
