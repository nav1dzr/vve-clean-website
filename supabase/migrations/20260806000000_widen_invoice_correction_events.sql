-- Adds the existing invoice-revision events and the new contact-correction
-- event to the invoice_events audit constraint. This changes no invoice or
-- payment data; it only prevents valid lifecycle events being rejected by
-- the original narrow CHECK constraint.

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
    'reminder_sent','reminder_failed','payment_ack_sent','payment_ack_failed',
    'revision_created','superseded','details_corrected'
  ));
