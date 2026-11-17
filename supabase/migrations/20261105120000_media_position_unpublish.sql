begin;
create function public.unpublish_media_position(
  p_target_type text, p_target_id uuid, p_expected jsonb, p_admin_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  current_assignments jsonb;
  history_id uuid;
begin
  if p_admin_id is null or not exists(select 1 from public.admin_users where id=p_admin_id) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_target_type='gallery' then
    perform 1 from public.media_gallery_slots where id=p_target_id for update;
  elsif p_target_type='website' then
    perform 1 from public.media_website_slots where id=p_target_id for update;
  else
    raise exception 'Unknown position' using errcode='22023';
  end if;
  if not found then raise exception 'Unknown position' using errcode='22023'; end if;
  if p_expected is null or jsonb_typeof(p_expected) is distinct from 'array' then
    raise exception 'Review the position first' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('assetId',asset_id,'role',media_role) order by media_role),'[]'::jsonb)
    into current_assignments from public.media_assignments
    where (p_target_type='gallery' and gallery_slot_id=p_target_id)
       or (p_target_type='website' and website_slot_id=p_target_id);
  if current_assignments='[]'::jsonb then
    return jsonb_build_object('unpublished',true,'unchanged',true);
  end if;
  if current_assignments<>p_expected then
    raise exception 'Position changed. Review it again.' using errcode='40001';
  end if;
  insert into public.media_publication_history(
    target_type,target_id,previous_assignments,published_assignments,published_by
  ) values(p_target_type,p_target_id,current_assignments,'[]'::jsonb,p_admin_id)
    returning id into history_id;
  delete from public.media_assignments
    where (p_target_type='gallery' and gallery_slot_id=p_target_id)
       or (p_target_type='website' and website_slot_id=p_target_id);
  return jsonb_build_object('unpublished',true,'historyId',history_id);
end $$;
revoke all on function public.unpublish_media_position(text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.unpublish_media_position(text,uuid,jsonb,uuid) to service_role;
commit;
