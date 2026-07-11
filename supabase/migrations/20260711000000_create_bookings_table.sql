-- Idempotent migration: creates the bookings table if it does not exist,
-- then adds every column the API expects. Safe to run against a database
-- where the table was created manually without tracked migrations.

CREATE TABLE IF NOT EXISTS bookings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Core booking columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id         text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status            text NOT NULL DEFAULT 'pending_payment';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount            numeric DEFAULT 30;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS full_name                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address                   text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS postcode                  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service                   text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_date            text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_time            text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes                     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at                timestamptz DEFAULT now();

-- Attribution / offer columns (written by the optional attribution update block)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_code                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_percent           numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS standard_total             numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount            numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_total_after_discount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS first_source               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_source                text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS landing_page               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_source                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_medium                 text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_campaign               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_content                text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gclid                      text;

-- UNIQUE constraints required for upsert onConflict behaviour in stripe-webhook.js
-- Each block adds the constraint only when it does not already exist.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_booking_ref_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_booking_ref_key UNIQUE (booking_ref);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_stripe_session_id_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_stripe_session_id_key UNIQUE (stripe_session_id);
  END IF;
END $$;

-- RLS — all API writes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- Authenticated admin users can read bookings; anonymous users cannot.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'authenticated_read_bookings'
  ) THEN
    EXECUTE 'CREATE POLICY "authenticated_read_bookings"
      ON bookings FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;
