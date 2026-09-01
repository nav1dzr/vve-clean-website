-- Preview-only, forward-safe media model.
--
-- This extends the isolated `media_preview_*` namespace only. Existing
-- uploaded assets and the legacy 96-slot preview remain readable while the
-- admin moves to the two-part Gallery/Website model. Nothing here touches VVE
-- OS tables, Auth, Storage, policies outside this namespace, or live data.

CREATE TABLE IF NOT EXISTS public.media_preview_gallery_topics (
  topic_key text PRIMARY KEY CHECK (topic_key ~ '^[a-z0-9-]+$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_preview_gallery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key text NOT NULL REFERENCES public.media_preview_gallery_topics(topic_key) ON DELETE RESTRICT,
  slot_code text NOT NULL CHECK (slot_code ~ '^(BA0[1-5]|VIDEO0[1-4]|PHOTO(0[1-9]|10))$'),
  slot_kind text NOT NULL CHECK (slot_kind IN ('before_after', 'video', 'photo')),
  label text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_key, slot_code)
);

CREATE TABLE IF NOT EXISTS public.media_preview_website_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL UNIQUE CHECK (slot_key ~ '^[a-z0-9-]+$'),
  page_label text NOT NULL,
  purpose_label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- An assignment is a pointer, never a file copy. A gallery before/after slot
