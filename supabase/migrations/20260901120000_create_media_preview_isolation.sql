-- Temporary VVE OS Preview media namespace.
--
-- This migration is additive only. It creates new, uniquely prefixed public
-- objects and does not alter, drop, update, delete from, or add policies to
-- any VVE OS object. Do not run the older media migrations in this temporary
-- database: those target unprefixed production-oriented names.

CREATE TABLE IF NOT EXISTS public.media_preview_admin_users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_preview_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'archived')),
  original_filename text NOT NULL,
  original_content_type text NOT NULL,
  original_size_bytes bigint NOT NULL CHECK (original_size_bytes > 0),
  r2_key text NOT NULL UNIQUE,
  cloudflare_image_id text UNIQUE,
  delivery_url text,
  mux_asset_id text UNIQUE,
  mux_playback_id text UNIQUE,
  title text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'end-of-tenancy' CHECK (category IN ('end-of-tenancy', 'carpet', 'sofa-upholstery')),
  placement text NOT NULL DEFAULT 'gallery-end-of-tenancy' CHECK (placement IN ('main-home', 'gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa', 'carpet-page', 'sofa-page', 'end-of-tenancy-page')),
  before_after text NOT NULL DEFAULT 'none' CHECK (before_after IN ('before', 'after', 'none')),
  pair_key text NOT NULL DEFAULT '',
  location_label text NOT NULL DEFAULT '',
  website_visible boolean NOT NULL DEFAULT false,
  google_enabled boolean NOT NULL DEFAULT false,
  social_enabled boolean NOT NULL DEFAULT false,
  requested_slot_key text,
  replaced_by_asset_id uuid REFERENCES public.media_preview_assets(id),
  processing_error text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_preview_assets_status_created_idx
  ON public.media_preview_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS media_preview_assets_category_idx
  ON public.media_preview_assets(category, website_visible, status);

CREATE TABLE IF NOT EXISTS public.media_preview_slots (
  slot_key text PRIMARY KEY,
  placement text NOT NULL CHECK (placement IN ('main-home', 'gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa', 'carpet-page', 'sofa-page', 'end-of-tenancy-page')),
  label text NOT NULL,
  asset_id uuid REFERENCES public.media_preview_assets(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.media_preview_slots (slot_key, placement, label)
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

ALTER TABLE public.media_preview_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_slots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_slots TO service_role;

CREATE OR REPLACE FUNCTION public.public_media_preview_slots()
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
  FROM public.media_preview_slots s
  JOIN public.media_preview_assets a ON a.id = s.asset_id
  WHERE a.status = 'ready' AND a.website_visible = true
    AND ((a.media_type = 'image' AND a.delivery_url IS NOT NULL)
      OR (a.media_type = 'video' AND a.mux_playback_id IS NOT NULL))
  ORDER BY s.slot_key;
$$;

REVOKE ALL ON FUNCTION public.public_media_preview_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_media_preview_slots() TO anon, authenticated;
