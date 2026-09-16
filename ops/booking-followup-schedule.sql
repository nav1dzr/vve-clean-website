-- Activation only, after the deposit release and provider tests are approved.
-- Requires existing pg_cron, pg_net and Vault. The Vault secret below must
-- match BOOKING_JOURNEY_WORKER_SECRET in the website deployment. Never place
-- its value in this file. No extensions or other jobs are changed here.
begin;
do $$
begin
  if (select count(*) from vault.decrypted_secrets
      where name = 'vve_booking_worker_secret' and length(decrypted_secret) >= 32) <> 1 then
    raise exception 'Configure exactly one matching booking worker secret in Vault before activation';
  end if;
end $$;

select cron.schedule(
  'vve-booking-followups',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://www.vveclean.co.uk/api/booking-management?action=process-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vve_booking_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
commit;
