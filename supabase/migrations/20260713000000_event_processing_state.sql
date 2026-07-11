-- Upgrade processed_stripe_events from a simple deduplication log to a
-- durable state machine. Existing rows (if any) are retroactively marked
-- 'completed' because they were inserted only after successful processing
-- under the old scheme.
--
-- State transitions:
--   new       → processing  : webhook handler atomically claims the event (INSERT)
--   processing → completed  : UPDATE after booking persisted + notifications sent
--   processing → failed     : UPDATE when DB persistence fails; Stripe retry re-claims
--   failed     → processing : Stripe retry atomically re-claims (UPDATE WHERE status='failed')
--
-- A duplicate delivery whose stored status is 'completed' returns 200 immediately.
-- A delivery whose stored status is 'processing' and claimed_at < 10 min ago also
-- returns 200 (another Lambda is handling it). A stale 'processing' row (> 10 min)
-- can be re-claimed, covering crashed Lambda recovery.

-- ── 1. Add state columns (idempotent) ─────────────────────────────────────────

ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS claimed_at  timestamptz;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE processed_stripe_events ADD COLUMN IF NOT EXISTS error_detail text;

-- Back-fill pre-migration rows as 'completed' (they were successfully processed)
UPDATE processed_stripe_events
   SET status = 'completed', claimed_at = COALESCE(processed_at, now())
 WHERE status IS NULL;

-- Now make status NOT NULL with default 'processing' for new inserts
-- (code always writes the status explicitly; default is a safety net)
ALTER TABLE processed_stripe_events ALTER COLUMN status     SET NOT NULL;
ALTER TABLE processed_stripe_events ALTER COLUMN status     SET DEFAULT 'processing';
ALTER TABLE processed_stripe_events ALTER COLUMN claimed_at SET NOT NULL;
ALTER TABLE processed_stripe_events ALTER COLUMN claimed_at SET DEFAULT now();

-- ── 2. Add CHECK constraint (idempotent) ──────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'processed_stripe_events_status_check'
       AND conrelid = 'processed_stripe_events'::regclass
  ) THEN
    ALTER TABLE processed_stripe_events
      ADD CONSTRAINT processed_stripe_events_status_check
        CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

-- ── 3. Index for fast stale-processing recovery queries ───────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'processed_stripe_events'
       AND indexname  = 'idx_stripe_events_status_claimed'
  ) THEN
    CREATE INDEX idx_stripe_events_status_claimed
      ON processed_stripe_events (status, claimed_at);
  END IF;
END $$;