-- owns two named roles; every other slot owns one primary role. Replacing an
-- assignment changes only this pointer and leaves the old asset in the library.
CREATE TABLE IF NOT EXISTS public.media_preview_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_slot_id uuid REFERENCES public.media_preview_gallery_slots(id) ON DELETE CASCADE,
  website_slot_id uuid REFERENCES public.media_preview_website_slots(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.media_preview_assets(id) ON DELETE RESTRICT,
  media_role text NOT NULL DEFAULT 'primary' CHECK (media_role IN ('before', 'after', 'primary')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (num_nonnulls(gallery_slot_id, website_slot_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS media_preview_gallery_assignment_role_key
  ON public.media_preview_assignments(gallery_slot_id, media_role)
  WHERE gallery_slot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS media_preview_website_assignment_role_key
  ON public.media_preview_assignments(website_slot_id, media_role)
  WHERE website_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_preview_assignments_asset_idx
  ON public.media_preview_assignments(asset_id);

-- A page reference is a configurable use of a Gallery or Website slot. It is
-- intentionally separate from assignments: one Gallery slot can be used on
-- the Gallery, a service page, and a local page without duplicating its asset.
CREATE TABLE IF NOT EXISTS public.media_preview_page_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_key text NOT NULL UNIQUE CHECK (reference_key ~ '^[a-z0-9-]+$'),
  page_key text NOT NULL CHECK (page_key ~ '^[a-z0-9-]+$'),
  page_label text NOT NULL,
  component_label text NOT NULL,
  gallery_slot_id uuid REFERENCES public.media_preview_gallery_slots(id) ON DELETE CASCADE,
  website_slot_id uuid REFERENCES public.media_preview_website_slots(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(gallery_slot_id, website_slot_id) = 1)
);

CREATE INDEX IF NOT EXISTS media_preview_page_references_page_idx
  ON public.media_preview_page_references(page_key, sort_order);

ALTER TABLE public.media_preview_gallery_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_gallery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_website_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preview_page_references ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_gallery_topics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_gallery_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_website_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_preview_page_references TO service_role;

INSERT INTO public.media_preview_gallery_topics (topic_key, label, description, sort_order)
VALUES
  ('carpet', 'Carpet', 'Carpet cleaning results', 10),
  ('sofa', 'Sofa', 'Sofa and upholstery cleaning results', 20),
  ('end-of-tenancy', 'End of Tenancy', 'End of tenancy cleaning results', 30)
ON CONFLICT (topic_key) DO NOTHING;

INSERT INTO public.media_preview_gallery_slots (topic_key, slot_code, slot_kind, label, sort_order)
SELECT topic_key,
  CASE
    WHEN n <= 5 THEN format('BA%s', lpad(n::text, 2, '0'))
    WHEN n <= 9 THEN format('VIDEO%s', lpad((n - 5)::text, 2, '0'))
    ELSE format('PHOTO%s', lpad((n - 9)::text, 2, '0'))
  END,
  CASE WHEN n <= 5 THEN 'before_after' WHEN n <= 9 THEN 'video' ELSE 'photo' END,
  CASE
    WHEN n <= 5 THEN format('Before / After %s', lpad(n::text, 2, '0'))
    WHEN n <= 9 THEN format('Video %s', lpad((n - 5)::text, 2, '0'))
    ELSE format('Grid photo %s', lpad((n - 9)::text, 2, '0'))
  END,
  n
FROM public.media_preview_gallery_topics
CROSS JOIN LATERAL generate_series(1, 19) AS n
ON CONFLICT (topic_key, slot_code) DO NOTHING;

INSERT INTO public.media_preview_website_slots (slot_key, page_label, purpose_label, description, sort_order)
VALUES
  ('homepage-hero-image', 'Homepage', 'Hero image', 'Main homepage background image', 10),
  ('homepage-hero-video', 'Homepage', 'Hero video', 'Optional homepage hero video', 20),
  ('homepage-equipment-image', 'Homepage', 'Equipment image', 'Equipment section image', 30),
  ('about-team-photo', 'About', 'Team photo', 'Approved team or owner photograph', 40),
  ('carpet-hero-image', 'Carpet', 'Hero image', 'Only use when it is not a Gallery reference', 50),
  ('sofa-hero-image', 'Sofa', 'Hero image', 'Only use when it is not a Gallery reference', 60),
  ('end-of-tenancy-hero-image', 'End of Tenancy', 'Hero image', 'Only use when it is not a Gallery reference', 70),
  ('trust-van-image', 'Trust', 'Van image', 'Vehicle photograph used across trust sections', 80),
  ('trust-equipment-image', 'Trust', 'Equipment image', 'Professional equipment photograph used across trust sections', 90)
ON CONFLICT (slot_key) DO NOTHING;

-- The Gallery always uses its own curated positions. These are actual page
-- references, not duplicate files.
INSERT INTO public.media_preview_page_references
  (reference_key, page_key, page_label, component_label, gallery_slot_id, sort_order)
SELECT
  format('gallery-%s-%s', s.topic_key, lower(s.slot_code)),
  format('gallery-%s', s.topic_key),
  format('%s Gallery', t.label),
  s.label,
  s.id,
  s.sort_order
FROM public.media_preview_gallery_slots s
JOIN public.media_preview_gallery_topics t ON t.topic_key = s.topic_key
ON CONFLICT (reference_key) DO NOTHING;

-- First three comparisons and first two videos are intentionally featured on
-- their matching main service page. Changing the Gallery slot changes every
-- reference below without an upload duplicate or public redeploy.
INSERT INTO public.media_preview_page_references
  (reference_key, page_key, page_label, component_label, gallery_slot_id, sort_order)
SELECT
  format('%s-main-%s', s.topic_key, lower(s.slot_code)),
  format('%s-main-results', s.topic_key),
  CASE s.topic_key WHEN 'end-of-tenancy' THEN 'Main End of Tenancy page' ELSE format('Main %s page', t.label) END,
  CASE WHEN s.slot_kind = 'before_after' THEN format('Featured before / after %s', s.slot_code) ELSE format('Featured video %s', s.slot_code) END,
  s.id,
  s.sort_order
FROM public.media_preview_gallery_slots s
JOIN public.media_preview_gallery_topics t ON t.topic_key = s.topic_key
WHERE s.slot_code IN ('BA01', 'BA02', 'BA03', 'VIDEO01', 'VIDEO02')
ON CONFLICT (reference_key) DO NOTHING;

INSERT INTO public.media_preview_page_references
  (reference_key, page_key, page_label, component_label, website_slot_id, sort_order)
SELECT
  format('website-%s', w.slot_key),
  w.slot_key,
  w.page_label,
  w.purpose_label,
  w.id,
  w.sort_order
FROM public.media_preview_website_slots w
WHERE w.slot_key IN ('homepage-hero-image', 'homepage-equipment-image')
ON CONFLICT (reference_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.public_media_preview_references()
RETURNS TABLE (
  reference_key text,
  page_key text,
  page_label text,
  component_label text,
  sort_order integer,
  source_type text,
  topic_key text,
  slot_code text,
  slot_kind text,
  media_role text,
  media_type text,
  title text,
  alt_text text,
  delivery_url text,
  mux_playback_id text,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.reference_key,
    r.page_key,
    r.page_label,
    r.component_label,
    r.sort_order,
    CASE WHEN r.gallery_slot_id IS NOT NULL THEN 'gallery' ELSE 'website' END,
    g.topic_key,
    COALESCE(g.slot_code, w.slot_key),
    COALESCE(g.slot_kind, 'website'),
    a.media_role,
    asset.media_type,
    asset.title,
    asset.alt_text,
    asset.delivery_url,
    asset.mux_playback_id,
    a.updated_at
  FROM public.media_preview_page_references r
  LEFT JOIN public.media_preview_gallery_slots g ON g.id = r.gallery_slot_id
  LEFT JOIN public.media_preview_website_slots w ON w.id = r.website_slot_id
  JOIN public.media_preview_assignments a
    ON (r.gallery_slot_id IS NOT NULL AND a.gallery_slot_id = r.gallery_slot_id)
      OR (r.website_slot_id IS NOT NULL AND a.website_slot_id = r.website_slot_id)
  JOIN public.media_preview_assets asset ON asset.id = a.asset_id
  WHERE r.active = true
    AND asset.status = 'ready'
    AND asset.website_visible = true
    AND ((asset.media_type = 'image' AND asset.delivery_url IS NOT NULL)
      OR (asset.media_type = 'video' AND asset.mux_playback_id IS NOT NULL))
  ORDER BY r.page_key, r.sort_order, a.media_role;
$$;

REVOKE ALL ON FUNCTION public.public_media_preview_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_media_preview_references() TO anon, authenticated;
