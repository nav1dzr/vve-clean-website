-- Apply after the booking journey migration. Adds independent, retryable owner and calendar deliveries.
-- Does not rewrite existing bookings, payments or messages.
create or replace function public.apply_booking_journey (
  p_booking_id uuid,
  p_revision integer,
  p_actor text,
  p_event text,
  p_patch jsonb default '{}',
  p_booking_patch jsonb default '{}',
  p_message jsonb default null,
  p_payment jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = public as $$
declare j public.booking_journeys; next_row public.booking_journeys; affected integer;
begin
 select * into j from public.booking_journeys where booking_id = p_booking_id for update;
 if not found then raise exception 'Booking journey not found'; end if;
 if p_payment is not null and exists(select 1 from public.booking_journey_payments where external_id = p_payment->>'external_id') then return to_jsonb(j); end if;
 if j.revision <> p_revision then raise exception 'Booking changed; reload before trying again' using errcode = '40001'; end if;
 if p_payment is not null then
   insert into public.booking_journey_payments(external_id,booking_id,kind,amount_pence,currency)
   values(p_payment->>'external_id',p_booking_id,p_payment->>'kind',(p_payment->>'amount_pence')::integer,'gbp');
 end if;
 next_row := jsonb_populate_record(j, p_patch - 'booking_id' - 'revision' - 'updated_at');
 update public.booking_journeys set revision=j.revision+1, offer_version=next_row.offer_version,
 state=next_row.state,draft=next_row.draft,snapshot=next_row.snapshot,previous_snapshot=next_row.previous_snapshot,
 token_generation=next_row.token_generation,token_expires_at=next_row.token_expires_at,hold_until=next_row.hold_until,
 reminder_sent_at=next_row.reminder_sent_at,
 appointment_reminder_sent_at=next_row.appointment_reminder_sent_at,
 checkout_id=next_row.checkout_id,checkout_kind=next_row.checkout_kind,checkout_creating_at=next_row.checkout_creating_at,
 paid_pence=next_row.paid_pence,refunded_pence=next_row.refunded_pence,customer_request=next_row.customer_request,updated_at=now()
 where booking_id=p_booking_id returning * into j;
 if p_booking_patch <> '{}'::jsonb then
   update public.bookings set
     service=coalesce(p_booking_patch->>'service',service),
     preferred_date=coalesce(p_booking_patch->>'preferred_date',preferred_date),
     preferred_time=coalesce(p_booking_patch->>'preferred_time',preferred_time),
     service_date=coalesce((p_booking_patch->>'service_date')::date,service_date),
     address=coalesce(p_booking_patch->>'address',address),postcode=coalesce(p_booking_patch->>'postcode',postcode),
     total_price=coalesce((p_booking_patch->>'total_price')::numeric,total_price),
     deposit_amount=coalesce((p_booking_patch->>'deposit_amount')::numeric,deposit_amount),
     payment_status=coalesce(p_booking_patch->>'payment_status',payment_status),
     balance_status=coalesce(p_booking_patch->>'balance_status',balance_status),
     balance_paid_at=coalesce((p_booking_patch->>'balance_paid_at')::timestamptz,balance_paid_at),
     balance_payment_method=coalesce(p_booking_patch->>'balance_payment_method',balance_payment_method),
     status=coalesce(p_booking_patch->>'status',status),updated_at=now()
   where id=p_booking_id;
 end if;
 insert into public.booking_journey_events(booking_id,revision,actor,event_type,details)
 values(p_booking_id,j.revision,p_actor,p_event,jsonb_build_object('changes',p_patch,'booking_changes',p_booking_patch));
 if p_message is not null then
   insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
   values(p_booking_id,p_message->>'dedup_key',p_message->>'kind',p_message->'payload') on conflict(dedup_key) do nothing;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','reschedule_received','cancellation_requested','cancelled','payment_review') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':business',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business')) on conflict(dedup_key) do nothing;
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':telegram',p_message->>'kind',(p_message->'payload')||jsonb_build_object('audience','business','channel','telegram')) on conflict(dedup_key) do nothing;
   end if;
   if p_message->>'kind' in ('confirmation','revised_confirmation','receipt','cancelled') then
     insert into public.booking_journey_messages(booking_id,dedup_key,kind,payload)
     values(p_booking_id,(p_message->>'dedup_key')||':calendar','calendar_sync',(p_message->'payload')||jsonb_build_object('audience','business','channel','calendar')) on conflict(dedup_key) do nothing;
   end if;
 end if;
 return to_jsonb(j);
end $$;

revoke all on function public.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from
  public,
  anon,
  authenticated;

grant
execute on function public.apply_booking_journey (
  uuid,
  integer,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
