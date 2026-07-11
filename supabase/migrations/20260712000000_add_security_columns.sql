-- Security hardening migration.
-- Idempotent: safe to run against a database that was partially set up.

-- ── 1. Confirmation token ──────────────────────────────────────────────────────
-- Cryptographically random 64-char hex token generated server-side when the
-- checkout session is created. Required for public confirmation page lookup.
-- Prevents enumeration of bookings by guessing POSTCODE+DDMMYY references.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_token text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_confirmation_token_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_confirmation_token_key UNIQUE (confirmation_token);
  END IF;
END $$;

-- Index for fast lookup by token on the confirmation page
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bookings' AND indexname = 'idx_bookings_confirmation_token'
  ) THEN
    CREATE INDEX idx_bookings_confirmation_token ON bookings (confirmation_token);
  END IF;
END $$;

-- ── 2. Processed Stripe events (idempotency) ──────────────────────────────────
-- Stores the Stripe event ID after successful processing. The webhook handler
-- checks this table before doing any work — if the event ID is already present,
-- the event was already processed (duplicate delivery) and the handler returns
-- 200 immediately without re-sending emails or Telegram messages.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id    text        PRIMARY KEY,
  event_type  text        NOT NULL,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_stripe_events' AND policyname = 'no_public_access_stripe_events'
  ) THEN
    EXECUTE 'CREATE POLICY "no_public_access_stripe_events"
      ON processed_stripe_events FOR ALL TO anon USING (false)';
  END IF;
END $$;

-- ── 3. Notification status columns ────────────────────────────────────────────
-- Track which notifications were sent for each booking. Allows retrying failed
-- notifications and investigating delivery issues without re-reading logs.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_customer_sent  boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_business_sent  boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_sent        boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sheets_sent          boolean DEFAULT false;
