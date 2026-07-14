-- Search support for the admin CRM dashboard (ADMIN_CRM_PLAN.md §16-17).
--
-- Adds pg_trgm for partial/fuzzy matching, indexes matching the exact
-- expressions the search function uses, and a single search_bookings()
-- function that centralises all matching/normalisation logic in one place.
--
-- Access control: EXECUTE is revoked from PUBLIC, anon, and authenticated,
-- and granted only to service_role. This function is only ever called from
-- admin/api/search.js using the service-role key — never from the browser.
-- SECURITY INVOKER (the default — not SECURITY DEFINER) is used
-- deliberately: the only role permitted to call this function already
-- bypasses RLS as itself, so there is no need to grant it owner privileges.
-- `search_path` is still pinned explicitly as a defensive best practice
-- regardless of security mode.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes matching the literal expressions used in search_bookings() below —
-- pg_trgm's operator classes support both plain and expression indexes for
-- ILIKE '%...%' matching.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_full_name_trgm'
  ) THEN
    CREATE INDEX idx_bookings_full_name_trgm ON bookings USING gin (full_name gin_trgm_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_address_trgm'
  ) THEN
    CREATE INDEX idx_bookings_address_trgm ON bookings USING gin (address gin_trgm_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_email_trgm'
  ) THEN
    CREATE INDEX idx_bookings_email_trgm ON bookings USING gin (email gin_trgm_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_booking_ref_trgm'
  ) THEN
    CREATE INDEX idx_bookings_booking_ref_trgm ON bookings USING gin (booking_ref gin_trgm_ops);
  END IF;
END $$;

-- Expression indexes matching the normalised phone/postcode comparisons
-- (ADMIN_CRM_PLAN.md §17) used inside search_bookings().

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_phone_normalized_trgm'
  ) THEN
    CREATE INDEX idx_bookings_phone_normalized_trgm
      ON bookings USING gin ((regexp_replace(phone, '[^0-9+]', '', 'g')) gin_trgm_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'idx_bookings_postcode_normalized_trgm'
  ) THEN
    CREATE INDEX idx_bookings_postcode_normalized_trgm
      ON bookings USING gin ((regexp_replace(upper(postcode), '\s', '', 'g')) gin_trgm_ops);
  END IF;
END $$;

-- ── search_bookings() ─────────────────────────────────────────────────────
--
-- Parameterised (no string concatenation into SQL text — search_query is a
-- bound function argument, not interpolated), fixed search_path, capped
-- result count, and returns only the fields the admin search-result card
-- needs — never confirmation_token, notes, Stripe identifiers, or
-- attribution fields.
--
-- Matches, per ADMIN_CRM_PLAN.md §16-17:
--   - partial, case-insensitive full_name / address / email
--   - partial / case-insensitive booking_ref
--   - exact UUID (only attempted when the input is actually UUID-shaped —
--     via a CASE expression, which Postgres guarantees short-circuits,
--     unlike relying on AND/OR evaluation order for a conditional cast)
--   - postcode with/without spaces, upper/lower case
--   - phone with/without spaces, and 07.../+44... treated as equivalent

CREATE OR REPLACE FUNCTION search_bookings(search_query text, result_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  booking_ref text,
  full_name text,
  phone text,
  email text,
  postcode text,
  service text,
  preferred_date text,
  service_date date,
  status text,
  payment_status text,
  total_price numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH normalized AS (
    SELECT
      lower(trim(search_query)) AS q_lower,
      regexp_replace(upper(trim(search_query)), '\s', '', 'g') AS q_postcode,
      regexp_replace(trim(search_query), '[^0-9+]', '', 'g') AS q_phone_raw,
      CASE
        WHEN trim(search_query) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN trim(search_query)::uuid
        ELSE NULL
      END AS q_uuid
  ),
  phone_variants AS (
    SELECT DISTINCT variant FROM (
      SELECT q_phone_raw AS variant FROM normalized WHERE length(q_phone_raw) >= 4
      UNION ALL
      SELECT regexp_replace(q_phone_raw, '^0', '+44') FROM normalized
       WHERE q_phone_raw LIKE '0%' AND length(q_phone_raw) >= 4
      UNION ALL
      SELECT regexp_replace(q_phone_raw, '^\+44', '0') FROM normalized
       WHERE q_phone_raw LIKE '+44%' AND length(q_phone_raw) >= 4
    ) v
    WHERE variant <> ''
  )
  SELECT
    b.id, b.booking_ref, b.full_name, b.phone, b.email, b.postcode, b.service,
    b.preferred_date, b.service_date, b.status, b.payment_status, b.total_price, b.created_at
  FROM bookings b, normalized n
  WHERE
    (n.q_uuid IS NOT NULL AND b.id = n.q_uuid)
    OR (n.q_lower <> '' AND b.full_name ILIKE '%' || n.q_lower || '%')
    OR (n.q_lower <> '' AND b.address ILIKE '%' || n.q_lower || '%')
    OR (n.q_lower <> '' AND b.email ILIKE '%' || n.q_lower || '%')
    OR (n.q_lower <> '' AND b.booking_ref ILIKE '%' || n.q_lower || '%')
    OR (n.q_postcode <> '' AND regexp_replace(upper(b.postcode), '\s', '', 'g') ILIKE '%' || n.q_postcode || '%')
    OR EXISTS (
         SELECT 1 FROM phone_variants pv
         WHERE regexp_replace(b.phone, '[^0-9+]', '', 'g') ILIKE '%' || pv.variant || '%'
       )
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 50), 1), 100)
$$;

REVOKE ALL ON FUNCTION search_bookings(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_bookings(text, integer) FROM anon;
REVOKE ALL ON FUNCTION search_bookings(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION search_bookings(text, integer) TO service_role;
