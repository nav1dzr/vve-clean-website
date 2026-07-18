-- Widens invoice_events.event_type to include the payment-reminder and
-- payment-acknowledgement audit events added by the invoice payment
-- communication flow (admin/api/invoices/[id].js's handleRemind/
-- handlePaymentAck). Those routes have been inserting 'reminder_sent',
-- 'reminder_failed', 'payment_ack_sent', and 'payment_ack_failed' events
-- since that feature shipped, but the original CHECK constraint from
-- 20260722000000_create_invoice_receipt_tables.sql never included them —
-- every one of those inserts has been silently failing the CHECK and
-- being swallowed by logEvent's own try/catch (it only console.errors,
-- never surfaces to the admin or fails the request), so reminder/
-- acknowledgement sends have had no audit trail at all. Purely additive:
-- widens an existing CHECK, does not touch any row, any other column, or
-- any other constraint.
--
-- Same drop-and-recreate pattern as 20260723000000's document_type
-- widening, applied to the sibling event_type constraint on the same
-- table.

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname FROM pg_constraint
   WHERE conrelid = 'invoice_events'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%event_type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoice_events DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE invoice_events ADD CONSTRAINT invoice_events_event_type_check
  CHECK (event_type IN (
    'created','updated','issued','previewed','pdf_generated',
    'sent','resent','send_failed','payment_recorded',
    'payment_reversed','paid','receipt_created','downloaded',
    'duplicated','voided','cancelled',
    'reminder_sent','reminder_failed','payment_ack_sent','payment_ack_failed'
  ));

-- ---------------------------------------------------------------------
-- Manual verification (run in Supabase SQL editor after applying):
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'invoice_events'::regclass and contype = 'c'
--    and pg_get_constraintdef(oid) like '%event_type%';
-- -- expect the definition to include reminder_sent/reminder_failed/
-- -- payment_ack_sent/payment_ack_failed alongside the original values
--
-- insert into invoice_events (document_type, document_id, event_type)
--   values ('invoice', gen_random_uuid(), 'reminder_sent');
-- -- expect success (previously: CHECK violation)
-- ---------------------------------------------------------------------
