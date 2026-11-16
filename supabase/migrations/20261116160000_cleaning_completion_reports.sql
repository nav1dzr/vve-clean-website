-- Private standalone cleaning reports. No financial tables or existing records modified.
-- Production application requires explicit owner approval.
begin;
create table public.cleaning_completion_reports (
 id uuid primary key,
 booking_id uuid references public.bookings(id),
 customer_id uuid references public.customers(id),
 status text not null default 'draft' check(status in ('draft','final')),
 revision integer not null default 1,
 payload jsonb not null,
 created_by uuid not null references public.admin_users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 finalised_at timestamptz, finalised_by uuid references public.admin_users(id),
 pdf_key text, pdf_sha256 text,
 acknowledgement jsonb
);
create index cleaning_reports_booking on public.cleaning_completion_reports(booking_id,created_at desc);
create index cleaning_reports_customer on public.cleaning_completion_reports(customer_id,created_at desc);
create table public.cleaning_report_photos (
 id uuid primary key, report_id uuid not null references public.cleaning_completion_reports(id),
 object_key text not null unique, original_key text not null unique,
 mime_type text not null, original_mime_type text not null,
 sha256 text not null, original_sha256 text not null,
 size_bytes integer not null, original_size_bytes integer not null,
 created_by uuid not null references public.admin_users(id),created_at timestamptz not null default now()
);
create table public.cleaning_report_events (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.cleaning_completion_reports(id),
 event_type text not null, actor_id uuid not null references public.admin_users(id), detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.cleaning_report_sends (
 id uuid primary key, report_id uuid not null references public.cleaning_completion_reports(id), recipient text not null,
 status text not null check(status in ('sending','accepted','uncertain','not_sent')),
 actor_id uuid not null references public.admin_users(id), created_at timestamptz not null default now(),
 accepted_at timestamptz, provider_message_id text
);
create index cleaning_report_sends_history on public.cleaning_report_sends(report_id,created_at desc);
alter table public.cleaning_completion_reports enable row level security;
alter table public.cleaning_report_photos enable row level security;
alter table public.cleaning_report_events enable row level security;
alter table public.cleaning_report_sends enable row level security;
revoke all on public.cleaning_completion_reports,public.cleaning_report_photos,public.cleaning_report_events,public.cleaning_report_sends from anon,authenticated;
grant select on public.cleaning_completion_reports,public.cleaning_report_photos,public.cleaning_report_events,public.cleaning_report_sends to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('cleaning-reports-private','cleaning-reports-private',false,4194304,array['image/jpeg','image/png','application/pdf'])
 on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='cleaning-reports-private' and public=true) then raise exception 'Completion report bucket must be private'; end if;
end $$;
-- Restrictive policy prevents broader pre-existing permissive policies from exposing this bucket.
create policy cleaning_reports_block_client_access on storage.objects as restrictive for all to anon,authenticated
 using (bucket_id <> 'cleaning-reports-private') with check (bucket_id <> 'cleaning-reports-private');
