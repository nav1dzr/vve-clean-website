-- Activation only. Run after ALL of these are true and Navid has approved:
--   1. supabase/migrations/20261117090000_invoice_email_outbox.sql is applied.
--   2. The CRM deployment has INVOICE_EMAIL_WORKER_SECRET (32+ characters)
--      and INVOICE_EMAIL_QUEUE_ENABLED=true.
--   3. A Vault secret named vve_invoice_email_worker_secret holds the SAME
--      value as INVOICE_EMAIL_WORKER_SECRET. Never place its value in this file.
--   4. A controlled test email to the owner's own inbox has been checked.
--
-- Requires the existing pg_cron, pg_net and Vault extensions. No extension
-- or other scheduled job is changed here. This calls the CRM, not the
-- website, and is separate from the vve-booking-followups job.
--
-- To stop it:  select cron.unschedule('vve-invoice-emails');
begin;
do $$
begin
  if (select count(*) from vault.decrypted_secrets
      where name = 'vve_invoice_email_worker_secret' and length(decrypted_secret) >= 32) <> 1 then
    raise exception 'Configure exactly one matching invoice email worker secret in Vault before activation';
  end if;
end $$;

select cron.schedule(
  'vve-invoice-emails',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://admin.vveclean.co.uk/api/invoices?action=process-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vve_invoice_email_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
commit;
