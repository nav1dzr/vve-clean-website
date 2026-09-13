-- Additive aliases between existing CRM positions and the completion website.
-- Run only after checking the current public.media_page_references metadata.
-- Does not update existing references, assignments, assets, authentication,
-- customer records or delivery URLs. Existing Gallery positions are reused.

WITH mapping(old_page_key,new_page_key) AS (
  VALUES ('carpet-page','carpet-main-results'),
         ('sofa-page','sofa-main-results'),
         ('end-of-tenancy-page','end-of-tenancy-main-results')
)
INSERT INTO public.media_page_references
  (reference_key,page_key,page_label,component_label,gallery_slot_id,sort_order)
SELECT 'completion-'||source.reference_key,m.new_page_key,
       source.page_label,source.component_label,source.gallery_slot_id,source.sort_order
FROM public.media_page_references source
JOIN mapping m ON m.old_page_key=source.page_key
WHERE source.active=true AND source.gallery_slot_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.media_page_references existing
    WHERE existing.page_key=m.new_page_key
      AND existing.gallery_slot_id=source.gallery_slot_id
  )
ON CONFLICT(reference_key) DO NOTHING;

WITH mapping(slot_key,new_page_key) AS (
  VALUES ('homepage-hero','homepage-hero-image'),
         ('homepage-equipment','homepage-equipment-image')
)
INSERT INTO public.media_page_references
  (reference_key,page_key,page_label,component_label,website_slot_id,sort_order)
SELECT 'completion-'||m.new_page_key,m.new_page_key,
       slot.page_label,slot.purpose_label,slot.id,slot.sort_order
FROM public.media_website_slots slot
JOIN mapping m ON m.slot_key=slot.slot_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.media_page_references existing
  WHERE existing.page_key=m.new_page_key AND existing.website_slot_id=slot.id
)
ON CONFLICT(reference_key) DO NOTHING;