-- All report file access goes through the authorised service-role API.
create function public.cleaning_report_write(p_action text,p_id uuid,p_actor uuid,p_revision integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cleaning_completion_reports; s public.cleaning_report_sends; v_event text; v_detail jsonb := '{}';
begin
 if not exists(select 1 from public.admin_users where id=p_actor) then raise exception 'Not authorised'; end if;
 if p_action='create' then
  insert into public.cleaning_completion_reports(id,booking_id,customer_id,payload,created_by)
   values(p_id,nullif(p_data->>'bookingId','')::uuid,nullif(p_data->>'customerId','')::uuid,p_data->'payload',p_actor)
   on conflict(id) do nothing returning * into r;
  if r.id is null then
   select * into r from public.cleaning_completion_reports where id=p_id;
   if r.created_by<>p_actor or r.payload<>p_data->'payload' or r.booking_id is distinct from nullif(p_data->>'bookingId','')::uuid or r.customer_id is distinct from nullif(p_data->>'customerId','')::uuid then raise exception 'Report reference already used'; end if;
   return to_jsonb(r);
  end if;
  v_event:='created';
 else
  select * into r from public.cleaning_completion_reports where id=p_id for update;
  if r.id is null then raise exception 'Report not found'; end if;
  if p_action in ('save','finalise','upload','acknowledge') and r.revision is distinct from p_revision then raise exception 'Report changed; reload before continuing'; end if;
  if p_action in ('save','finalise','upload') and r.status<>'draft' then raise exception 'Final reports are immutable; duplicate to create a new draft'; end if;
  if p_action='save' then
   update public.cleaning_completion_reports set payload=p_data->'payload',revision=revision+1,updated_at=now() where id=p_id returning * into r;
   v_event:='draft_saved';
  elsif p_action='upload' then
   insert into public.cleaning_report_photos(id,report_id,object_key,original_key,mime_type,original_mime_type,sha256,original_sha256,size_bytes,original_size_bytes,created_by)
   values((p_data->>'id')::uuid,p_id,p_data->>'objectKey',p_data->>'originalKey',p_data->>'mimeType',p_data->>'originalMimeType',p_data->>'sha256',p_data->>'originalSha256',(p_data->>'sizeBytes')::int,(p_data->>'originalSizeBytes')::int,p_actor);
   v_event:='photo_uploaded';v_detail:=jsonb_build_object('photoId',p_data->>'id');
  elsif p_action='finalise' then
   if p_data->>'pdfKey' is null or p_data->>'pdfSha256' is null then raise exception 'PDF required'; end if;
   update public.cleaning_completion_reports set status='final',pdf_key=p_data->>'pdfKey',pdf_sha256=p_data->>'pdfSha256',finalised_at=now(),finalised_by=p_actor,revision=revision+1,updated_at=now() where id=p_id returning * into r;
   v_event:='finalised';
  elsif p_action='acknowledge' then
   if r.status<>'final' then raise exception 'Final report required'; end if;
   update public.cleaning_completion_reports set acknowledgement=jsonb_build_object('acknowledged',p_data->'acknowledged','note',p_data->>'note','recordedBy',p_actor,'recordedAt',now()),revision=revision+1,updated_at=now() where id=p_id returning * into r;
   v_event:='acknowledgement_recorded';
  elsif p_action='claim_send' then
   if r.status<>'final' then raise exception 'Final report required'; end if;
   select * into s from public.cleaning_report_sends where id=(p_data->>'operationId')::uuid;
   if s.id is not null then
    if s.report_id<>p_id or s.recipient<>p_data->>'recipient' then raise exception 'Send reference already used'; end if;
    return jsonb_build_object('send',to_jsonb(s),'claimed',false);
   end if;
   if exists(select 1 from public.cleaning_report_sends where report_id=p_id and status in('sending','uncertain')) then raise exception 'An earlier delivery is uncertain; verify it before any resend'; end if;
   if exists(select 1 from public.cleaning_report_sends where report_id=p_id) and coalesce((p_data->>'resendConfirmed')::boolean,false)<>true then raise exception 'Explicit resend approval required'; end if;
   insert into public.cleaning_report_sends(id,report_id,recipient,status,actor_id) values((p_data->>'operationId')::uuid,p_id,p_data->>'recipient','sending',p_actor) returning * into s;
   insert into public.cleaning_report_events(report_id,event_type,actor_id,detail) values(p_id,'send_requested',p_actor,jsonb_build_object('sendId',s.id));
   return jsonb_build_object('send',to_jsonb(s),'claimed',true);
  elsif p_action='resolve_send' then
   if length(coalesce(p_data->>'note',''))<10 or p_data->>'outcome' not in ('accepted','not_sent') then raise exception 'Delivery check evidence required'; end if;
   update public.cleaning_report_sends set status=p_data->>'outcome',accepted_at=case when p_data->>'outcome'='accepted' then now() else null end
    where id=(p_data->>'operationId')::uuid and report_id=p_id and (status='uncertain' or (status='sending' and created_at<now()-interval '15 minutes')) returning * into s;
   if s.id is null then raise exception 'Delivery has already been resolved'; end if;
   insert into public.cleaning_report_events(report_id,event_type,actor_id,detail) values(p_id,'delivery_checked',p_actor,jsonb_build_object('sendId',s.id,'outcome',s.status,'note',p_data->>'note'));
   return to_jsonb(s);
  elsif p_action='finish_send' then
   update public.cleaning_report_sends set status=case when p_data->>'status'='accepted' then 'accepted' else 'uncertain' end,
    accepted_at=case when p_data->>'status'='accepted' then now() else null end,provider_message_id=p_data->>'messageId'
    where id=(p_data->>'operationId')::uuid and report_id=p_id and status='sending' returning * into s;
   if s.id is null then raise exception 'Send attempt not pending'; end if;
   insert into public.cleaning_report_events(report_id,event_type,actor_id,detail) values(p_id,'send_'||s.status,p_actor,jsonb_build_object('sendId',s.id));
   return to_jsonb(s);
  else raise exception 'Unsupported report action'; end if;
 end if;
 insert into public.cleaning_report_events(report_id,event_type,actor_id,detail) values(p_id,v_event,p_actor,v_detail);
 return to_jsonb(r);
end $$;
revoke all on function public.cleaning_report_write(text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.cleaning_report_write(text,uuid,uuid,integer,jsonb) to service_role;
comment on table public.cleaning_completion_reports is 'Standalone private work evidence; no payment, invoice or booked-task completion side effects.';
commit;
