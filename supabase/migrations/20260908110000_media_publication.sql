-- Additive migration. Apply only to the approved isolated test database first.
-- All publication writes remain behind the authenticated CRM server.
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_before_after_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_before_after_check CHECK (before_after IN ('before','after','during','none'));
ALTER TABLE public.media_gallery_slots DROP CONSTRAINT IF EXISTS media_gallery_slots_slot_code_check;
ALTER TABLE public.media_gallery_slots ADD CONSTRAINT media_gallery_slots_slot_code_check CHECK (slot_code ~ '^(BA0[1-5]|VIDEO0[1-4]|PHOTO(0[1-9]|1[0-9]|20))$');

INSERT INTO public.media_gallery_slots(topic_key,slot_code,slot_kind,label,sort_order)
SELECT topic_key, 'PHOTO'||n::text, 'photo', 'Work photo '||n::text, 9+n
FROM public.media_gallery_topics CROSS JOIN generate_series(11,20) n
ON CONFLICT(topic_key,slot_code) DO NOTHING;
INSERT INTO public.media_page_references(reference_key,page_key,page_label,component_label,gallery_slot_id,sort_order)
SELECT 'gallery-'||t.topic_key||'-'||lower(s.slot_code),'gallery-'||t.topic_key,t.label||' Gallery',s.label,s.id,s.sort_order
FROM public.media_gallery_slots s JOIN public.media_gallery_topics t USING(topic_key)
WHERE s.slot_code ~ '^PHOTO(1[1-9]|20)$' ON CONFLICT(reference_key) DO NOTHING;

CREATE TABLE public.media_publication_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK(target_type IN ('gallery','website')),
  target_id uuid NOT NULL,
  previous_assignments jsonb NOT NULL,
  published_assignments jsonb NOT NULL,
  published_by uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_publication_target_history ON public.media_publication_history(target_type,target_id,created_at DESC);
ALTER TABLE public.media_publication_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_publication_history FROM anon, authenticated;
GRANT SELECT,INSERT ON public.media_publication_history TO service_role;

