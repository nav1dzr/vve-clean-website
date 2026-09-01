-- Cloudflare Hosted Images is no longer part of the media pipeline. Image
-- records are ready when they have a Cloudflare Transformation delivery URL
-- backed by their immutable R2 original. This is idempotent and does not
-- alter the original files or any slot assignments.

CREATE OR REPLACE FUNCTION public_media_slots()
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
