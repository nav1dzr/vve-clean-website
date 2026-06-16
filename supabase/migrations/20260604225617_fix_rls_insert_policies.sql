-- Drop all duplicate/overly-permissive INSERT policies on both tables

DROP POLICY IF EXISTS "Anyone can submit a quote"          ON quote_requests;
DROP POLICY IF EXISTS "Anyone can submit a quote request"  ON quote_requests;
DROP POLICY IF EXISTS "Anyone can send a contact message"  ON contact_messages;
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON contact_messages;

-- quote_requests: INSERT allowed only when required fields are non-empty
-- and the email column contains a basic valid format.
-- This removes the "always true" condition while keeping public forms functional.
CREATE POLICY "public_insert_quote_requests"
  ON quote_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name    IS NOT NULL AND length(trim(name))  > 0 AND
    email   IS NOT NULL AND email LIKE '%@%.%'       AND
    service_type IS NOT NULL AND length(trim(service_type)) > 0
  );

-- contact_messages: INSERT allowed only when required fields are non-empty
-- and the email column contains a basic valid format.
CREATE POLICY "public_insert_contact_messages"
  ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name    IS NOT NULL AND length(trim(name))    > 0 AND
    email   IS NOT NULL AND email LIKE '%@%.%'         AND
    message IS NOT NULL AND length(trim(message)) > 0
  );
