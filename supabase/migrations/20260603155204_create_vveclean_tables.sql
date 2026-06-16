/*
  # VVE CLEAN - Initial Schema

  1. New Tables
    - `quote_requests`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `service_type` (text)
      - `property_type` (text)
      - `bedrooms` (int)
      - `frequency` (text)
      - `postcode` (text)
      - `message` (text)
      - `estimated_price` (numeric)
      - `created_at` (timestamptz)
    - `contact_messages`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Allow public INSERT (anonymous users can submit quotes/contacts)
    - Authenticated users (admin) can SELECT all rows
*/

CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT '',
  bedrooms int NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  estimated_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a quote"
  ON quote_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND
    email IS NOT NULL AND email LIKE '%@%.%' AND
    service_type IS NOT NULL AND length(trim(service_type)) > 0
  );

CREATE POLICY "Authenticated users can view quotes"
  ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send a contact message"
  ON contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND
    email IS NOT NULL AND email LIKE '%@%.%' AND
    message IS NOT NULL AND length(trim(message)) > 0
  );

CREATE POLICY "Authenticated users can view contact messages"
  ON contact_messages
  FOR SELECT
  TO authenticated
  USING (true);
