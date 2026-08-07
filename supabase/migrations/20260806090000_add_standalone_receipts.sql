-- Standalone receipts for payments received outside an invoice flow.
-- Additive only: existing invoice-generated receipts keep source='invoice'.

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'invoice';

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS service_description text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'receipts_source_check'
       AND conrelid = 'public.receipts'::regclass
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_source_check
      CHECK (source IN ('invoice', 'standalone'));
  END IF;
END $$;

COMMENT ON COLUMN public.receipts.source IS
  'invoice when generated from a paid invoice; standalone when an admin records an already-received payment directly.';

COMMENT ON COLUMN public.receipts.service_description IS
  'Immutable description of the service/payment shown on a standalone receipt.';
