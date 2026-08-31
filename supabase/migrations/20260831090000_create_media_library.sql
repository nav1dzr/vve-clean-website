-- VVE media library: originals live in private R2, while this database stores
-- publication metadata and stable gallery-slot references.  No provider keys,
-- customer details or original URLs are exposed through public reads.

CREATE TABLE IF NOT EXISTS media_assets (
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
  before_after text NOT NULL DEFAULT 'none' CHECK (before_after IN ('before', 'after', 'none')),
  pair_key text NOT NULL DEFAULT '',
  location_label text NOT NULL DEFAULT '',
  website_visible boolean NOT NULL DEFAULT false,
  google_enabled boolean NOT NULL DEFAULT false,
  social_enabled boolean NOT NULL DEFAULT false,
  requested_slot_key text,
  replaced_by_asset_id uuid REFERENCES media_assets(id),
  processing_error text NOT NULL DEFAULT '',
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_assets_status_created_idx ON media_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_category_idx ON media_assets(category, website_visible, status);

CREATE TABLE IF NOT EXISTS media_slots (
  slot_key text PRIMARY KEY CHECK (slot_key ~ '^gallery-(0[1-9]|1[0-9]|20)$'),
  label text NOT NULL,
  asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admin_users(id)
);

INSERT INTO media_slots (slot_key, label)
SELECT format('gallery-%s', lpad(n::text, 2, '0')), format('Gallery slot %s', lpad(n::text, 2, '0'))
FROM generate_series(1, 20) AS n
ON CONFLICT (slot_key) DO NOTHING;

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_slots ENABLE ROW LEVEL SECURITY;

-- Browser clients have no table policies. Admin API routes use the service
-- role after verifying admin_users; public-site reads use the narrowly scoped
-- RPC below, which deliberately returns only published delivery references.

CREATE OR REPLACE FUNCTION public_media_slots()
RETURNS TABLE (
  slot_key text,
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.slot_key,
    a.media_type,
    a.title,
    a.alt_text,
    a.service,
    a.category,
    a.before_after,
    a.pair_key,
    a.location_label,
    a.cloudflare_image_id,
    a.delivery_url,
    a.mux_playback_id,
    s.updated_at
  FROM media_slots s
  JOIN media_assets a ON a.id = s.asset_id
  WHERE a.status = 'ready'
    AND a.website_visible = true
    AND ((a.media_type = 'image' AND a.cloudflare_image_id IS NOT NULL)
      OR (a.media_type = 'video' AND a.mux_playback_id IS NOT NULL))
  ORDER BY s.slot_key;
$$;

REVOKE ALL ON FUNCTION public_media_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_media_slots() TO anon, authenticated;
