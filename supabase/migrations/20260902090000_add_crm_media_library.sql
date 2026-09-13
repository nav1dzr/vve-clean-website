-- CRM Media is an additive, isolated feature inside the existing CRM
-- Supabase project. It uses the CRM's existing admin_users authorisation;
-- it does not create or use a second Auth setup, VVE OS data, or browser
-- access to these tables.

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'archived')),
  original_filename text NOT NULL,
  original_content_type text NOT NULL,
  original_size_bytes bigint NOT NULL CHECK (original_size_bytes > 0),
  r2_key text NOT NULL UNIQUE,
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
  processing_error text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_assets_status_created_idx ON public.media_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_visibility_idx ON public.media_assets(website_visible, status);

CREATE TABLE IF NOT EXISTS public.media_gallery_topics (
  topic_key text PRIMARY KEY CHECK (topic_key ~ '^[a-z0-9-]+$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_gallery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key text NOT NULL REFERENCES public.media_gallery_topics(topic_key) ON DELETE RESTRICT,
  slot_code text NOT NULL CHECK (slot_code ~ '^(BA0[1-5]|VIDEO0[1-4]|PHOTO(0[1-9]|10))$'),
  slot_kind text NOT NULL CHECK (slot_kind IN ('before_after', 'video', 'photo')),
  label text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_key, slot_code)
);

CREATE TABLE IF NOT EXISTS public.media_website_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL UNIQUE CHECK (slot_key ~ '^[a-z0-9-]+$'),
  page_label text NOT NULL,
  purpose_label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Assignments are stable pointers, not file copies. Replacing an assignment
