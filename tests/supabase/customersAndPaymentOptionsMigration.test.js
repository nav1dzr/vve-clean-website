import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const FILENAME = '20260723000000_add_customers_and_payment_options.sql';

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration() {
  return readFileSync(resolve(MIGRATIONS_DIR, FILENAME), 'utf8');
}

// Static content checks on the migration file, same pattern and rationale
// as tests/supabase/invoiceReceiptMigration.test.js (no live database in
// this test environment).
describe('supabase migration — customers, payment options, service/billing contacts', () => {
  it('exists in supabase/migrations, after the original invoice/receipt migration', () => {
    const files = migrationFiles();
    expect(files).toContain(FILENAME);
    expect(FILENAME > '20260722000000_create_invoice_receipt_tables.sql').toBe(true);
  });

  it('creates the customers table', () => {
    expect(readMigration()).toMatch(/CREATE TABLE IF NOT EXISTS customers/);
  });

  it('constrains customer_type, source, and preferred_contact_method to the documented value sets', () => {
    const sql = readMigration();
    expect(sql).toMatch(/customer_type IN \('individual', 'landlord', 'letting_agent', 'agency', 'business'\)/);
    expect(sql).toMatch(/source IN \('website', 'phone', 'whatsapp', 'email', 'referral', 'google', 'repeat_customer', 'other'\)/);
    expect(sql).toMatch(/preferred_contact_method IS NULL OR preferred_contact_method IN \('phone', 'email', 'whatsapp'\)/);
  });

  it('enables RLS on customers with no anon/authenticated policy', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ALTER TABLE customers ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it('grants service_role explicit access to customers', () => {
    expect(readMigration()).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.customers TO service_role/);
  });

  it('adds payment_option to invoices, constrained and defaulted to bank_transfer', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS payment_option text NOT NULL DEFAULT 'bank_transfer'/);
    expect(sql).toMatch(/payment_option IN \('bank_transfer', 'stripe_payment_link', 'both'\)/);
  });

  it('adds a stripe payment link column and a frozen payment_instructions_snapshot', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS stripe_payment_link_url text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS payment_instructions_snapshot jsonb/);
  });

  it('adds separate service-contact columns, distinct from the existing billing customer_* columns', () => {
    const sql = readMigration();
    for (const col of ['service_contact_name', 'service_contact_email', 'service_contact_phone', 'service_address', 'service_contact_postcode']) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\s+text`));
    }
    // The pre-existing billing columns are untouched — no ALTER/DROP on them.
    expect(sql).not.toMatch(/ALTER TABLE invoices (DROP|ALTER) COLUMN customer_/);
  });

  it('adds per-document recipient overrides and optional customer FKs with ON DELETE SET NULL', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS invoice_recipient_email text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS receipt_recipient_email text/);
    expect(sql).toMatch(/billing_customer_id uuid REFERENCES public\.customers\(id\) ON DELETE SET NULL/);
    expect(sql).toMatch(/service_customer_id uuid REFERENCES public\.customers\(id\) ON DELETE SET NULL/);
  });

  it('widens invoice_events.document_type to include customer, without touching event_type', () => {
    const sql = readMigration();
    expect(sql).toMatch(/document_type IN \('invoice', 'receipt', 'customer'\)/);
    expect(sql).not.toMatch(/ALTER TABLE invoice_events.*event_type/is);
  });

  it('never drops, truncates, or touches bookings/admin_users outside the new FK columns', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/\bALTER TABLE bookings\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE admin_users\b/i);
  });

  it('includes manual verification SQL for customers RLS and the new invoice columns', () => {
    const sql = readMigration();
    expect(sql).toMatch(/relname = 'customers'/);
    expect(sql).toMatch(/tablename = 'customers'/);
    expect(sql).toMatch(/information_schema\.columns/);
  });
});
