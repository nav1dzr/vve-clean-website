-- Additive only; no existing booking, invoice or price is changed.
-- A saved version is a complete snapshot of all editable prices. The API accepts
-- partial edits and expands them before saving. No payment/policy fields belong here.
-- Update this shape in a new migration when the editable catalogue gains a field.
CREATE FUNCTION public.website_pricebook_matches_shape(value jsonb, expected jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=public AS $$
DECLARE field text; amount numeric;
BEGIN
  IF jsonb_typeof(expected) = 'boolean' THEN
    IF jsonb_typeof(value) <> 'number' THEN RETURN false; END IF;
    amount := (value #>> '{}')::numeric;
    RETURN amount > 0 AND amount <= 100000000 AND amount = trunc(amount);
  END IF;
  IF jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(value)) <> (SELECT count(*) FROM jsonb_object_keys(expected)) THEN RETURN false; END IF;
  FOR field IN SELECT jsonb_object_keys(expected) LOOP
    IF NOT value ? field OR NOT public.website_pricebook_matches_shape(value->field, expected->field) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;
CREATE FUNCTION public.website_pricebook_valid_snapshot(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=public AS $$
DECLARE property jsonb; package jsonb;
BEGIN
  IF NOT public.website_pricebook_matches_shape(value, '{"CARPET_MIN_BOOKING_P":true,"CARPET_ITEM_PRICES_P":{"bedroom":true,"living_room":true,"large_lounge":true,"hallway":true,"landing":true,"rug":true,"armchair":true,"sofa_2":true,"sofa_3":true,"sofa_corner":true,"mattress_single":true,"mattress_double":true,"mattress_king":true},"STAIRS_FIRST_P":true,"STAIRS_EXTRA_P":true,"EOT_PRICES_P":{"flat":{"studio":{"tailored":true,"complete":true},"bed1":{"tailored":true,"complete":true},"bed2":{"tailored":true,"complete":true},"bed3":{"tailored":true,"complete":true},"bed4":{"tailored":true,"complete":true}},"house":{"bed1":{"tailored":true,"complete":true},"bed2":{"tailored":true,"complete":true},"bed3":{"tailored":true,"complete":true},"bed4":{"tailored":true,"complete":true}}},"EOT_EXTRA_BATH_P":true,"EOT_EXTRA_WC_P":true,"EOT_TAILORED_ADDON_PRICES_P":{"microwave_inside":true,"fridge_freezer_inside":true,"extra_fridge_freezer":true,"dishwasher_inside":true,"washing_machine_inside":true},"EOT_TAILORED_CUPBOARDS_PRICES_P":{"studio":true,"bed1":true,"bed2":true,"bed3":true,"bed4":true},"EOT_EXTRA_AREAS_P":{"reception":true,"conservatory":true,"balcony":true,"utility":true},"EOT_CARPET_ADDON_PRICES_P":{"bedroom":true,"living_room":true,"large_lounge":true,"hallway":true,"landing":true,"stairs_first":true,"stairs_extra":true},"MOVEIN_BASE_PRICES_P":{"studio":true,"bed1":true,"bed2":true,"bed3":true,"bed4":true},"MOVEIN_EXTRA_BATH_P":true,"MOVEIN_EXTRA_WC_P":true,"AFTER_BUILDERS_FROM_PRICES_P":{"small":true,"studio":true,"bed1":true,"bed2":true,"bed3":true,"bed4":true},"COMMERCIAL_REGULAR_HOURLY_P":true,"COMMERCIAL_ONCEOFF_HOURLY_P":true,"COMMERCIAL_SHOP_CAFE_FROM_P":true,"COMMERCIAL_COMMUNAL_FROM_P":true,"COMMERCIAL_EOL_FROM_P":true,"COMMERCIAL_AFTER_BUILDERS_FROM_P":true,"COMMERCIAL_CARPET_PER_SQM_P":true,"COMMERCIAL_CARPET_MIN_P":true,"WINDOW_CLEANING_FROM_P":true,"WINDOW_CLEANING_MIN_P":true,"GARDEN_SERVICES_FROM_P":true,"GARDEN_SERVICES_MIN_P":true,"PRESSURE_WASHING_FROM_P":true,"WINDOW_QUICK_PRICES_P":{"small":true,"medium":true,"large":true},"GUTTER_QUICK_PRICES_P":{"terraced":true,"semi_detached":true,"detached":true},"QUICK_QUOTE_MIN_CHARGE_P":true,"ADDON_PRICES_P":{"oven":true,"fridge":true,"ext_windows":true,"balcony":true,"wall_marks":true,"key_collect":true,"rubbish":true}}'::jsonb) THEN RETURN false; END IF;
  FOR property IN SELECT jsonb_each.value FROM jsonb_each(value->'EOT_PRICES_P') LOOP
    FOR package IN SELECT jsonb_each.value FROM jsonb_each(property) LOOP
      IF (package->>'complete')::numeric < (package->>'tailored')::numeric THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.website_pricebook_matches_shape(jsonb,jsonb), public.website_pricebook_valid_snapshot(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_pricebook_matches_shape(jsonb,jsonb), public.website_pricebook_valid_snapshot(jsonb) TO service_role;

CREATE TABLE public.website_pricebook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  overrides jsonb NOT NULL CHECK (public.website_pricebook_valid_snapshot(overrides)),
  created_by uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE TABLE public.website_pricebook_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version_id uuid REFERENCES public.website_pricebook_versions(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.website_pricebook_state(singleton) VALUES (true);
CREATE TABLE public.website_pricebook_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_version_id uuid REFERENCES public.website_pricebook_versions(id),
  version_id uuid NOT NULL REFERENCES public.website_pricebook_versions(id),
  published_by uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  refresh_status text NOT NULL DEFAULT 'pending' CHECK (refresh_status IN ('pending','requested','failed'))
);
ALTER TABLE public.website_pricebook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pricebook_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pricebook_publications ENABLE ROW LEVEL SECURITY;
-- Supabase can supply broad default table grants, including for service_role.
-- Remove those before granting the narrow immutable-version access below.
REVOKE ALL ON public.website_pricebook_versions, public.website_pricebook_state, public.website_pricebook_publications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.website_pricebook_versions TO service_role;
GRANT SELECT ON public.website_pricebook_state TO service_role;
GRANT SELECT ON public.website_pricebook_publications TO service_role;
GRANT UPDATE (refresh_status) ON public.website_pricebook_publications TO service_role;

-- Version contents are immutable. Publishing/rollback moves the pointer under a lock.
CREATE FUNCTION public.publish_website_pricebook(p_version_id uuid, p_expected_version_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous uuid; publication uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id=p_admin_id) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT version_id INTO previous FROM public.website_pricebook_state WHERE singleton FOR UPDATE;
  IF previous IS DISTINCT FROM p_expected_version_id THEN RAISE EXCEPTION 'PRICEBOOK_CONFLICT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.website_pricebook_versions WHERE id=p_version_id) THEN RAISE EXCEPTION 'Version not found'; END IF;
  UPDATE public.website_pricebook_state SET version_id=p_version_id, updated_at=now() WHERE singleton;
  UPDATE public.website_pricebook_versions SET published_at=COALESCE(published_at,now()) WHERE id=p_version_id;
  INSERT INTO public.website_pricebook_publications(previous_version_id,version_id,published_by)
    VALUES(previous,p_version_id,p_admin_id) RETURNING id INTO publication;
  RETURN jsonb_build_object('id',p_version_id,'previousId',previous,'publicationId',publication);
END $$;
REVOKE ALL ON FUNCTION public.publish_website_pricebook(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_website_pricebook(uuid,uuid,uuid) TO service_role;

-- Returns only public price data; never customer, staff or draft records.
CREATE FUNCTION public.get_published_website_pricebook()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN v.id IS NULL THEN jsonb_build_object('id','bundled','version','bundled','overrides','{}'::jsonb)
    ELSE jsonb_build_object('id',v.id,'version',v.id,'overrides',v.overrides,'publishedAt',v.published_at) END
  FROM public.website_pricebook_state s LEFT JOIN public.website_pricebook_versions v ON v.id=s.version_id WHERE s.singleton;
$$;
REVOKE ALL ON FUNCTION public.get_published_website_pricebook() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_website_pricebook() TO service_role;
