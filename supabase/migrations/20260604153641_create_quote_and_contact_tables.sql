/*
  # Create quote_requests and contact_messages tables

  1. New Tables
    - `quote_requests`
      - `id` (uuid, primary key)
      - `name` (text) – customer name
      - `email` (text) – customer email
      - `phone` (text, nullable) – customer phone
      - `postcode` (text, nullable) – property postcode
      - `service_type` (text) – e.g. "Window Cleaning", "End of Tenancy"
      - `property_type` (text, nullable) – "flat", "house", "commercial_or_empty"
      - `bedrooms` (text, nullable) – size key e.g. "bed2", "studio"
      - `frequency` (text, nullable) – "one_off", "weekly", etc.
      - `estimated_price` (integer) – calculated quote in £
      - `created_at` (timestamptz)

    - `contact_messages`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `phone` (text, nullable)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Public INSERT policy (anonymous users can submit quotes and messages)
    - No SELECT policy for anonymous (data is only visible to authenticated admins)
*/

-- Quote requests table
CREATE TABLE IF NOT EXISTS quote_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  email          text        NOT NULL,
  phone          text        DEFAULT '',
  postcode       text        DEFAULT '',
  service_type   text        NOT NULL DEFAULT '',
  property_type  text        DEFAULT '',
  bedrooms       text        DEFAULT '',
  frequency      text        DEFAULT 'one_off',
  estimated_price integer    DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a quote request"
  ON quote_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND
    email IS NOT NULL AND email LIKE '%@%.%' AND
    service_type IS NOT NULL AND length(trim(service_type)) > 0
  );

CREATE POLICY "Authenticated users can read quote requests"
  ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  email      text        NOT NULL,
  phone      text        DEFAULT '',
  message    text        NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND
    email IS NOT NULL AND email LIKE '%@%.%' AND
    message IS NOT NULL AND length(trim(message)) > 0
  );

CREATE POLICY "Authenticated users can read contact messages"
  ON contact_messages
  FOR SELECT
  TO authenticated
  USING (true);