-- never deletes the prior private original from media_assets.
CREATE TABLE IF NOT EXISTS public.media_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_slot_id uuid REFERENCES public.media_gallery_slots(id) ON DELETE CASCADE,
  website_slot_id uuid REFERENCES public.media_website_slots(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  media_role text NOT NULL DEFAULT 'primary' CHECK (media_role IN ('before', 'after', 'primary')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  CHECK (num_nonnulls(gallery_slot_id, website_slot_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS media_gallery_assignment_role_key
  ON public.media_assignments(gallery_slot_id, media_role) WHERE gallery_slot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS media_website_assignment_role_key
  ON public.media_assignments(website_slot_id, media_role) WHERE website_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_assignments_asset_idx ON public.media_assignments(asset_id);

-- A slot may be used by multiple website components. References are separate
-- from assignments so a Gallery slot is reused rather than copied.
CREATE TABLE IF NOT EXISTS public.media_page_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_key text NOT NULL UNIQUE CHECK (reference_key ~ '^[a-z0-9-]+$'),
  page_key text NOT NULL CHECK (page_key ~ '^[a-z0-9-]+$'),
  page_label text NOT NULL,
  component_label text NOT NULL,
  gallery_slot_id uuid REFERENCES public.media_gallery_slots(id) ON DELETE CASCADE,
  website_slot_id uuid REFERENCES public.media_website_slots(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(gallery_slot_id, website_slot_id) = 1)
);

CREATE INDEX IF NOT EXISTS media_page_references_page_idx ON public.media_page_references(page_key, sort_order);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_gallery_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_gallery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_website_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_page_references ENABLE ROW LEVEL SECURITY;

-- No browser policies are created. CRM server routes use the service role only
-- after verifyAdminRequest confirms an existing CRM administrator.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_gallery_topics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_gallery_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_website_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_page_references TO service_role;

INSERT INTO public.media_gallery_topics (topic_key, label, description, sort_order)
VALUES
  ('carpet', 'Carpet', 'Carpet cleaning results', 10),
  ('sofa', 'Sofa', 'Sofa and upholstery cleaning results', 20),
  ('end-of-tenancy', 'End of Tenancy', 'End of tenancy cleaning results', 30)
ON CONFLICT (topic_key) DO NOTHING;

INSERT INTO public.media_gallery_slots (topic_key, slot_code, slot_kind, label, sort_order)
SELECT topic_key,
  CASE WHEN n <= 5 THEN format('BA%s', lpad(n::text, 2, '0'))
       WHEN n <= 9 THEN format('VIDEO%s', lpad((n - 5)::text, 2, '0'))
       ELSE format('PHOTO%s', lpad((n - 9)::text, 2, '0')) END,
  CASE WHEN n <= 5 THEN 'before_after' WHEN n <= 9 THEN 'video' ELSE 'photo' END,
  CASE WHEN n <= 5 THEN format('Before / After %s', lpad(n::text, 2, '0'))
       WHEN n <= 9 THEN format('Video %s', lpad((n - 5)::text, 2, '0'))
       ELSE format('Grid photo %s', lpad((n - 9)::text, 2, '0')) END,
  n
FROM public.media_gallery_topics CROSS JOIN LATERAL generate_series(1, 19) AS n
ON CONFLICT (topic_key, slot_code) DO NOTHING;

INSERT INTO public.media_website_slots (slot_key, page_label, purpose_label, description, sort_order)
VALUES
  ('homepage-hero', 'Homepage', 'Homepage Hero', 'Main homepage hero image or video', 10),
  ('homepage-equipment', 'Homepage', 'Homepage Equipment', 'Homepage equipment image', 20),
  ('about-team-photo', 'About', 'About Team Photo', 'Approved team or owner photograph', 30),
  ('carpet-hero', 'Carpet', 'Carpet Hero', 'Standalone carpet service hero', 40),
  ('sofa-hero', 'Sofa', 'Sofa Hero', 'Standalone sofa service hero', 50),
  ('end-of-tenancy-hero', 'End of Tenancy', 'End of Tenancy Hero', 'Standalone end of tenancy service hero', 60),
  ('trust-van', 'Trust', 'Trust Van', 'Vehicle photograph used across trust sections', 70),
  ('trust-equipment', 'Trust', 'Trust Equipment', 'Professional equipment photograph used across trust sections', 80)
ON CONFLICT (slot_key) DO NOTHING;

INSERT INTO public.media_page_references (reference_key, page_key, page_label, component_label, gallery_slot_id, sort_order)
SELECT format('gallery-%s-%s', t.topic_key, lower(s.slot_code)),
  format('gallery-%s', CASE t.topic_key WHEN 'end-of-tenancy' THEN 'end-of-tenancy' ELSE t.topic_key END),
  t.label || ' Gallery', s.label, s.id, s.sort_order
FROM public.media_gallery_slots s JOIN public.media_gallery_topics t ON t.topic_key = s.topic_key
ON CONFLICT (reference_key) DO NOTHING;

INSERT INTO public.media_page_references (reference_key, page_key, page_label, component_label, gallery_slot_id, sort_order)
SELECT format('%s-featured-%s', t.topic_key, lower(s.slot_code)),
  CASE t.topic_key WHEN 'carpet' THEN 'carpet-page' WHEN 'sofa' THEN 'sofa-page' ELSE 'end-of-tenancy-page' END,
  t.label || ' Service', 'Featured Gallery ' || s.slot_code, s.id, s.sort_order
FROM public.media_gallery_slots s JOIN public.media_gallery_topics t ON t.topic_key = s.topic_key
WHERE s.slot_code IN ('BA01', 'BA02', 'BA03', 'VIDEO01', 'VIDEO02')
ON CONFLICT (reference_key) DO NOTHING;

INSERT INTO public.media_page_references (reference_key, page_key, page_label, component_label, website_slot_id, sort_order)
SELECT 'website-' || slot_key, slot_key, page_label, purpose_label, id, sort_order
FROM public.media_website_slots
ON CONFLICT (reference_key) DO NOTHING;

-- The only public database surface is this resolved, publication-safe view.
-- It does not expose R2 keys, original filenames, upload metadata, or CRM
-- business data; it only returns ready assets assigned to a website reference.
CREATE OR REPLACE FUNCTION public.public_media_references()
RETURNS TABLE (
  reference_key text, page_key text, page_label text, component_label text, sort_order integer,
  source_type text, topic_key text, slot_code text, slot_kind text, media_role text,
  media_type text, title text, alt_text text, delivery_url text, mux_playback_id text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.reference_key, r.page_key, r.page_label, r.component_label, r.sort_order,
    CASE WHEN r.gallery_slot_id IS NOT NULL THEN 'gallery' ELSE 'website' END,
    g.topic_key, COALESCE(g.slot_code, w.slot_key), COALESCE(g.slot_kind, 'website'),
    a.media_role, asset.media_type, asset.title, asset.alt_text, asset.delivery_url, asset.mux_playback_id
  FROM public.media_page_references r
  LEFT JOIN public.media_gallery_slots g ON g.id = r.gallery_slot_id
  LEFT JOIN public.media_website_slots w ON w.id = r.website_slot_id
  JOIN public.media_assignments a
    ON (a.gallery_slot_id = r.gallery_slot_id OR a.website_slot_id = r.website_slot_id)
  JOIN public.media_assets asset ON asset.id = a.asset_id
  WHERE r.active = true AND asset.status = 'ready' AND asset.website_visible = true
    AND ((asset.media_type = 'image' AND asset.delivery_url IS NOT NULL)
      OR (asset.media_type = 'video' AND asset.mux_playback_id IS NOT NULL))
  ORDER BY r.page_key, r.sort_order, a.media_role;
$$;

REVOKE ALL ON FUNCTION public.public_media_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_media_references() TO anon, authenticated;
