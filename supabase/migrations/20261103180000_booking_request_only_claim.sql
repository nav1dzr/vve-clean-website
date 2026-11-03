-- Additive request-only claim. No backfill, row rewrite or existing-function change.
-- Production application requires explicit approval; validate locally first.
create or replace function public.claim_booking_request_measurements(
  p_since timestamptz, p_limit integer default 10
) returns setof public.booking_measurement_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_since is null or not isfinite(p_since) then
    raise exception 'A finite request activation cutoff is required';
  end if;
  -- Unknown external outcome is held, never reclaimed/resubmitted. This also
  -- covers a crash after provider acceptance but before receipt persistence.
  update public.booking_measurement_outbox set status='suppressed',
    claimed_at=null,next_attempt_at=null,last_error='request_send_outcome_unknown'
    where event_name='booking_request_submitted' and provider='google_data_manager'
      and is_test=false and occurred_at >= p_since and created_at >= p_since
      and status='sending' and claimed_at < now()-interval '10 minutes';
  return query
  with due as (
    select id,status from public.booking_measurement_outbox
    where event_name = 'booking_request_submitted'
      and provider = 'google_data_manager' and is_test = false
      and occurred_at >= p_since and created_at >= p_since
      and (
        (status in ('pending','failed') and attempts < 8
          and (next_attempt_at is null or next_attempt_at <= now()))
        or (status = 'submitted' and (next_attempt_at is null or next_attempt_at <= now())
          and (claimed_at is null or claimed_at < now() - interval '10 minutes'))
      )
    order by created_at for update skip locked limit least(greatest(p_limit,1),25)
  )
  update public.booking_measurement_outbox o set
    status=case when due.status='submitted' then 'submitted' else 'sending' end,
    attempts=o.attempts+case when due.status='submitted' then 0 else 1 end,
    status_checks=o.status_checks+case when due.status='submitted' then 1 else 0 end,
    claimed_at=now(),
    last_error=case when due.status='submitted' then o.last_error else null end
  from due where o.id=due.id returning o.*;
end $$;
revoke all on function public.claim_booking_request_measurements(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.claim_booking_request_measurements(timestamptz,integer) to service_role;