-- Lock the slot, compare the reviewed version, validate both photos, then
-- change visibility/assignments and append history in ONE transaction.
CREATE FUNCTION public.publish_media_position(p_target_type text,p_target_id uuid,p_assignments jsonb,p_expected jsonb,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_kind text; v_topic text; v_current jsonb; v_next jsonb; v_entry jsonb; v_asset public.media_assets%ROWTYPE; v_history uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_admin_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_target_type='gallery' THEN
    SELECT slot_kind,topic_key INTO v_kind,v_topic FROM public.media_gallery_slots WHERE id=p_target_id FOR UPDATE;
  ELSIF p_target_type='website' THEN
    PERFORM 1 FROM public.media_website_slots WHERE id=p_target_id FOR UPDATE;
    IF FOUND THEN v_kind:='website'; END IF;
  END IF;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'Unknown position' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('assetId',asset_id,'role',media_role) ORDER BY media_role),'[]'::jsonb) INTO v_current
  FROM public.media_assignments WHERE (p_target_type='gallery' AND gallery_slot_id=p_target_id) OR (p_target_type='website' AND website_slot_id=p_target_id);
  IF p_expected IS NULL OR v_current<>p_expected THEN RAISE EXCEPTION 'Position changed. Review it again.' USING ERRCODE='40001'; END IF;
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assignments)<>(CASE WHEN v_kind='before_after' THEN 2 ELSE 1 END) THEN
    RAISE EXCEPTION 'Choose a complete position' USING ERRCODE='22023';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('assetId',e->>'assetId','role',e->>'role') ORDER BY e->>'role') INTO v_next FROM jsonb_array_elements(p_assignments)e;
  IF v_kind='before_after' AND (v_next->0->>'role'<>'after' OR v_next->1->>'role'<>'before' OR v_next->0->>'assetId'=v_next->1->>'assetId') THEN
    RAISE EXCEPTION 'Choose distinct before and after photographs' USING ERRCODE='22023';
  ELSIF v_kind<>'before_after' AND v_next->0->>'role'<>'primary' THEN RAISE EXCEPTION 'Invalid role' USING ERRCODE='22023'; END IF;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_next) LOOP
    SELECT * INTO v_asset FROM public.media_assets WHERE id=(v_entry->>'assetId')::uuid FOR UPDATE;
    IF NOT FOUND OR v_asset.status<>'ready' OR v_asset.title='' OR v_asset.alt_text='' THEN RAISE EXCEPTION 'Add a caption and description to ready media first' USING ERRCODE='22023'; END IF;
    IF (v_kind IN ('before_after','photo') AND (v_asset.media_type<>'image' OR v_asset.delivery_url IS NULL)) OR
       (v_kind='video' AND (v_asset.media_type<>'video' OR v_asset.mux_playback_id IS NULL)) THEN RAISE EXCEPTION 'Wrong media type' USING ERRCODE='22023'; END IF;
    IF v_topic IS NOT NULL AND v_asset.category<>(CASE WHEN v_topic='sofa' THEN 'sofa-upholstery' ELSE v_topic END) THEN RAISE EXCEPTION 'Choose media from this service' USING ERRCODE='22023'; END IF;
    IF v_kind='before_after' AND v_asset.before_after IS DISTINCT FROM v_entry->>'role' THEN RAISE EXCEPTION 'Check the before and after labels' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF v_current=v_next THEN RETURN jsonb_build_object('published',true,'unchanged',true); END IF;
  INSERT INTO public.media_publication_history(target_type,target_id,previous_assignments,published_assignments,published_by)
  VALUES(p_target_type,p_target_id,v_current,v_next,p_admin_id) RETURNING id INTO v_history;
  DELETE FROM public.media_assignments WHERE (p_target_type='gallery' AND gallery_slot_id=p_target_id) OR (p_target_type='website' AND website_slot_id=p_target_id);
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_next) LOOP
    INSERT INTO public.media_assignments(gallery_slot_id,website_slot_id,asset_id,media_role,updated_by)
    VALUES(CASE WHEN p_target_type='gallery' THEN p_target_id END,CASE WHEN p_target_type='website' THEN p_target_id END,(v_entry->>'assetId')::uuid,v_entry->>'role',p_admin_id);
    UPDATE public.media_assets SET website_visible=true,updated_at=now() WHERE id=(v_entry->>'assetId')::uuid;
  END LOOP;
  RETURN jsonb_build_object('published',true,'historyId',v_history);
END $$;
REVOKE ALL ON FUNCTION public.publish_media_position(text,uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_media_position(text,uuid,jsonb,jsonb,uuid) TO service_role;

-- Archive is reversible and may not hide an asset that a live position uses.
CREATE FUNCTION public.archive_media_asset(p_asset_id uuid,p_admin_id uuid,p_restore boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_admin_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.media_assets WHERE id=p_asset_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.media_assignments WHERE asset_id=p_asset_id) THEN RAISE EXCEPTION 'Replace its published positions before archiving' USING ERRCODE='40001'; END IF;
  UPDATE public.media_assets SET status=CASE WHEN p_restore THEN 'ready' ELSE 'archived' END,website_visible=false,updated_at=now()
  WHERE id=p_asset_id AND status=CASE WHEN p_restore THEN 'archived' ELSE 'ready' END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only completed unused media can be archived or restored' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.archive_media_asset(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_asset(uuid,uuid,boolean) TO service_role;

-- Metadata edits cannot race publication and relabel a live comparison.
CREATE FUNCTION public.guard_published_media_labels()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (NEW.category IS DISTINCT FROM OLD.category OR NEW.before_after IS DISTINCT FROM OLD.before_after)
     AND EXISTS(SELECT 1 FROM public.media_assignments WHERE asset_id=OLD.id) THEN
    RAISE EXCEPTION 'Replace published positions before changing service or stage' USING ERRCODE='40001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_published_labels_guard BEFORE UPDATE OF category,before_after ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.guard_published_media_labels();
