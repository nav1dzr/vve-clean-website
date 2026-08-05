-- Migration: add review-request tracking columns
--
-- Purpose: gives the manual "Send review request" action in the Admin CRM a
-- durable record of whether a customer has already been asked for a Google
-- review, so the same customer cannot be emailed twice. Without persistence
-- the only duplicate protection would be the operator's memory, and a second
-- request to a customer who already left a review is exactly the kind of thing
-- that costs goodwill.
--
-- Safety guarantees:
--   - Both columns are nullable with no default, so no existing row changes
--     and no row is rewritten. On Postgres, ADD COLUMN of a nullable column
--     with no default is a metadata-only operation: no table rewrite, no lock
--     held for the size of the table.
--   - IF NOT EXISTS on both, so re-running is harmless.
--   - The partial index covers only rows that have actually been sent a
--     request, which today is none — so it costs effectively nothing.
--   - Nothing here touches bookings, payments, pricing, Stripe identifiers or
--     any existing column. It is purely additive.
--
-- Do NOT apply this migration automatically. Follow the existing manual
-- process documented in admin/PHASE4_MIGRATIONS.md. The feature that uses
-- these columns ships DISABLED (REVIEW_REQUESTS_ENABLED is unset), and the
-- application degrades cleanly if the columns are absent — see
-- admin/api/_lib/reviewRequest.js. Applying this migration on its own changes
-- no behaviour; the feature also has to be explicitly switched on.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS review_request_sent_to text;

COMMENT ON COLUMN bookings.review_request_sent_at IS
  'When a Google review request was emailed to this customer. NULL = never sent. Set only by the manual Admin CRM action.';

COMMENT ON COLUMN bookings.review_request_sent_to IS
  'The email address the review request was actually delivered to, snapshotted at send time so a later change to the customer record does not rewrite history.';

CREATE INDEX IF NOT EXISTS idx_bookings_review_request_sent_at
  ON bookings (review_request_sent_at)
  WHERE review_request_sent_at IS NOT NULL;
