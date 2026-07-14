-- Records the customer's acceptance of the booking/cancellation terms at the
-- time of paying the £30 deposit (fix/booking-request-and-terms).
--
-- Additive only — every column is nullable, and existing rows are left NULL
-- rather than backfilled with a fabricated acceptance. Not written by any
-- pricing, Stripe, or webhook-signature/idempotency logic; the checkout and
-- webhook handlers only gained new fields to persist alongside the booking
-- they already write.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS terms_accepted             boolean;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS terms_accepted_at          timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS terms_version              text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_policy_version text;
