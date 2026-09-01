-- Separate website areas keep service-page proof and public Gallery media
-- independent. This migration is safe whether the original media migration
-- has just been applied or has been live already.

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS placement text;
UPDATE media_assets
SET placement = CASE category
  WHEN 'carpet' THEN 'gallery-carpet'
  WHEN 'sofa-upholstery' THEN 'gallery-sofa'
  ELSE 'gallery-end-of-tenancy'
END
WHERE placement IS NULL;
ALTER TABLE media_assets ALTER COLUMN placement SET DEFAULT 'gallery-end-of-tenancy';
ALTER TABLE media_assets ALTER COLUMN placement SET NOT NULL;

ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS placement text;
UPDATE media_slots SET placement = 'gallery-end-of-tenancy' WHERE placement IS NULL;
ALTER TABLE media_slots ALTER COLUMN placement SET NOT NULL;

ALTER TABLE media_slots DROP CONSTRAINT IF EXISTS media_slots_slot_key_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_placement_check') THEN
    ALTER TABLE media_assets ADD CONSTRAINT media_assets_placement_check CHECK (placement IN ('main-home', 'gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa', 'carpet-page', 'sofa-page', 'end-of-tenancy-page'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_slots_placement_check') THEN
    ALTER TABLE media_slots ADD CONSTRAINT media_slots_placement_check CHECK (placement IN ('main-home', 'gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa', 'carpet-page', 'sofa-page', 'end-of-tenancy-page'));
  END IF;
END $$;

INSERT INTO media_slots (slot_key, placement, label)
SELECT format('%s-%s', placement, lpad(n::text, 2, '0')), placement, label_prefix || ' position ' || n
FROM (
  SELECT 'main-home' AS placement, 'Main website' AS label_prefix, 6 AS total
  UNION ALL SELECT 'gallery-end-of-tenancy', 'Gallery · End of tenancy', 20
  UNION ALL SELECT 'gallery-carpet', 'Gallery · Carpet', 20
  UNION ALL SELECT 'gallery-sofa', 'Gallery · Sofa & upholstery', 20
  UNION ALL SELECT 'carpet-page', 'Carpet page', 10
  UNION ALL SELECT 'sofa-page', 'Sofa & upholstery page', 10
  UNION ALL SELECT 'end-of-tenancy-page', 'End of tenancy page', 10
) destinations
CROSS JOIN LATERAL generate_series(1, total) AS n
ON CONFLICT (slot_key) DO NOTHING;

DROP FUNCTION IF EXISTS public_media_slots();
CREATE FUNCTION public_media_slots()
RETURNS TABLE (
  slot_key text,
  placement text,
  media_type text,
  title text,
  alt_text text,
  service text,
  category text,
  before_after text,
  pair_key text,
  location_label text,
  cloudflare_image_id text,
  delivery_url text,
  mux_playback_id text,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.slot_key, s.placement, a.media_type, a.title, a.alt_text, a.service,
    a.category, a.before_after, a.pair_key, a.location_label,
    a.cloudflare_image_id, a.delivery_url, a.mux_playback_id, s.updated_at
  FROM media_slots s
  JOIN media_assets a ON a.id = s.asset_id
  WHERE a.status = 'ready' AND a.website_visible = true
    AND ((a.media_type = 'image' AND a.delivery_url IS NOT NULL)
      OR (a.media_type = 'video' AND a.mux_playback_id IS NOT NULL))
  ORDER BY s.slot_key;
$$;
REVOKE ALL ON FUNCTION public_media_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_media_slots() TO anon, authenticated;
